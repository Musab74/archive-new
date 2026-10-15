import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { DepartmentNode } from '../../../../shared/api/schemas';
import { AButton, ACheckbox, AdminPage, AInput, Callout, Card, ConfirmDialog, DetailDrawer, FieldRow, StatusBadge } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { Icon } from '../../../../shared/ui/Icon';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { staffParityApi, type DepartmentsParity, type DeptNodeParity } from './staffApi';
import { STAFF_DEPT_TEXT, deepTint, treeByIdx, visibleTree, type StaffDept } from './staffParity';

const DEPTS: { key: StaffDept; label: string }[] = [{ key: 'A', label: tr('관리자', 'Administrators') }, { key: 'B', label: tr('영업자', 'Sales') }, { key: 'C', label: tr('첨삭강사', 'Tutors') }];

/** Depth-first order (parent before children), siblings by idx ASC like dept_category.php / dept_category_sub.php (ORDER BY idx ASC). */
export function treeOrder<T extends DepartmentNode>(items: T[], dept: string): T[] {
  return treeByIdx(items.filter((i) => i.dept === dept));
}

type FormState = { mode: 'create' | 'edit'; dept: StaffDept; parent: DeptNodeParity | null; node: DeptNodeParity | null; name: string; top: Set<string>; sub: Set<string> };
type Catalogue = { top: { code: string; label: string }[]; sub: Record<string, { code: string; label: string }[]> };

