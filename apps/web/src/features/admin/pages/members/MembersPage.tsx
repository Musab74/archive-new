import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { MemberRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, ASelect, DataTable, FilterBar, FilterField, StatusBadge, YnBadge, type Column } from '../../../../shared/ui/admin';
import { adm } from '../../strings';

const DEFAULTS = { q: '', useYN: '', eduManager: '', companyCode: '', page: 1 };
const SIZE = 20;
const YN = [{ value: '', label: adm.common.all }, { value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }];

export default function MembersPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q, useYN: p.useYN, eduManager: p.eduManager, companyCode: p.companyCode });
  const navigate = useNavigate();
  const query = useMemo(() => ({ q: p.q || undefined, useYN: p.useYN || undefined, eduManager: p.eduManager || undefined, companyCode: p.companyCode || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'members', query], queryFn: ({ signal }) => adminApi.members(query, signal), placeholderData: keepPreviousData });
  const c = adm.members.cols;
  const columns: Column<MemberRow>[] = [
    { key: 'id', header: c.id, sortable: true, nowrap: true, render: (r) => <b>{r.id}</b> },
    { key: 'name', header: c.name, sortable: true },
    { key: 'companyName', header: c.company, render: (r) => r.companyName ? <span title={r.companyCode ?? ''}>{r.companyName}</span> : (r.companyCode ?? '') },
    { key: 'depart', header: c.depart, render: (r) => [r.depart, r.position].filter(Boolean).join(' · ') },
    { key: 'memberType', header: c.memberType, align: 'center' },
    { key: 'useYN', header: c.useYN, align: 'center', render: (r) => <YnBadge value={r.useYN} /> },
    { key: 'eduManager', header: c.eduManager, align: 'center', render: (r) => (r.eduManager ? <StatusBadge tone="info">담당자</StatusBadge> : '') },
    { key: 'flags', header: c.flags, render: (r) => <span style={{ display: 'inline-flex', gap: 4 }}>{r.sleep ? <StatusBadge tone="warn">휴면</StatusBadge> : null}{r.memberOut ? <StatusBadge tone="danger">탈퇴</StatusBadge> : null}{r.testId ? <StatusBadge>테스트</StatusBadge> : null}{r.passChange === 'N' ? <StatusBadge tone="info">비번변경 필요</StatusBadge> : null}</span> },
    { key: 'enrollments', header: c.enrollments, align: 'right', sortable: true },
    { key: 'lastLogin', header: c.lastLogin, nowrap: true, sortable: true, render: (r) => r.lastLogin ?? '—' },
    { key: 'regDate', header: c.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '—' },
  ];
  return (
    <AdminPage title={adm.members.title} lead={adm.members.lead}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '', useYN: '', eduManager: '', companyCode: '' }); reset(); }}>
        <FilterField label={adm.members.q} htmlFor="m-q" width={220}><AInput id="m-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={adm.members.companyCode} htmlFor="m-cc" width={140}><AInput id="m-cc" value={form.companyCode} onChange={(e) => setForm({ ...form, companyCode: e.target.value })} /></FilterField>
        <FilterField label={adm.members.useYN} htmlFor="m-use" width={110}><ASelect id="m-use" value={form.useYN} onChange={(e) => setForm({ ...form, useYN: e.target.value })} options={YN} /></FilterField>
        <FilterField label={adm.members.eduManager} htmlFor="m-em" width={110}><ASelect id="m-em" value={form.eduManager} onChange={(e) => setForm({ ...form, eduManager: e.target.value })} options={YN} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => navigate(`/admin/members/${encodeURIComponent(r.id)}`)} dense />
    </AdminPage>
  );
}
