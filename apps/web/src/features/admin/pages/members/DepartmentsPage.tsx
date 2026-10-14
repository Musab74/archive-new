import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { DepartmentNode, Departments } from '../../../../shared/api/schemas';
import { AButton, ACheckbox, AdminPage, AInput, Callout, Card, ConfirmDialog, DetailDrawer, FieldRow, StatusBadge } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const DEPTS: { key: 'A' | 'B' | 'C'; label: string }[] = [{ key: 'A', label: tr('관리자', 'Administrators') }, { key: 'B', label: tr('영업자', 'Sales') }, { key: 'C', label: tr('첨삭강사', 'Tutors') }];

/** Depth-first order (parent before children), like the nested lists of dept_category.php. */
export function treeOrder(items: DepartmentNode[], dept: string): DepartmentNode[] {
  const mine = items.filter((i) => i.dept === dept);
  const byParent = new Map<number, DepartmentNode[]>();
  for (const n of mine) { const k = n.parent ?? 0; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(n); }
  for (const arr of byParent.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.idx - b.idx);
  const out: DepartmentNode[] = [];
  const walk = (parent: number) => { for (const n of byParent.get(parent) ?? []) { out.push(n); walk(n.idx); } };
  walk(0);
  const seen = new Set(out.map((o) => o.idx));
  for (const n of mine) if (!seen.has(n.idx)) out.push(n); // orphans (parent outside this site code)
  return out;
}

type FormState = { mode: 'create' | 'edit'; dept: 'A' | 'B' | 'C'; parent: DepartmentNode | null; node: DepartmentNode | null; name: string; top: Set<string>; sub: Set<string> };

