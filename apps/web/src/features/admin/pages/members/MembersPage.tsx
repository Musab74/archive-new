import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminMembersParityApi, MEMBER_SEARCH_COLS, type MemberParityRow } from '../../../../shared/api/endpoints/admin-members-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { useToast } from '../../../../app/providers/ToastProvider';
import { AButton, AdminPage, AInput, ASelect, DataTable, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { errorMessage } from '../../useAdminMutation';
import { MemberFormDrawer, TestAccountDialog } from './members-parity-form';

const DEFAULTS = { col: 'name_id', sw: '', q: '', useYN: '', eduManager: '', companyCode: '', page: 1 };
const SIZE = 20;

/** 회원관리 › 수강생 관리 (member.php): 탈퇴·휴면 제외, 이름순, 17개 열, 신규 등록 / 테스트 계정 생성 / 검색항목 엑셀 출력. */
export default function MembersPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, sw: p.sw });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin } = useAdminSession();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const isAdminDept = admin?.dept === 'A';
  const [createOpen, setCreateOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // col is only meaningful with a keyword, except "마지막로그인 1년이상" which filters on its own (member.php).
  const filters = useMemo(() => ({ col: p.sw || p.col === 'LastLogin' ? p.col : undefined, sw: p.sw || undefined, q: p.q || undefined, useYN: p.useYN || undefined, eduManager: p.eduManager || undefined, companyCode: p.companyCode || undefined, active: 'Y', sort: 'name' }), [p]);
  const query = useMemo(() => ({ ...filters, page: p.page, size: SIZE }), [filters, p.page]);
  const list = useQuery({ queryKey: ['admin', 'members', 'parity', query], queryFn: ({ signal }) => adminMembersParityApi.members(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const open = (r: MemberParityRow) => navigate(`/admin/members/${encodeURIComponent(r.id)}`);
  const link = (r: MemberParityRow, text: string | null | undefined) => <a href={`/admin/members/${encodeURIComponent(r.id)}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(r); }}>{text ?? ''}</a>;
  const columns: Column<MemberParityRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => total - (p.page - 1) * SIZE - i },
    { key: 'memberType', header: tr('구분', 'Type'), align: 'center', render: (r) => r.memberTypeLabel || r.memberType || '' },
    { key: 'id', header: tr('아이디', 'ID'), nowrap: true, render: (r) => <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><b>{link(r, r.id)}</b>{r.testId ? <StatusBadge>{tr('테스트', 'Test')}</StatusBadge> : null}</span> },
    { key: 'name', header: tr('이름', 'Name'), nowrap: true, render: (r) => link(r, r.name) },
    { key: 'companyName', header: tr('사업주', 'Company'), render: (r) => link(r, r.companyName ?? '') },
    { key: 'birthDay', header: tr('생년월일', 'Birth date'), nowrap: true, render: (r) => r.birthDay ?? '' },
    { key: 'gender', header: tr('성별', 'Gender'), align: 'center', render: (r) => r.genderLabel },
    { key: 'email', header: tr('이메일', 'Email'), render: (r) => r.email ?? '' },
    { key: 'mobile', header: tr('휴대폰', 'Mobile'), nowrap: true, render: (r) => r.mobile ?? '' },
    { key: 'depart', header: tr('부서', 'Department'), render: (r) => r.depart ?? '' },
    { key: 'position', header: tr('직위', 'Title'), render: (r) => r.position ?? '' },
    { key: 'salesName', header: tr('영업담당자', 'Sales rep'), render: (r) => r.salesName ?? '' },
    { key: 'salesDeptName', header: tr('영업담당자 소속', 'Sales team'), render: (r) => r.salesDeptName ?? '' },
    { key: 'lastLogin', header: tr('최종로그인', 'Last login'), nowrap: true, render: (r) => r.lastLogin ?? '' },
    { key: 'regDate', header: tr('가입일', 'Joined'), nowrap: true, render: (r) => (r.regDate ?? '').slice(0, 10) },
    { key: 'protectId', header: tr('대리수강 방지', 'Proxy guard'), align: 'center', render: (r) => r.protectIdLabel },
    { key: 'useYN', header: tr('계정 사용유무', 'Account'), align: 'center', render: (r) => (r.useYN === 'N' ? <StatusBadge tone="warn">{r.useYNLabel}</StatusBadge> : r.useYNLabel) },
  ];
  const download = async () => {
    setDownloading(true);
    try { await adminMembersParityApi.downloadMembersCsv(filters); } catch (e) { toast(errorMessage(e), { tone: 'danger' }); } finally { setDownloading(false); }
  };
  return (
    <AdminPage title={tr('수강생 관리', 'Learners')} lead={tr('탈퇴·휴면 회원은 제외됩니다(탈퇴회원 관리 메뉴). 생년월일·이메일·휴대폰은 마스킹되어 보이며, 상세 화면에서 사유를 남기고 열람할 수 있습니다.', 'Withdrawn and dormant members are excluded. Contacts are masked; open the detail page to view them with a logged reason.')}
      actions={isAdminDept ? <><AButton variant="primary" onClick={() => setCreateOpen(true)} disabled={!canWrite} title={readOnlyTitle}>{tr('신규 등록', 'New')}</AButton><AButton onClick={() => setTestOpen(true)} disabled={!canWrite} title={readOnlyTitle}>{tr('테스트 계정 생성하기', 'Create test account')}</AButton></> : undefined}>
      <FilterBar onSubmit={() => setP({ ...form, q: '', useYN: '', eduManager: '', companyCode: '' }, true)} onReset={() => { setForm({ col: 'name_id', sw: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="m-col" width={200}><ASelect id="m-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={MEMBER_SEARCH_COLS.map((c) => ({ value: c.value, label: tr(c.label, c.en) }))} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="m-sw" width={300}><AInput id="m-sw" value={form.sw} placeholder={tr('검색어를 입력하세요', 'Enter a keyword')} onChange={(e) => setForm({ ...form, sw: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={open} emptyTitle={tr('등록된 수강생 정보가 없습니다.', 'No learners found.')} dense />
      {isAdminDept ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><AButton icon="download" loading={downloading} onClick={() => void download()}>{tr('검색항목 엑셀 출력', 'Export search (CSV)')}</AButton></div> : null}
      <MemberFormDrawer open={createOpen} mode="new" onClose={() => setCreateOpen(false)} onSaved={(id) => navigate(`/admin/members/${encodeURIComponent(id)}`)} />
      <TestAccountDialog open={testOpen} onClose={() => setTestOpen(false)} />
    </AdminPage>
  );
}
