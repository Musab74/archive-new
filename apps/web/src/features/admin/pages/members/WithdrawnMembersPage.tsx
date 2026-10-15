import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { staffParityApi, type WithdrawnParityRow } from './staffApi';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ConfirmDialog, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

/** member_out.php: the search select starts on 이름; include_top.php $page_size = 30. */
const DEFAULTS = { col: 'Name', q: '', page: 1 };
const SIZE = 30;

/** member_out.php — withdrawn members (MemberOut=Y AND Sleep=N, newest sign-up first) with masked contacts and 탈퇴회원복구. 휴대폰 search needs the full number (exact match, like 수강생 관리). */
export default function WithdrawnMembersPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'withdrawn-members', query], queryFn: ({ signal }) => staffParityApi.withdrawn(query, signal), placeholderData: keepPreviousData });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const restore = useAdminMutation({ fn: (ids: string[]) => adminApi.restoreMembers(ids), invalidate: [['admin', 'members'], ['admin', 'withdrawn-members']], success: (r) => tr(`${r.restored ?? 0}명을 복구했습니다.`, `${r.restored ?? 0} members restored.`), onSuccess: () => { setChecked(new Set()); setConfirm(false); } });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const rows = list.data?.items ?? [];
  const allOn = rows.length > 0 && rows.every((r) => checked.has(r.id));
  const toggleAll = (on: boolean) => setChecked((s) => { const n = new Set(s); for (const r of rows) { if (on) n.add(r.id); else n.delete(r.id); } return n; });
  const columns: Column<WithdrawnParityRow>[] = [
    { key: 'check', header: <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={allOn} onChange={(e) => toggleAll(e.target.checked)} disabled={!canWrite} />, width: 36, align: 'center', render: (r) => <input type="checkbox" aria-label={r.id} checked={checked.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} disabled={!canWrite} /> },
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> },
    { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
    { key: 'companyName', header: tr('사업주', 'Company'), render: (r) => r.companyName || r.companyLabel || tr('일반회원', 'General member') },
    { key: 'birthDay', header: tr('생년월일', 'Birth'), nowrap: true, render: (r) => r.birthDay ?? '' },
    { key: 'gender', header: tr('성별', 'Gender'), align: 'center', render: (r) => r.genderLabel || (r.gender === 'M' ? tr('남성', 'Male') : r.gender === 'F' ? tr('여성', 'Female') : (r.gender ?? '')) },
    { key: 'email', header: tr('이메일', 'E-mail'), render: (r) => r.email ?? '' },
    { key: 'mobile', header: tr('휴대폰', 'Mobile'), nowrap: true, render: (r) => r.mobile ?? '' },
    { key: 'depart', header: tr('부서', 'Dept'), render: (r) => r.depart ?? '' },
    { key: 'position', header: tr('직위', 'Title'), render: (r) => r.position ?? '' },
    { key: 'lastLogin', header: tr('최종로그인', 'Last login'), nowrap: true, render: (r) => r.lastLogin ?? '' },
    { key: 'regDate', header: tr('가입일', 'Joined'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'memberOutDate', header: tr('탈퇴일', 'Withdrawn'), nowrap: true, render: (r) => r.memberOutDate ?? '' },
  ];
  return (
    <AdminPage title={tr('탈퇴회원 관리', 'Withdrawn members')} lead={tr('탈퇴(MemberOut=Y) 회원입니다. 연락처는 기존 화면처럼 마스킹됩니다. 선택 후 복구하면 다시 로그인할 수 있습니다.', 'Members with MemberOut=Y. Contacts are masked like the legacy screen. Restore selected members to let them sign in again.')}
      actions={<AButton variant="primary" disabled={!canWrite || checked.size === 0} title={readOnlyTitle} onClick={() => setConfirm(true)}>{tr('탈퇴회원복구', 'Restore')} ({checked.size})</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'Name', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="wd-col" width={140}><ASelect id="wd-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Name', label: tr('이름', 'Name') }, { value: 'ID', label: tr('아이디', 'User ID') }, { value: 'Mobile', label: tr('휴대폰', 'Mobile') }, { value: 'CompanyName', label: tr('사업주명', 'Company') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="wd-q" width={240}><AInput id="wd-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('탈퇴회원 정보가 없습니다.', 'No withdrawn members.')} dense />
      <ConfirmDialog open={confirm} title={tr('탈퇴회원 복구', 'Restore members')} loading={restore.isPending} onCancel={() => setConfirm(false)} onConfirm={() => restore.mutate([...checked])} body={<p>{tr(`${checked.size}명의 탈퇴를 취소하고 다시 사용 가능하게 합니다.`, `${checked.size} members will be restored.`)}</p>} />
      {!canWrite ? <p className="muted u-mt-8" style={{ fontSize: 12 }}>{adm.readOnly}</p> : null}
    </AdminPage>
  );
}
