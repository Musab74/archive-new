import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { AButton, ACheckbox, ASelect, Bar, Callout, ConfirmDialog, DataTable, DetailDrawer, DetailHeader, DetailPage, DetailTab, DetailTabs, InfoTable, MenuAction, SectionPanel, StatusBadge, YnBadge, type Column } from '../../../../shared/ui/admin';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { hasGrant } from '../../../../shared/auth/adminMenu';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { formatNumber } from '../../../../shared/utils/format';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { CompanyForm, diffPatchBody, fromCompany, validateCompanyForm, type CompanyFormValues, type FormErrors } from './CompanyForm';
import { companiesApi, type CompanyMemberRow, type CompanyStudyRow, type CompanyTermsV2 } from './companiesApi';
import { CellLink, CourseInfoDrawer, ProgressDrawer } from './CompanyStudyDrawers';
import { CompanyMemberInfoDrawer, MemberInfoLink } from './CompanyMemberInfoDrawer';

type TermRow = CompanyTermsV2['items'][number];
const SUB_SIZE = 20;
const thisYear = new Date().getFullYear();
const YEARS: { value: string; label: string }[] = [{ value: 'all', label: adm.companies.detail.termsAll }, ...Array.from({ length: 7 }, (_, i) => ({ value: String(thisYear - i), label: tr(`${thisYear - i}년`, String(thisYear - i)) }))];
const USE = { yes: tr('사용', 'On'), no: tr('미사용', 'Off') };

