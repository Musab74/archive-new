import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { CurationList } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, Callout, Card, DataTable, StatusBadge, TabStrip, YnBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const GUBUNS = [{ key: '1', label: 'PICK' }, { key: '2', label: 'TOP10' }, { key: '3', label: 'NEW' }, { key: '4', label: 'HRDe' }];
type Item = CurationList['items'][number];

/** Immutable move helper (shared with Design Studio homeSections tests). */
export function moveItem<T>(list: readonly T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const out = [...list];
  const [it] = out.splice(index, 1);
  out.splice(to, 0, it as T);
  return out;
}

export default function ListsPage() {
  const [p] = useSearchState({ gubun: '1' });
  const gubun = GUBUNS.some((g) => g.key === p.gubun) ? p.gubun : '1';
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'lists', gubun], queryFn: ({ signal }) => adminApi.curationList(gubun, signal) });
  const [items, setItems] = useState<Item[]>([]);
  const [code, setCode] = useState('');
  useEffect(() => { if (q.data) setItems(q.data.items); }, [q.data]);
  const dirty = useMemo(() => JSON.stringify((q.data?.items ?? []).map((i) => i.lectureCode)) !== JSON.stringify(items.map((i) => i.lectureCode)), [q.data, items]);
  const save = useAdminMutation({ fn: (codes: string[]) => adminApi.putCurationList(gubun, codes), invalidate: [['admin', 'lists', gubun], ['catalog']], success: (r) => adm.courses.lists.saved(Number(r.count ?? 0)) });
  const l = adm.courses.lists;
  const add = () => { const c = code.trim(); if (!c || items.some((i) => i.lectureCode === c)) return; setItems([...items, { idx: -Date.now(), lectureCode: c, order: items.length + 1, useYN: 'Y', regDate: null, regId: null, name: null, ctype: null, courseVisible: true }]); setCode(''); };
  const columns: Column<Item>[] = [
    { key: 'order', header: l.cols.order, align: 'right', width: 60, render: (_r, i) => i + 1 },
    { key: 'lectureCode', header: l.cols.code, nowrap: true, render: (r) => <b className="mono">{r.lectureCode}</b> },
    { key: 'name', header: l.cols.name, render: (r) => r.name ?? <span className="muted">(저장 후 과정명 표시)</span> },
    { key: 'ctype', header: l.cols.ctype, align: 'center', render: (r) => r.ctype ?? '' },
    { key: 'courseVisible', header: l.cols.visible, align: 'center', render: (r) => (r.courseVisible ? <YnBadge value="Y" yes="노출" /> : <StatusBadge tone="warn">과정 숨김</StatusBadge>) },
    { key: 'regDate', header: l.cols.regDate, nowrap: true, render: (r) => r.regDate ?? '' },
    { key: '_act', header: '', width: 170, render: (_r, i) => <span style={{ display: 'inline-flex', gap: 4 }}><AButton size="xs" disabled={!canWrite || i === 0} onClick={() => setItems(moveItem(items, i, -1))} aria-label={l.up}>▲</AButton><AButton size="xs" disabled={!canWrite || i === items.length - 1} onClick={() => setItems(moveItem(items, i, 1))} aria-label={l.down}>▼</AButton><AButton size="xs" variant="danger" disabled={!canWrite} onClick={() => setItems(items.filter((_x, j) => j !== i))}>{l.remove}</AButton></span> },
  ];
  return (
    <AdminPage title={l.title} lead={l.lead} actions={<AButton variant="primary" disabled={!canWrite || !dirty} title={readOnlyTitle} loading={save.isPending} onClick={() => save.mutate(items.map((i) => i.lectureCode))}>{l.save}</AButton>}>
      <TabStrip label="구분" items={GUBUNS.map((g) => ({ key: g.key, label: g.label, to: `/admin/lists?gubun=${g.key}` }))} value={gubun} />
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : (
        <Card title={`${q.data?.label ?? ''} · ${items.length}개`} aside={dirty ? <StatusBadge tone="warn">{l.dirty}</StatusBadge> : null}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <AInput value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder={l.addPlaceholder} style={{ width: 260 }} disabled={!canWrite} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            <AButton onClick={add} disabled={!canWrite || !code}>{l.add}</AButton>
          </div>
          <DataTable columns={columns} rows={q.isPending ? undefined : items} rowKey={(r) => r.lectureCode} loading={q.isPending} dense emptyTitle="목록이 비어 있습니다." emptyBody="과정코드를 추가하고 저장하세요." />
          {!canWrite ? <Callout tone="warn" className="u-mt-8">{adm.readOnly}</Callout> : null}
        </Card>
      )}
    </AdminPage>
  );
}
