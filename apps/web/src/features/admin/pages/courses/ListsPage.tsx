import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpListItem } from '../../../../shared/api/endpoints/admin-courses-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Card, ConfirmDialog, DataTable, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { MoveButtons } from './courses-parity.shared';
import { AnyGrantGate, G } from './courses-parity.grants';

const GUBUNS = ['1', '2', '3', '4'];

/** select2 on main_contents_list.php: type any part of "번호 | 과정코드 | 과정명" to narrow the 추가할 과정 list. */
export function filterCandidates<T extends { no: number; lectureCode: string; name?: string | null }>(items: readonly T[], q: string): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((c) => `${c.no} | ${c.lectureCode} | ${c.name ?? ''}`.toLowerCase().includes(needle));
}

/** Immutable move helper (shared with Design Studio homeSections tests). */
export function moveItem<T>(list: readonly T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const out = [...list];
  const [it] = out.splice(index, 1);
  out.splice(to, 0, it as T);
  return out;
}

/** main_contents.php (구분 목록 + 컨텐츠 개수) → main_contents_list.php (과정 추가 / 정렬하기 / 삭제) for the chosen gubun. */
function ListsPageBody() {
  const [p, setP] = useSearchState({ gubun: '1' });
  const gubun = GUBUNS.includes(p.gubun) ? p.gubun : '1';
  const { canWrite, readOnlyTitle } = useWriteGate();
  const overview = useQuery({ queryKey: ['admin', 'lists'], queryFn: ({ signal }) => cp.listsOverview(signal) });
  const q = useQuery({ queryKey: ['admin', 'lists', gubun], queryFn: ({ signal }) => cp.list(gubun, signal) });
  const cands = useQuery({ queryKey: ['admin', 'lists', gubun, 'candidates'], queryFn: ({ signal }) => cp.listCandidates(gubun, signal), enabled: canWrite });
  const [items, setItems] = useState<CpListItem[]>([]);
  useEffect(() => { if (q.data) setItems(q.data.items); }, [q.data]);
  const dirty = useMemo(() => JSON.stringify((q.data?.items ?? []).map((i) => i.idx)) !== JSON.stringify(items.map((i) => i.idx)), [q.data, items]);
  const inv = [['admin', 'lists'], ['catalog']];
  const [code, setCode] = useState('');
  const [find, setFind] = useState('');
  const { toast } = useToast();
  const shown = useMemo(() => filterCandidates(cands.data?.items ?? [], find), [cands.data, find]);
  const add = useAdminMutation({ fn: (c: string) => cp.addToList(gubun, c), invalidate: inv, success: tr('처리되었습니다.', 'Added.'), onSuccess: () => { setCode(''); setFind(''); } });
  const order = useAdminMutation({ fn: (ids: number[]) => cp.orderList(gubun, ids), invalidate: inv, success: tr('처리되었습니다.', 'Order saved.') });
  const [del, setDel] = useState<CpListItem | null>(null);
  const remove = useAdminMutation({ fn: (idx: number) => cp.removeFromList(gubun, idx), invalidate: inv, success: tr('처리되었습니다.', 'Removed.'), onSuccess: () => setDel(null) });

  type Ov = NonNullable<typeof overview.data>['items'][number];
  const ovCols: Column<Ov>[] = [
    { key: 'gubun', header: tr('번호', 'No.'), align: 'center', width: 80 },
    { key: 'title', header: tr('과정분류', 'List'), render: (r) => <a href={`#g${r.gubun}`} onClick={(e) => { e.preventDefault(); setP({ gubun: r.gubun }); }}><b>{r.title}</b></a> },
    { key: 'count', header: tr('컨텐츠 개수', 'Contents'), align: 'center', width: 150 },
  ];
  const columns: Column<CpListItem>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 50, render: (_r, i) => i + 1 },
    { key: 'order', header: tr('정렬순서', 'Order'), align: 'center', width: 80 },
    { key: 'lectureCode', header: tr('과정 코드', 'Course code'), align: 'center', width: 110, render: (r) => <b className="mono">{r.lectureCode}</b> },
    { key: 'name', header: tr('과정명', 'Course name'), render: (r) => r.name ?? '' },
    { key: 'courseUseLabel', header: tr('사이트 노출', 'Site visible'), align: 'center', width: 100, render: (r) => (r.courseVisible ? r.courseUseLabel : <StatusBadge tone="warn">{r.courseUseLabel || tr('미사용', 'Not used')}</StatusBadge>) },
    { key: 'move', header: tr('이동', 'Move'), align: 'center', width: 90, render: (_r, i) => <MoveButtons index={i} length={items.length} disabled={!canWrite} onMove={(d) => setItems(moveItem(items, i, d))} /> },
    { key: 'del', header: tr('삭제', 'Delete'), align: 'center', width: 70, render: (r) => <AButton size="xs" variant="danger" disabled={!canWrite} onClick={() => setDel(r)}>{tr('삭제', 'Delete')}</AButton> },
  ];
  const title = q.data?.title ?? overview.data?.items.find((i) => i.gubun === gubun)?.title ?? '';
  return (
    <AdminPage title={tr('PICK/TOP/NEW 컨텐츠 관리', 'PICK / TOP / NEW')} lead={tr('메인 화면 큐레이션 목록입니다. 구분을 고른 뒤 과정을 추가·삭제하고 ▲▼로 순서를 바꿔 "정렬하기"를 누르세요.', 'Home curation lists. Pick a list, add/remove courses, reorder with ▲▼ and press "Save order".')}>
      <Card title={tr('구분', 'Lists')}>
        <DataTable columns={ovCols} rows={overview.data?.items} rowKey={(r) => r.gubun} loading={overview.isPending} error={overview.error} onRetry={() => void overview.refetch()} onRowClick={(r) => setP({ gubun: r.gubun })} selectedKey={gubun} dense />
      </Card>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : (
        <Card title={tr(`${title} 관리`, `${title}`)} aside={<AButton size="sm" variant="primary" disabled={!canWrite} title={readOnlyTitle ?? (dirty ? tr('순서를 바꿨습니다. 정렬하기를 눌러 저장하세요.', 'Order changed — press to save.') : undefined)} loading={order.isPending} onClick={() => { if (!items.length) { toast(tr('등록된 과정이 없습니다.', 'No courses in this list.'), { tone: 'danger' }); return; } if (window.confirm(tr('정렬하시겠습니까?', 'Save this order?'))) order.mutate(items.map((i) => i.idx)); }}>{tr('정렬하기', 'Save order')}</AButton>}>
          {canWrite ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 200 }}><AInput aria-label={tr('과정 검색', 'Find course')} placeholder={tr('번호·과정코드·과정명 검색', 'Search no. / code / name')} value={find} onChange={(e) => { setFind(e.target.value); const next = filterCandidates(cands.data?.items ?? [], e.target.value); if (!next.some((c) => c.lectureCode === code)) setCode(next.length === 1 ? next[0]!.lectureCode : ''); }} /></div>
              <div style={{ flex: 1, maxWidth: 560 }}><ASelect aria-label={tr('추가할 과정', 'Course to add')} value={code} onChange={(e) => setCode(e.target.value)} options={[{ value: '', label: find.trim() ? tr(`검색 결과 ${shown.length}건`, `${shown.length} matches`) : tr('번호 | 과정코드 | 과정명', 'No. | code | name') }, ...shown.map((c) => ({ value: c.lectureCode, label: `${c.no} | ${c.lectureCode} | ${c.name ?? ''}` }))]} /></div>
              <AButton onClick={() => { if (!code) return; if (window.confirm(tr('추가하시겠습니까?', 'Add?'))) add.mutate(code); }} disabled={!code} loading={add.isPending}>{tr('과정 추가하기', 'Add course')}</AButton>
            </div>
          ) : null}
          <DataTable columns={columns} rows={q.isPending ? undefined : items} rowKey={(r) => r.idx} loading={q.isPending} dense emptyTitle={tr('등록된 과정이 없습니다.', 'No courses.')} emptyBody=" " />
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{tr('[각 행을 ▲▼로 옮긴 뒤 "정렬하기"를 누르세요.] 삭제는 즉시 반영됩니다(목록 행 삭제).', '[Move rows with ▲▼, then "Save order".] Delete applies immediately (the list row is removed).')}</p>
        </Card>
      )}
      <ConfirmDialog open={!!del} tone="danger" title={tr('과정 삭제', 'Remove course')} body={<p>{tr('삭제하시겠습니까?', 'Remove?')} <b>{del?.lectureCode}</b> {del?.name ?? ''}</p>} loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.idx)} />
    </AdminPage>
  );
}

/** PICK/TOP/NEW 컨텐츠 관리 (main_contents.php): menu E5. */
export default function ListsPage() {
  return <AnyGrantGate grants={G.lists}><ListsPageBody /></AnyGrantGate>;
}