const termCols: Column<TermRow>[] = [
  { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => i + 1 },
  { key: 'courseName', header: adm.companies.detail.termsCols.course, render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
  { key: 'period', header: adm.companies.detail.termsCols.period, nowrap: true, render: (r) => `${r.start} ~ ${r.end}` },
  { key: 'count', header: adm.companies.detail.termsCols.count, align: 'right', nowrap: true, render: (r) => `${r.enrolled} / ${r.passed}` },
  { key: 'passRate', header: adm.companies.detail.termsCols.rate, width: 130, render: (r) => <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Bar value={r.passRate} tone={r.passRate >= 80 ? 'ok' : undefined} /><span style={{ fontSize: 12 }}>{r.passRate}%</span></div> },
  { key: 'price', header: adm.companies.detail.termsCols.price, align: 'right', render: (r) => formatNumber(r.price) },
  { key: 'refund', header: adm.companies.detail.termsCols.refund, align: 'right', render: (r) => formatNumber(r.refund) },
];
const ORDERS: { value: 'desc' | 'asc'; label: string }[] = [{ value: 'desc', label: tr('최근 회차부터', 'Newest first') }, { value: 'asc', label: tr('오래된 회차부터', 'Oldest first') }];
/**
 * company_read.php 수강생 정보 columns (same order and headers). 아이디/이름 open MemberInfo(ID) (member_info_pop.php) in a drawer,
 * like the PHP popup, so 사업주 관리(A1) alone is enough (the /admin/members/:id page needs 회원 관리 A2).
 */
const memberColsFor = (openMember: (id: string) => void): Column<CompanyMemberRow>[] => [
  { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 },
  { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <MemberInfoLink onClick={() => openMember(r.id)} label={tr(`${r.id} 수강생 상세 정보`, `${r.id} learner details`)}>{r.id}</MemberInfoLink> },
  { key: 'name', header: tr('이름', 'Name'), render: (r) => <MemberInfoLink onClick={() => openMember(r.id)}>{r.name ?? ''}</MemberInfoLink> },
  { key: 'birthDay', header: tr('생년월일', 'Birth date'), nowrap: true, render: (r) => r.birthDay ?? '' },
  { key: 'genderLabel', header: tr('성별', 'Gender'), align: 'center' },
  { key: 'email', header: tr('이메일', 'E-mail'), render: (r) => r.email ?? '' },
  { key: 'mobile', header: tr('휴대폰', 'Mobile'), nowrap: true, render: (r) => r.mobile ?? '' },
  { key: 'depart', header: tr('부서', 'Department'), render: (r) => r.depart ?? '' },
  { key: 'position', header: tr('직위', 'Title'), render: (r) => r.position ?? '' },
  { key: 'lastLogin', header: tr('최종로그인', 'Last login'), nowrap: true, render: (r) => r.lastLogin ?? '' },
  { key: 'regDate', header: tr('가입일', 'Joined'), nowrap: true, render: (r) => r.regDate ?? '' },
  { key: 'useYNLabel', header: tr('계정 사용유무', 'Account in use'), align: 'center' },
];
const two = (a: ReactNode, b: ReactNode) => <span>{a}<br />{b}</span>;

export default function CompanyDetailPage() {
  const { idx: idxParam = '' } = useParams();
  const idx = Number(idxParam);
  const s = adm.companies.detail;
  const navigate = useNavigate();
  const location = useLocation();
  /** company_read.php 목록 button carries pg/sw/col back: the list passes its query string in the navigation state. */
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch ?? '';
  const listUrl = `/admin/companies${listSearch}`;
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const { admin } = useAdminSession();
  const q = useQuery({ queryKey: ['admin', 'company', idx], queryFn: ({ signal }) => adminApi.company(idx, signal), enabled: Number.isInteger(idx) && idx > 0 });
  const meta = useQuery({ queryKey: ['admin', 'companies', 'meta'], queryFn: ({ signal }) => adminApi.companyMeta(signal), staleTime: 5 * 60_000 });
  const d = q.data; const co = d?.company;

  // ?year=all&order=asc = company_info_pop.php (CompanyInfo(CompanyCode) → /admin/companies/by-code/:code): every term, oldest first
  const [params] = useSearchParams();
  const yearParam = params.get('year');
  const [year, setYear] = useState<string>(yearParam === 'all' || /^\d{4}$/.test(yearParam ?? '') ? yearParam! : String(thisYear));
  const [order, setOrder] = useState<'asc' | 'desc'>(params.get('order') === 'asc' ? 'asc' : 'desc');
  const terms = useQuery({ queryKey: ['admin', 'company', idx, 'terms', year, order], queryFn: ({ signal }) => companiesApi.terms(idx, year === 'all' ? 'all' : Number(year), order, signal), enabled: !!co, placeholderData: keepPreviousData });
  const yearOptions = YEARS.some((y) => y.value === year) ? YEARS : [...YEARS, { value: year, label: tr(`${year}년`, year) }];

  // MemberInfo(ID) popup
  const [memberId, setMemberId] = useState<string | null>(null);
  const memberCols = useMemo(() => memberColsFor(setMemberId), []);
  const openCompany = async (code: string) => {
    setMemberId(null);
    if (co && code === co.companyCode) return;
    try { const r = await companiesApi.byCode(code); navigate(`/admin/companies/${r.idx}?year=all&order=asc`); }
    catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
  };

  const [mPage, setMPage] = useState(1); const [sPage, setSPage] = useState(1);
  const members = useQuery({ queryKey: ['admin', 'company', idx, 'members', mPage], queryFn: ({ signal }) => companiesApi.members(idx, { page: mPage, size: SUB_SIZE }, signal), enabled: !!co, placeholderData: keepPreviousData });
  const studies = useQuery({ queryKey: ['admin', 'company', idx, 'studies', sPage], queryFn: ({ signal }) => companiesApi.studies(idx, { page: sPage, size: SUB_SIZE }, signal), enabled: !!co, placeholderData: keepPreviousData });

  // 수강생 정보 "검색항목 엑셀 출력" (company_read_excel.php)
  const [exporting, setExporting] = useState(false);
  const exportMembers = async () => {
    setExporting(true);
    try { await companiesApi.downloadMembersCsv(idx); }
    catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
    finally { setExporting(false); }
  };

  // ProgressInfo / CourseInfo popups
  const [progressSeq, setProgressSeq] = useState<number | null>(null);
  const [courseCode, setCourseCode] = useState<string | null>(null);
  const studyCols: Column<CompanyStudyRow>[] = [
    { key: 'no', header: two(tr('번호', 'No.'), tr('구분', 'Type')), align: 'center', width: 64, render: (r) => two(r.no, r.serviceTypeLabel) },
    { key: 'name', header: two(tr('이름', 'Name'), 'ID'), render: (r) => <MemberInfoLink onClick={() => setMemberId(r.id)} label={tr(`${r.name ?? r.id} (${r.id}) 수강생 상세 정보`, `${r.id} learner details`)}>{two(r.name ?? '', r.id)}</MemberInfoLink> },
    { key: 'courseName', header: two(tr('과정명', 'Course'), tr('수강기간', 'Period')), render: (r) => <span><CellLink onClick={() => setCourseCode(r.lectureCode)}>{r.courseName}</CellLink><br />{r.period.start} ~ {r.period.end}<br /><small className="muted">{tr(`첨삭완료 : ${r.tutorLimitDay}까지`, `Marking done by ${r.tutorLimitDay}`)}</small></span> },
    { key: 'percent', header: tr('진도율', 'Progress'), width: 110, render: (r) => <CellLink onClick={() => setProgressSeq(r.studySeq)} label={tr(`진도율 ${r.percent}% 상세`, `Progress ${r.percent}% detail`)}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Bar value={r.percent} tone={r.percent >= 100 ? 'ok' : undefined} />{r.percent}%</span></CellLink> },
    { key: 'mid', header: two(tr('중간평가(%)', 'Midterm (%)'), tr('응시일', 'Taken')), align: 'center', render: (r) => r.midView },
    { key: 'test', header: two(tr('최종평가(%)', 'Final (%)'), tr('응시일', 'Taken')), align: 'center', render: (r) => r.testView },
    { key: 'report', header: two(tr('과제(%)', 'Assignment (%)'), tr('제출일', 'Submitted')), align: 'center', render: (r) => r.reportView },
    { key: 'pass', header: two(tr('총점', 'Score'), tr('수료여부', 'Completion')), align: 'center', render: (r) => two(r.totalScoreView, r.passOkLabel ? <StatusBadge tone={r.passOk === 'Y' ? 'ok' : 'warn'}>{r.passOkLabel}</StatusBadge> : '') },
    { key: 'tutorName', header: tr('교·강사', 'Tutor'), render: (r) => r.tutorName ?? '' },
    { key: 'company', header: two(tr('사업주', 'Company'), tr('부서', 'Department')), render: (r) => <span>{r.companyName ?? ''}{r.depart ? <><br />{tr('부서', 'Dept')} : {r.depart}</> : null}</span> },
    { key: 'certCount', header: two(tr('실명인증', 'ID checks'), tr('(건)', '(count)')), align: 'right', render: (r) => (r.certCount === null ? '' : r.certCount) },
  ];

  // edit (company_write.php?mode=edit): validate → confirm('수정 하시겠습니까?') → PATCH; 다시 작성 restores the loaded values
  const [editOpen, setEditOpen] = useState(false);
  const [editConfirm, setEditConfirm] = useState(false);
  const [pendingBody, setPendingBody] = useState<Record<string, unknown> | null>(null);
  const base = useMemo(() => (co ? fromCompany(co) : null), [co]);
  const [form, setForm] = useState<CompanyFormValues | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [availBlocked, setAvailBlocked] = useState(false);
  useEffect(() => { if (editOpen && base) { setForm(base); setErrors({}); } }, [editOpen, base]);
  const patch = useAdminMutation({
    fn: (body: Record<string, unknown>) => adminApi.patchCompany(idx, body), invalidate: [['admin', 'company', idx], ['admin', 'companies']], success: adm.companies.form.saved, onSuccess: () => { setEditConfirm(false); setEditOpen(false); },
    onError: (err) => { setEditConfirm(false); if (isAppError(err) && Array.isArray(err.details)) { const e: FormErrors = {}; for (const x of err.details as { path?: string; message?: string }[]) if (x.path) e[x.path as keyof FormErrors] = x.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); },
  });
  const submitEdit = () => { if (!form || !base) return; const e = validateCompanyForm(form, 'edit'); setErrors(e); if (Object.keys(e).length || availBlocked) return; const body = diffPatchBody(base, form); if (!Object.keys(body).length) { toast(adm.companies.form.noChange); setEditOpen(false); return; } setPendingBody(body); setEditConfirm(true); };

  // delete (409 → force)
  const [delOpen, setDelOpen] = useState(false);
  const [blocked, setBlocked] = useState<{ members: number; studies: number } | null>(null);
  const [force, setForce] = useState(false);
  const del = useAdminMutation({
    fn: (f: boolean) => adminApi.deleteCompany(idx, f), invalidate: [['admin', 'companies']], success: s.deleted, onSuccess: () => navigate(listUrl),
    onError: (err) => { if (isAppError(err) && err.code === 'CONFLICT' && (err.details as { requiresForce?: boolean } | undefined)?.requiresForce) { const x = err.details as { members: number; studies: number }; setBlocked({ members: x.members, studies: x.studies }); return; } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); },
  });

  const unitP = tr('명', ''); const unitC = tr('건', '');
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : undefined);
  const body = q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} />
    : q.isPending || !d || !co ? <><Skeleton height={140} /><Skeleton lines={10} /></> : (
    <>
      <DetailHeader
        icon="building"
        title={co.companyName}
        subtitle={<><span className="mono">{co.bizNo}</span>{co.companyId ? <> · ID <span className="mono">{co.companyId}</span></> : null}{co.manageCode ? <> · {tr('기업관리코드', 'Mgmt code')} <span className="mono">{co.manageCode}</span></> : null}</>}
        badges={<>
          {co.scaleLabel ? <StatusBadge tone="info">{co.scaleLabel}</StatusBadge> : null}
          <StatusBadge tone={co.sendSMS === 'N' ? 'warn' : 'ok'}>{tr('독려문자', 'Nudge SMS')} {co.sendSMSLabel}</StatusBadge>
          {co.cyberEnabled ? <StatusBadge tone="neutral">{tr('사이버교육센터 사용', 'Cyber centre on')}</StatusBadge> : null}
        </>}
        facts={[
          { label: s.kpi.members, value: `${formatNumber(d.stats.members)}${unitP}`, hint: tr(`사용 ${formatNumber(d.stats.activeMembers)}명`, `${formatNumber(d.stats.activeMembers)} active`) },
          { label: s.kpi.eduManagers, value: `${formatNumber(d.stats.eduManagers)}${unitP}` },
          { label: s.kpi.enrollments, value: `${formatNumber(d.stats.enrollments)}${unitC}`, hint: tr(`진행 ${formatNumber(d.stats.activeEnrollments)}건`, `${formatNumber(d.stats.activeEnrollments)} active`) },
          { label: s.kpi.passed, value: `${formatNumber(d.stats.passed)}${unitC}`, hint: pct(d.stats.passed, d.stats.enrollments), tone: 'ok' },
          { label: tr('영업담당자', 'Sales rep'), value: d.sales ? d.sales.name ?? d.sales.id : null, hint: d.sales?.team ?? undefined },
          { label: tr('등록일', 'Registered'), value: co.regDate ? String(co.regDate).slice(0, 10) : null },
        ]}
        back={{ to: listUrl, label: tr('목록', 'List') }}
        actions={<AButton variant="primary" icon="edit" onClick={() => setEditOpen(true)} disabled={!canWrite} title={readOnlyTitle}>{s.edit}</AButton>}
        dangerActions={<MenuAction danger onClick={() => { setBlocked(null); setForce(false); setDelOpen(true); }} disabled={!canWrite} title={readOnlyTitle}>{s.delete}</MenuAction>}
      />

      <DetailTabs>
        <DetailTab id="info" label={tr('기본 정보', 'Details')} icon="info">
          <InfoTable groups={[
            { title: s.basic, rows: [
              { label: tr('회사명', 'Company'), value: co.companyName }, { label: tr('회사 규모', 'Size'), value: co.scaleLabel },
              { label: tr('사업자 번호', 'Business no.'), value: <span className="mono">{co.bizNo}</span> }, { label: tr('사업주 ID', 'Company ID'), value: co.companyId ? <span className="mono">{co.companyId}</span> : null },
              { label: tr('HRD 번호', 'HRD number'), value: co.hrd }, { label: tr('대표자명', 'CEO'), value: co.ceo },
              { label: tr('업태 / 업종', 'Type / industry'), value: [co.uptae, co.upjong].filter(Boolean).join(' / ') }, { label: tr('등록일', 'Registered'), value: co.regDate },
            ] },
            { title: s.contact, rows: [
              { label: tr('대표 전화번호', 'Main phone'), value: co.tel }, { label: tr('고객센터 전화번호', 'Help-desk phone'), value: <span>{co.tel2 ?? '—'} <YnBadge value={co.csEnabled} yes={USE.yes} no={USE.no} /></span> },
              { label: tr('대표 팩스번호', 'Main fax'), value: co.fax }, { label: tr('고객센터 팩스번호', 'Help-desk fax'), value: co.fax2 },
              { label: tr('이메일', 'E-mail'), value: co.email }, { label: tr('계좌정보', 'Bank account'), value: [co.bankName, co.bankNumber].filter(Boolean).join(' ') },
              { label: tr('주소', 'Address'), value: [co.zipcode ? `[${co.zipcode}]` : '', co.address01, co.address02].filter(Boolean).join(' '), wide: true },
            ] },
            { title: s.manager, rows: [
              { label: tr('교육담당자', 'Manager'), value: [co.eduManager, co.eduManagerPhone, co.eduManagerEmail].filter(Boolean).join(' / '), wide: true },
              { label: s.managersAccounts, value: d.managers.length ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>{d.managers.map((m) => <span key={m.id}><MemberInfoLink onClick={() => setMemberId(m.id)}>{m.name ?? m.id}</MemberInfoLink> <span className="muted">({m.id}{m.useYN === 'N' ? tr(' · 미사용', ' · inactive') : ''})</span></span>)}</span> : null, wide: true },
            ] },
            { title: s.ops, rows: [
              { label: tr('기업관리코드', 'Management code'), value: co.manageCode ? <span className="mono">{co.manageCode}</span> : null }, { label: tr('독려문자 수신', 'Nudge SMS'), value: <StatusBadge tone={co.sendSMS === 'N' ? 'warn' : 'ok'}>{co.sendSMSLabel}</StatusBadge> },
              { label: tr('사이버교육센터', 'Cyber training centre'), value: <span>{co.cyberUrl ?? '—'} <YnBadge value={co.cyberEnabled} yes={USE.yes} no={USE.no} /></span>, wide: true },
              { label: tr('메모', 'Memo'), value: co.remark, wide: true },
            ] },
            { title: s.sales, rows: d.sales ? [
              { label: tr('영업담당자', 'Sales rep'), value: `${d.sales.name ?? ''} (${d.sales.id ?? ''})${d.sales.useYN === 'N' ? tr(' · 미사용 계정', ' · inactive account') : ''}` }, { label: tr('소속', 'Team'), value: d.sales.team },
              { label: tr('휴대폰', 'Mobile'), value: d.sales.mobile }, { label: s.salesPath, value: d.sales.deptPath || d.sales.deptName },
            ] : [{ label: tr('영업담당자', 'Sales rep'), value: <span className="muted">{tr('영업담당자 정보가 없습니다.', 'No sales rep on record.')}</span>, wide: true }] },
          ]} />
        </DetailTab>

        <DetailTab id="terms" label={tr('회차별 수강', 'Training terms')} icon="calendar" count={terms.data?.items.length ?? null}>
          <SectionPanel title={tr('수강 정보', 'Training terms')} count={terms.data?.items.length ?? null}
            toolbar={<><span className="muted" style={{ fontSize: 13 }}>{s.termsYear}</span><div style={{ width: 130 }}><ASelect aria-label={s.termsYear} value={year} onChange={(e) => setYear(e.target.value)} options={yearOptions} /></div><div style={{ width: 150 }}><ASelect aria-label={tr('회차 정렬', 'Term order')} value={order} onChange={(e) => setOrder(e.target.value === 'asc' ? 'asc' : 'desc')} options={ORDERS} /></div></>}>
            <DataTable columns={termCols} rows={terms.data?.items} rowKey={(r) => `${r.lectureCode}:${r.start}:${r.end}`} loading={terms.isPending || terms.isFetching} error={terms.error} onRetry={() => void terms.refetch()} emptyTitle={s.termsEmpty} dense />
          </SectionPanel>
        </DetailTab>

        <DetailTab id="members" label={s.members} icon="users" count={members.data?.total ?? d.stats.members}>
          <SectionPanel title={s.members} count={members.data?.total ?? d.stats.members}
            note={tr('아이디나 이름을 누르면 수강생 상세 정보가 열립니다.', 'Click an ID or name for the learner details.')}
            toolbar={<AButton size="sm" icon="download" onClick={() => void exportMembers()} loading={exporting} disabled={!members.data || members.data.total === 0}>{tr('검색항목 엑셀 출력', 'Export to Excel')}</AButton>}>
            <DataTable columns={memberCols} rows={members.data?.items} rowKey={(r) => r.idx} loading={members.isPending || members.isFetching} error={members.error} onRetry={() => void members.refetch()} page={mPage} size={SUB_SIZE} total={members.data?.total} onPageChange={setMPage} emptyTitle={tr('수강생 정보가 없습니다.', 'No members.')} dense />
          </SectionPanel>
        </DetailTab>

        <DetailTab id="studies" label={s.studies} icon="book" count={studies.data?.total ?? null}>
          <SectionPanel title={s.studies} count={studies.data?.total ?? null}
            note={tr('과정명은 과정 정보, 진도율은 차시별 진도와 로그를 엽니다.', 'Course opens the course info; progress opens the per-chapter record and log.')}>
            <DataTable columns={studyCols} rows={studies.data?.items} rowKey={(r) => r.studySeq} loading={studies.isPending || studies.isFetching} error={studies.error} onRetry={() => void studies.refetch()} page={sPage} size={SUB_SIZE} total={studies.data?.total} onPageChange={setSPage} emptyTitle={tr('수강 내역이 없습니다.', 'No enrollments.')} dense />
          </SectionPanel>
        </DetailTab>
      </DetailTabs>
    </>
  );
  return (
    <DetailPage>
      {body}

      <ProgressDrawer companyIdx={idx} seq={progressSeq} onClose={() => setProgressSeq(null)} canOpenStudy={hasGrant(admin, 'B5')} />
      <CompanyMemberInfoDrawer companyIdx={idx} id={memberId} onClose={() => setMemberId(null)} onCompany={(c) => void openCompany(c)} />
      <CourseInfoDrawer lectureCode={courseCode} onClose={() => setCourseCode(null)} canOpenCourse={hasGrant(admin, 'D1')} />

      <DetailDrawer open={editOpen} onClose={() => setEditOpen(false)} title={adm.companies.form.editTitle} subtitle={co ? `${co.companyName} · ${co.bizNo}` : ''} wide
        footer={<><AButton onClick={() => setEditOpen(false)}>{adm.common.cancel}</AButton><AButton onClick={() => { if (base) { setForm(base); setErrors({}); } }} disabled={!canWrite || !base}>{tr('다시 작성', 'Reset')}</AButton><AButton variant="primary" loading={patch.isPending} disabled={!canWrite || !form || availBlocked} onClick={submitEdit}>{adm.common.save}</AButton></>}>
        {form && base ? <CompanyForm mode="edit" values={form} onChange={setForm} meta={meta.data} errors={errors} excludeIdx={idx} original={base} onAvailability={setAvailBlocked} disabled={!canWrite} /> : null}
      </DetailDrawer>
      <ConfirmDialog open={editConfirm} tone="info" title={tr('수정 하시겠습니까?', 'Save these changes?')} body={pendingBody ? <p className="muted">{Object.keys(pendingBody).join(', ')}</p> : null} confirmLabel={adm.common.save}
        loading={patch.isPending} onCancel={() => setEditConfirm(false)} onConfirm={() => { if (pendingBody) patch.mutate(pendingBody); }} />

      <ConfirmDialog open={delOpen} title={s.delete} tone="danger" confirmLabel={blocked ? s.forceDelete : s.delete} loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(!!blocked && force)}
        body={<div><p>{tr('현재 사업주를 삭제하시겠습니까?', 'Delete this company?')}</p><p className="muted">{s.deleteBody}</p>{co ? <p className="u-mt-8"><b>{co.companyName}</b> <span className="mono">{co.bizNo}</span></p> : null}
          {blocked ? <div className="u-mt-16"><Callout tone="warn">{s.deleteBlocked(blocked.members, blocked.studies)}</Callout><div className="u-mt-8"><ACheckbox label={s.forceDelete} checked={force} onChange={(e) => setForce(e.target.checked)} /></div></div> : null}</div>} />
    </DetailPage>
  );
}