/** dept_category.php — the three category trees with 수정 / 하부 카테고리 추가 / 삭제 and 영업부서 정렬. */
export default function DepartmentsPage() {
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'departments'], queryFn: ({ signal }) => adminApi.departments(signal) });
  const data: Departments | undefined = q.data;
  const [form, setForm] = useState<FormState | null>(null);
  const inv = [['admin', 'departments'], ['admin', 'staff']];
  const onErr = (err: unknown) => toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
  const create = useAdminMutation({ fn: (b: Record<string, unknown>) => adminApi.createDepartment(b), invalidate: inv, success: adm.common.created, onSuccess: () => setForm(null), onError: onErr });
  const patch = useAdminMutation({ fn: (v: { idx: number; body: Record<string, unknown> }) => adminApi.patchDepartment(v.idx, v.body), invalidate: inv, success: adm.common.saved, onSuccess: () => setForm(null), onError: onErr });
  const [del, setDel] = useState<{ node: DepartmentNode; force: boolean; staff?: number } | null>(null);
  const remove = useAdminMutation({ fn: (v: { idx: number; force: boolean }) => adminApi.deleteDepartment(v.idx, v.force), invalidate: inv, success: adm.common.deleted, onSuccess: () => setDel(null), onError: (err) => { if (isAppError(err) && (err.details as { requiresForce?: boolean; staff?: number } | undefined)?.requiresForce) { setDel((d) => d ? { ...d, staff: (err.details as { staff: number }).staff } : d); return; } onErr(err); } });
  const [order, setOrder] = useState<number[] | null>(null);
  const reorder = useAdminMutation({ fn: (ids: number[]) => adminApi.reorderDepartments('B', ids), invalidate: inv, success: tr('정렬을 저장했습니다.', 'Order saved.'), onSuccess: () => setOrder(null), onError: onErr });
  useEffect(() => { setOrder(null); }, [data]);

  const open = (mode: 'create' | 'edit', dept: 'A' | 'B' | 'C', parent: DepartmentNode | null, node: DepartmentNode | null) =>
    setForm({ mode, dept, parent, node, name: node?.name ?? '', top: new Set((node?.topMenuGrant ?? '').split(',').filter(Boolean)), sub: new Set((node?.subMenuGrant ?? '').split(',').filter(Boolean)) });
  const submit = () => {
    if (!form) return;
    if (!form.name.trim()) { toast(tr('카테고리명을 입력하세요.', 'Enter a name.'), { tone: 'danger' }); return; }
    const body = { deptName: form.name.trim(), topMenuGrant: [...form.top], subMenuGrant: [...form.sub] };
    if (form.mode === 'create') create.mutate({ ...body, dept: form.dept, parentIdx: form.parent?.idx ?? 0 }); else patch.mutate({ idx: form.node!.idx, body });
  };
  const toggleTop = (code: string, on: boolean) => setForm((f) => { if (!f) return f; const top = new Set(f.top); const sub = new Set(f.sub); if (on) top.add(code); else top.delete(code); for (const s of data?.grants.sub[code] ?? []) { if (on) sub.add(s.code); else sub.delete(s.code); } return { ...f, top, sub }; });
  const toggleSub = (letter: string, code: string, on: boolean) => setForm((f) => { if (!f) return f; const sub = new Set(f.sub); const top = new Set(f.top); if (on) sub.add(code); else sub.delete(code); const any = (data?.grants.sub[letter] ?? []).some((s) => sub.has(s.code)); if (any) top.add(letter); else top.delete(letter); return { ...f, sub, top }; });

  const salesFlat = useMemo(() => (data ? treeOrder(data.items, 'B') : []), [data]);
  const orderList = order ?? salesFlat.map((n) => n.idx);
  const move = (idx: number, dir: -1 | 1) => { const i = orderList.indexOf(idx); const j = i + dir; if (i < 0 || j < 0 || j >= orderList.length) return; const next = [...orderList]; [next[i], next[j]] = [next[j]!, next[i]!]; setOrder(next); };

  return (
    <AdminPage title={tr('관리자/영업자/첨삭강사 카테고리', 'Staff categories')} lead={tr('부서(카테고리) 트리와 메뉴 권한입니다. 운영자는 카테고리의 권한으로 메뉴를 봅니다.', 'Department trees and their menu permissions. Operators inherit the permissions of their category.')}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : q.isPending || !data ? <Skeleton lines={10} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {DEPTS.map((d) => {
            const nodes = treeOrder(data.items, d.key);
            return (
              <Card key={d.key} title={d.label} aside={<AButton size="sm" variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => open('create', d.key, null, null)}>{tr('하부 카테고리 추가', 'Add category')}</AButton>}>
                {nodes.length ? (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {nodes.map((n) => (
                      <li key={n.idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', paddingLeft: 10 + (n.deep - 1) * 24, border: '1px solid var(--c-line-2)', borderRadius: 8, background: 'var(--c-paper)' }}>
                        <span style={{ color: 'var(--c-muted)', fontSize: 12, width: 40 }}>#{n.idx}</span>
                        <b style={{ minWidth: 160 }}>{n.deep > 1 ? '└ ' : ''}{n.name}</b>
                        <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>{n.topMenuGrant.split(',').filter(Boolean).map((g) => <StatusBadge key={g} tone="info" title={data.grants.top.find((t) => t.code === g)?.label}>{g}</StatusBadge>)}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{tr('하부', 'children')} {n.children} · {tr('운영자', 'staff')} {n.staff}</span>
                        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                          <AButton size="xs" disabled={!canWrite} onClick={() => open('edit', d.key, null, n)}>{adm.common.edit}</AButton>
                          <AButton size="xs" disabled={!canWrite} onClick={() => open('create', d.key, n, null)}>{tr('하부 추가', 'Add child')}</AButton>
                          <AButton size="xs" variant="danger" disabled={!canWrite || n.children > 0} title={n.children > 0 ? tr('하부에 등록된 카테고리가 존재합니다.', 'Has child categories.') : undefined} onClick={() => setDel({ node: n, force: false })}>{adm.common.delete}</AButton>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted" style={{ fontSize: 13 }}>{tr('등록된 카테고리가 없습니다.', 'No categories.')}</p>}
              </Card>
            );
          })}
          <Card title={tr('영업부서 정렬', 'Sales department order')} aside={<AButton size="sm" variant="primary" disabled={!canWrite || !order} loading={reorder.isPending} onClick={() => reorder.mutate(orderList)}>{tr('정렬 하기', 'Save order')}</AButton>}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {orderList.map((idx, i) => { const n = salesFlat.find((x) => x.idx === idx); if (!n) return null; return (
                <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', border: '1px solid var(--c-line-2)', borderRadius: 8 }}>
                  <span className="muted" style={{ width: 28, fontSize: 12 }}>{i + 1}</span><b>{n.name}</b><span className="muted" style={{ fontSize: 12 }}>{tr('영업자', 'sales staff')} {n.staff}</span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}><AButton size="xs" disabled={!canWrite || i === 0} onClick={() => move(idx, -1)}>▲</AButton><AButton size="xs" disabled={!canWrite || i === orderList.length - 1} onClick={() => move(idx, 1)}>▼</AButton></span>
                </li>); })}
            </ul>
          </Card>
        </div>
      )}

      <DetailDrawer open={!!form} onClose={() => setForm(null)} title={form?.mode === 'create' ? tr('카테고리 등록', 'New category') : tr('카테고리 수정', 'Edit category')} subtitle={form ? `${DEPTS.find((d) => d.key === form.dept)?.label}${form.parent ? ` › ${form.parent.name}` : ''}` : ''} wide
        footer={<><AButton onClick={() => setForm(null)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{form?.mode === 'create' ? adm.common.create : adm.common.save}</AButton></>}>
        {form && data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FieldRow label={tr('카테고리명', 'Name')} htmlFor="dp-name" required><AInput id="dp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={50} /></FieldRow>
            <Callout>{tr('상위 메뉴를 켜면 하위 메뉴가 모두 선택되고, 하위 메뉴를 하나라도 켜면 상위 메뉴가 켜집니다(기존 화면과 동일).', 'Ticking a top menu selects all of its sub menus; ticking any sub menu turns its top menu on (as before).')}</Callout>
            {data.grants.top.map((t) => (
              <div key={t.code} style={{ border: '1px solid var(--c-line-2)', borderRadius: 8, padding: '10px 12px' }}>
                <ACheckbox label={<b>{t.code} · {t.label}</b>} checked={form.top.has(t.code)} onChange={(e) => toggleTop(t.code, e.target.checked)} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 8, paddingLeft: 22 }}>
                  {(data.grants.sub[t.code] ?? []).map((s) => <ACheckbox key={s.code} label={`${s.code} ${s.label}`} checked={form.sub.has(s.code)} onChange={(e) => toggleSub(t.code, s.code, e.target.checked)} />)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </DetailDrawer>

      <ConfirmDialog open={!!del} title={tr('카테고리 삭제', 'Delete category')} tone="danger" loading={remove.isPending} confirmLabel={del?.staff ? tr('강제 삭제', 'Delete anyway') : adm.common.delete} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate({ idx: del.node.idx, force: !!del.staff && del.force })}
        body={<div><p><b>{del?.node.name}</b> {tr('카테고리를 삭제합니다.', 'will be deleted.')}</p>{del?.staff ? <div className="u-mt-8"><Callout tone="warn">{tr(`이 카테고리에 속한 운영자 ${del.staff}명이 있습니다. 운영자의 부서 연결은 그대로 남습니다.`, `${del.staff} operators belong to this category; their department link will remain.`)}</Callout><div className="u-mt-8"><ACheckbox label={tr('그래도 삭제', 'Delete anyway')} checked={del.force} onChange={(e) => setDel({ ...del, force: e.target.checked })} /></div></div> : null}</div>} />
    </AdminPage>
  );
}
