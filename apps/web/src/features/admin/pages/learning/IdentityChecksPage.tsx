import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminLearningApi, type IdentityRow } from '../../../../shared/api/endpoints/admin-learning';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, DataTable, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { MemberLink, StudyLink, useCsvDownload } from './learningShared';

const DEFAULTS = { col: 'Name', q: '', page: 1 };
/** PHP column names (a.ID, a.Name, c.CompanyName) → the API's col. */
const normCol = (v: string | null | undefined) => { const raw = String(v ?? '').replace(/^[a-z]\./, ''); return raw === 'ID' || raw === 'Name' || raw === 'CompanyName' ? raw : 'Name'; };
const SIZE = 30;

/** certification_list.php — 본인인증 모니터링 (B2): UserCertOTP, newest first. */
export default function IdentityChecksPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [sp] = useSearchParams();
  const [form, setForm] = useState({ col: normCol(p.col), q: sp.get('sw') ?? p.q });
  /** certification_list.php?col=a.ID&sw=<ID> (이상데이터 상세 "본인인증 목록에서 검색"): accept the PHP names and search at once. */
  useEffect(() => {
    const sw = sp.get('sw'); if (sw === null) return;
    const col = normCol(sp.get('col'));
    setForm({ col, q: sw }); setP({ col, q: sw, page: 1 }, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { canWrite } = useWriteGate();
  const [exporting, download] = useCsvDownload();
  const query = useMemo(() => ({ col: normCol(p.col), q: (sp.get('sw') ?? p.q) || undefined, page: p.page, size: SIZE }), [p, sp]);
  const list = useQuery({ queryKey: ['admin', 'learning', 'identity-checks', query], queryFn: ({ signal }) => adminLearningApi.identityChecks(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const columns: Column<IdentityRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => firstNo - i },
    { key: 'companyName', header: tr('사업주', 'Company'), render: (r) => r.companyName ?? '' },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <MemberLink id={r.id} /> },
    { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
    { key: 'courseName', header: tr('교육과정', 'Course'), render: (r) => <span title={r.lectureCode ?? ''}>{r.courseName ?? r.lectureCode ?? ''}</span> },
    { key: 'certifiedAt', header: tr('인증시간', 'Verified at'), nowrap: true, render: (r) => r.certifiedAt ?? '' },
    { key: 'sentAt', header: tr('전송시간', 'Sent at'), nowrap: true, render: (r) => r.sentAt ?? '' },
    { key: 'ok', header: tr('결과', 'Result'), align: 'center', render: (r) => <StatusBadge tone={r.ok ? 'ok' : 'warn'}>{r.ok ? tr('성공', 'OK') : tr('실패', 'Fail')}</StatusBadge> },
    { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => (r.studySeq ? <StudyLink seq={r.studySeq} /> : '') },
  ];
  return (
    <AdminPage title={tr('본인인증 모니터링', 'Identity-check monitoring')} lead={tr('학습 중 본인인증(OTP) 요청·결과 내역(UserCertOTP)입니다. 최신순.', 'Identity (OTP) check requests and results during study (UserCertOTP), newest first.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'Name', q: '' }); reset(); }}
        extra={canWrite ? <AButton onClick={() => void download(() => adminLearningApi.downloadIdentityCsv({ col: p.col, q: p.q || undefined }))} loading={exporting} disabled={total === 0}>{tr('검색항목 엑셀(CSV) 출력', 'Export CSV')}</AButton> : null}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="ic-col" width={130}><ASelect id="ic-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Name', label: tr('이름', 'Name') }, { value: 'ID', label: tr('아이디', 'User ID') }, { value: 'CompanyName', label: tr('사업주명', 'Company') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="ic-q" width={260}><AInput id="ic-q" value={form.q} placeholder={tr('검색어를 입력하세요', 'Enter a keyword')} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.seq} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('등록된 수강생 정보가 없습니다.', 'No records.')} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} dense />
    </AdminPage>
  );
}