/** dept_category.php — the three category trees (collapsed to the roots, "이름 [N]" expands) with 수정 / 하부 카테고리 추가 / 삭제 and 영업부서 정렬. */
export default function DepartmentsPage() {
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'departments', 'parity'], queryFn: ({ signal }) => staffParityApi.departments(signal) });
  const data: DepartmentsParity | undefined = q.data;
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (idx: number) => setExpanded((s) => { const n = new Set(s); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  const inv = [['admin', 'departments'], ['admin', 'staff'], ['admin', 'staff-categories']];
  const onErr = (err: unknown) => { setConfirmSave(false); toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  const closeForm = () => { setConfirmSave(false); setForm(null); };
  const create = useAdminMutation({ fn: (b: Record<string, unknown>) => adminApi.createDepartment(b), invalidate: inv, success: tr('처리되었습니다.', 'Saved.'), onSuccess: closeForm, onError: onErr });
  const patch = useAdminMutation({ fn: (v: { idx: number; body: Record<string, unknown> }) => adminApi.patchDepartment(v.idx, v.body), invalidate: inv, success: tr('처리되었습니다.', 'Saved.'), onSuccess: closeForm, onError: onErr });
  const [del, setDel] = useState<{ node: DeptNodeParity; force: boolean; staff?: number } | null>(null);
  const remove = useAdminMutation({ fn: (v: { idx: number; force: boolean }) => adminApi.deleteDepartment(v.idx, v.force), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDel(null); setForm(null); }, onError: (err) => { if (isAppError(err) && (err.details as { requiresForce?: boolean; staff?: number } | undefined)?.requiresForce) { setDel((d) => d ? { ...d, staff: (err.details as { staff: number }).staff } : d); return; } onErr(err); } });
  const [order, setOrder] = useState<number[] | null>(null);
  const reorder = useAdminMutation({ fn: (ids: number[]) => adminApi.reorderDepartments('B', ids), invalidate: inv, success: tr('정렬을 저장했습니다.', 'Order saved.'), onSuccess: () => setOrder(null), onError: onErr });
  useEffect(() => { setOrder(null); }, [data]);

  const catalogue = (dept: StaffDept): Catalogue => (data?.grants.byDept?.[dept] as Catalogue | undefined) ?? { top: data?.grants.top ?? [], sub: data?.grants.sub ?? {} };
  const open = (mode: 'create' | 'edit', dept: StaffDept, parent: DeptNodeParity | null, node: DeptNodeParity | null) =>
    setForm({ mode, dept, parent, node, name: node?.name ?? '', top: new Set((node?.topMenuGrant ?? '').split(',').filter(Boolean)), sub: new Set((node?.subMenuGrant ?? '').split(',').filter(Boolean)) });
  const submit = () => {
    if (!form) return;
    if (!form.name.trim()) { toast(tr('카테고리명을 입력하세요.', 'Enter a name.'), { tone: 'danger' }); return; }
    setConfirmSave(true);
  };
  const save = () => {
    if (!form) return;
    const cat = catalogue(form.dept);
    const allowedSub = new Set(Object.values(cat.sub).flat().map((s) => s.code));
    const allowedTop = new Set(cat.top.map((t) => t.code));
    const body = { deptName: form.name.trim(), topMenuGrant: [...form.top].filter((c) => allowedTop.has(c)), subMenuGrant: [...form.sub].filter((c) => allowedSub.has(c)) };
    if (form.mode === 'create') create.mutate({ ...body, dept: form.dept, parentIdx: form.parent?.idx ?? 0 }); else patch.mutate({ idx: form.node!.idx, body });
  };
  const toggleTop = (code: string, on: boolean) => setForm((f) => { if (!f) return f; const top = new Set(f.top); const sub = new Set(f.sub); if (on) top.add(code); else top.delete(code); for (const s of catalogue(f.dept).sub[code] ?? []) { if (on) sub.add(s.code); else sub.delete(s.code); } return { ...f, top, sub }; });
  const toggleSub = (letter: string, code: string, on: boolean) => setForm((f) => { if (!f) return f; const sub = new Set(f.sub); const top = new Set(f.top); if (on) sub.add(code); else sub.delete(code); const any = (catalogue(f.dept).sub[letter] ?? []).some((s) => sub.has(s.code)); if (any) top.add(letter); else top.delete(letter); return { ...f, sub, top }; });

  const salesRows = data?.salesOrder ?? [];
  const orderList = order ?? salesRows.map((n) => n.idx);
  const move = (idx: number, dir: -1 | 1) => { const i = orderList.indexOf(idx); const j = i + dir; if (i < 0 || j < 0 || j >= orderList.length) return; const next = [...orderList]; [next[i], next[j]] = [next[j]!, next[i]!]; setOrder(next); };
  const upperName = (f: FormState) => {
    if (f.mode === 'create') return f.parent?.name ?? tr('없음', 'None');
    const pid = f.node?.parent ?? 0;
    return pid ? (data?.items.find((i) => i.idx === pid)?.name ?? `#${pid}`) : tr('없음', 'None');
  };
  const trees = useMemo(() => Object.fromEntries(DEPTS.map((d) => [d.key, data ? treeOrder(data.items, d.key) : []])) as Record<StaffDept, DeptNodeParity[]>, [data]);

  return (
    <AdminPage title={tr('관리자/영업자/첨삭강사 카테고리', 'Staff categories')} lead={tr('부서(카테고리) 트리와 메뉴 권한입니다. 이름 옆 [N]을 누르면 하부 카테고리가 펼쳐집니다.', 'Department trees and their menu permissions. Click a name with [N] to expand its sub-categories.')}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : q.isPending || !data ? <Skeleton lines={10} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {DEPTS.map((d) => {
            const nodes = visibleTree(trees[d.key], expanded);
            return (
              <Card key={d.key} title={d.label} aside={<AButton size="sm" variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => open('create', d.key, null, null)}>{tr('하부 카테고리 추가', 'Add category')}</AButton>}>
                {nodes.length ? (
                  <ul role="tree" aria-label={d.label} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {nodes.map((n) => (
                      <li key={n.idx} role="treeitem" aria-level={n.deep} aria-expanded={n.children > 0 ? expanded.has(n.idx) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', paddingLeft: 10 + (n.deep - 1) * 24, border: '1px solid var(--c-line-2)', borderRadius: 8, background: 'var(--c-paper)', flexWrap: 'wrap' }}>
                        <Icon name="folders" size={16} style={{ color: 'var(--c-muted)' }} />
                        {n.children > 0
                          ? <button type="button" onClick={() => toggleExpand(n.idx)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--c-primary)', font: 'inherit', fontWeight: 700, minWidth: 160, textAlign: 'left' }}>{n.name}&nbsp;[{n.children}]</button>
                          : <b style={{ minWidth: 160 }}>{n.name}</b>}
                        <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>{n.topMenuGrant.split(',').filter(Boolean).map((g) => <StatusBadge key={g} tone="info" title={data.grants.top.find((t) => t.code === g)?.label}>{g}</StatusBadge>)}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{tr('운영자', 'staff')} {n.staff}</span>
                        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                          <AButton size="xs" disabled={!canWrite} onClick={() => open('edit', d.key, null, n)}>{adm.common.edit}</AButton>
                          <AButton size="xs" disabled={!canWrite} onClick={() => open('create', d.key, n, null)}>{tr('하부 카테고리 추가', 'Add child')}</AButton>
                          <AButton size="xs" variant="danger" disabled={!canWrite || n.children > 0} title={n.children > 0 ? tr('하부에 등록된 카테고리가 존재합니다.', 'Has child categories.') : undefined} onClick={() => setDel({ node: n, force: false })}>{adm.common.delete}</AButton>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>{tr(`등록된 ${STAFF_DEPT_TEXT[d.key].name}가 없습니다.`, `No ${STAFF_DEPT_TEXT[d.key].nameEn} categories.`)}</p>}
              </Card>
            );
          })}
          <Card title={tr('영업부서 정렬', 'Sales department order')} aside={<AButton size="sm" variant="primary" disabled={!canWrite || !order} loading={reorder.isPending} onClick={() => reorder.mutate(orderList)}>{tr('정렬 하기', 'Save order')}</AButton>}>
            <div style={{ overflowX: 'auto' }}>
              <table aria-label={tr('영업부서 정렬', 'Sales department order')} style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', fontSize: 14 }}>
                <thead><tr className="muted" style={{ fontSize: 12, textAlign: 'center' }}><th style={{ width: 80 }}>Deep</th><th style={{ textAlign: 'left' }}>{tr('카테고리명', 'Name')}</th><th style={{ width: 130 }}>{tr('하부 카테고리', 'Descendants')}</th><th style={{ width: 110 }}>{tr('영업자', 'Sales staff')}</th><th style={{ width: 90 }} /></tr></thead>
                <tbody>
                  {orderList.map((idx, i) => { const n = salesRows.find((x) => x.idx === idx); if (!n) return null; const bg = deepTint(n.deep); return (
                    <tr key={idx} data-deep={n.deep}>
                      <td style={{ background: bg, textAlign: 'center', padding: '6px 8px', borderRadius: '8px 0 0 8px' }}>{n.deep}</td>
                      <td style={{ background: bg, padding: '6px 8px' }}><b>{n.name}</b></td>
                      <td style={{ background: bg, textAlign: 'center', padding: '6px 8px' }}>{n.descendants}</td>
                      <td style={{ background: bg, textAlign: 'center', padding: '6px 8px' }}>{n.salesCount}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}><AButton size="xs" aria-label={tr('위로', 'Up')} disabled={!canWrite || i === 0} onClick={() => move(idx, -1)}>▲</AButton> <AButton size="xs" aria-label={tr('아래로', 'Down')} disabled={!canWrite || i === orderList.length - 1} onClick={() => move(idx, 1)}>▼</AButton></td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <DetailDrawer open={!!form} onClose={() => setForm(null)} title={form ? tr(`${STAFF_DEPT_TEXT[form.dept].name} ${form.mode === 'create' ? '등록' : '수정'}`, form.mode === 'create' ? 'New category' : 'Edit category') : ''} subtitle={form ? DEPTS.find((d) => d.key === form.dept)?.label : ''} wide
        footer={<>
          {form?.mode === 'edit' ? <AButton variant="danger" disabled={!canWrite || (form.node?.children ?? 0) > 0} onClick={() => form.node && setDel({ node: form.node, force: false })}>{adm.common.delete}</AButton> : null}
          <AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{form?.mode === 'create' ? tr('등록 하기', 'Register') : tr('수정 하기', 'Save')}</AButton>
          <AButton onClick={() => setForm(null)}>{tr('닫기', 'Close')}</AButton>
        </>}>
        {form && data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FieldRow label={tr('상위 카테고리', 'Parent')}><div style={{ paddingTop: 8 }} data-testid="upper-category">{upperName(form)}</div></FieldRow>
            <FieldRow label={tr('카테고리명', 'Name')} htmlFor="dp-name" required><AInput id="dp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={50} /></FieldRow>
            <Callout>{tr('권한 설정: 상위 메뉴를 켜면 하위 메뉴가 모두 선택되고, 하위 메뉴를 하나라도 켜면 상위 메뉴가 켜집니다. 부서마다 고를 수 있는 메뉴가 다릅니다(기존 화면과 동일).', 'Permissions: ticking a top menu selects all of its sub menus; ticking any sub menu turns its top menu on. Each department offers its own menus (as before).')}</Callout>
            {catalogue(form.dept).top.map((t) => (
              <div key={t.code} style={{ border: '1px solid var(--c-line-2)', borderRadius: 8, padding: '10px 12px' }}>
                <ACheckbox label={<b>{t.label}</b>} checked={form.top.has(t.code)} onChange={(e) => toggleTop(t.code, e.target.checked)} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 8, paddingLeft: 22 }}>
                  {(catalogue(form.dept).sub[t.code] ?? []).map((s) => <ACheckbox key={s.code} label={s.label} checked={form.sub.has(s.code)} onChange={(e) => toggleSub(t.code, s.code, e.target.checked)} />)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </DetailDrawer>

      <ConfirmDialog open={confirmSave} title={tr('카테고리 등록', 'Save category')} tone="info" loading={create.isPending || patch.isPending} onCancel={() => setConfirmSave(false)} onConfirm={save} body={<p>{tr('등록 하시겠습니까?', 'Save this category?')}</p>} />
      <ConfirmDialog open={!!del} title={tr('카테고리 삭제', 'Delete category')} tone="danger" loading={remove.isPending} confirmLabel={del?.staff ? tr('강제 삭제', 'Delete anyway') : adm.common.delete} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate({ idx: del.node.idx, force: !!del.staff && del.force })}
        body={<div><p><b>{del?.node.name}</b> — {tr('삭제 하시겠습니까?', 'delete this category?')}</p>{del?.staff ? <div className="u-mt-8"><Callout tone="warn">{tr(`이 카테고리에 속한 운영자 ${del.staff}명이 있습니다. 운영자의 부서 연결은 그대로 남습니다.`, `${del.staff} operators belong to this category; their department link will remain.`)}</Callout><div className="u-mt-8"><ACheckbox label={tr('그래도 삭제', 'Delete anyway')} checked={del.force} onChange={(e) => setDel({ ...del, force: e.target.checked })} /></div></div> : null}</div>} />
    </AdminPage>
  );
}
