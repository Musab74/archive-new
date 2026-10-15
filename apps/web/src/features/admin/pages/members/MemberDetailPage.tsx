import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { adminMembersParityApi, type MemberEditForm, type MemberParityDetail } from '../../../../shared/api/endpoints/admin-members-parity';
import { adminStudiesParityApi } from '../../../../shared/api/endpoints/admin-studies-parity';
import { AButton, AInput, ASelect, ATextarea, Callout, ConfirmDialog, DataTable, DescList, DetailHeader, DetailPage, DetailTab, DetailTabs, FieldRow, InfoTable, MenuAction, PanelGrid, SectionPanel, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { Modal } from '../../../../shared/ui/Modal';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { errorMessage, useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { CompanyPicker, MemberFormDrawer, PrivacyReasonDialog } from './members-parity-form';
import { membersListHref } from './members-parity-nav';
import { MemberInquiryDrawer, MemberProgressDrawer } from './members-parity-progress';
import { hasGrant } from '../../../../shared/auth/adminMenu';

type Enrollment = MemberParityDetail['enrollments'][number];
type Login = MemberParityDetail['loginHistory'][number];
type Cert = MemberParityDetail['certHistory'][number];
type Managed = MemberParityDetail['managedCompanies'][number];
type Phone = MemberParityDetail['counselPhone'][number];
type Inquiry = MemberParityDetail['inquiries'][number];
type RevealKey = 'BirthDay' | 'Email' | 'Tel' | 'Mobile';
const REVEAL_LABEL: Record<RevealKey, string> = { BirthDay: '생년월일', Email: '이메일', Tel: '전화번호', Mobile: '휴대폰' };

/** Numbering like the PHP lists: total, total-1, … */
const desc = (total: number) => (_r: unknown, i: number) => total - i;

const linkBtn = { background: 'none', border: 0, padding: 0, color: 'var(--link, #1e6bd6)', cursor: 'pointer', textDecoration: 'underline' } as const;

/**
 * 진도율 / 진도 로그 open progress_info_pop.php. Staff with a 학습관리 grant (B5/B1) go to the enrollment page; staff with only
 * 수강생 관리 (A2) get the same popup in a drawer (`onProgress`), because the PHP popup only checked the admin login.
 */
const enrollCols = (total: number, memberId: string, memberName: string, onProgress?: (seq: number) => void): Column<Enrollment>[] => [
  // 구분 = $ServiceType_array[ServiceType] like member_read.php (no entry for 'A', so 패키지 rows show an empty 구분 there).
  { key: 'no', header: <>{tr('번호', 'No.')}<br />{tr('구분', 'Type')}</>, align: 'center', render: (r, i) => <>{total - i}<br /><small className="muted">{r.serviceTypeLabelPhp ?? r.serviceTypeLabel ?? ''}</small></> },
  // member_read.php opened member_info_pop.php here; every section of that popup is on this page, so the link opens the 기본 정보 tab.
  { key: 'name', header: <>{tr('이름', 'Name')}<br />ID</>, render: (r) => <Link to="?tab=info" title={tr('수강생 상세 정보', 'Learner details')}>{r.memberName ?? memberName}<br /><small className="muted">{memberId}</small></Link> },
  { key: 'course', header: <>{tr('과정명', 'Course')}<br />{tr('수강기간', 'Period')}</>, render: (r) => <><small style={{ color: r.packageYN === 'Y' ? 'var(--info, #1e6bd6)' : 'var(--muted, #888)' }}>[{r.packageYN === 'Y' ? tr('패키지', 'Package') : tr('단과', 'Single')}]</small> <b title={r.lectureCode}>{r.courseName}</b><br /><small>{r.period.start} ~ {r.period.end}</small></> },
  { key: 'percent', header: tr('진도율', 'Progress'), align: 'center', render: (r) => (onProgress
    ? <button type="button" style={linkBtn} title={`${r.formatted} · ${tr('저장값', 'stored')} ${r.storedProgress}%`} onClick={() => onProgress(r.studySeq)}>{r.percent}%</button>
    : <Link to={`/admin/studies/${r.studySeq}`} title={`${r.formatted} · ${tr('저장값', 'stored')} ${r.storedProgress}%`}>{r.percent}%</Link>) },
  { key: 'log', header: tr('진도 로그', 'Progress log'), align: 'center', render: (r) => (onProgress
    ? <AButton size="xs" onClick={() => onProgress(r.studySeq)}>{tr('보기', 'View')}</AButton>
    : <AButton size="xs" to={`/admin/studies/${r.studySeq}?tab=learning`}>{tr('보기', 'View')}</AButton>) },
  { key: 'passOk', header: tr('수료여부', 'Completion'), align: 'center', render: (r) => (r.passOkRaw === 'Y' ? <StatusBadge tone="ok">{tr('수료', 'Completed')}</StatusBadge> : r.passOkRaw === 'N' ? <StatusBadge tone="warn">{tr('미수료', 'Not completed')}</StatusBadge> : '') },
  { key: 'studyEnd', header: tr('수강마감', 'Closed'), align: 'center', render: (r) => (r.studyEnd ? <><StatusBadge tone="info">{tr('마감완료', 'Closed')}</StatusBadge>{r.studyEndInPeriod ? <><br /><small style={{ color: 'var(--warn, #c77700)' }}>{tr('기간중', 'In period')}</small></> : null}</> : <StatusBadge tone="warn">{tr('미마감', 'Open')}</StatusBadge>) },
  { key: 'tutor', header: tr('교·강사', 'Tutor'), render: (r) => r.tutorName ?? '' },
  { key: 'company', header: <>{tr('사업주', 'Company')}<br />{tr('부서', 'Dept')}</>, render: (r) => <>{r.companyName ?? ''}{r.depart ? <><br /><small>{tr('부서', 'Dept')} : {r.depart}</small></> : null}</> },
  { key: 'certCount', header: <>{tr('실명인증', 'ID checks')}<br />({tr('건', 'n')})</>, align: 'right', render: (r) => r.certCount ?? '' },
];

export default function MemberDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { admin } = useAdminSession();
  const { canWrite, readOnlyTitle } = useWriteGate();
  // 목록 keeps pg/col/sw like member_read.php: the list passes its query string in the navigation state (sessionStorage after a reload).
  const listHref = membersListHref(location.state);
  const q = useQuery({ queryKey: ['admin', 'member', id], queryFn: ({ signal }) => adminMembersParityApi.member(id, signal), enabled: !!id });
  const d = q.data;
  const p = d?.profile;
  const invalidate = [['admin', 'member', id], ['admin', 'members']];

  // 개인정보 열람 (InformationProtectionLog)
  const [revealed, setRevealed] = useState<Partial<Record<RevealKey, string>>>({});
  const [reason, setReason] = useState<{ kind: 'reveal'; field: RevealKey } | { kind: 'edit' } | null>(null);
  const [editInitial, setEditInitial] = useState<MemberEditForm | null>(null);
  useEffect(() => { setRevealed({}); }, [id]);
  const url = `/admin/members/${id}`;
  const reveal = useAdminMutation({ fn: (v: { field: RevealKey; gubun: string; reason: string }) => adminMembersParityApi.reveal(id, { ...v, url }), onSuccess: (r, v) => { setRevealed((s) => ({ ...s, [v.field]: r.value || '-' })); setReason(null); } });
  const editForm = useAdminMutation({ fn: (v: { gubun: string; reason: string }) => adminMembersParityApi.editForm(id, { ...v, url }), onSuccess: (r) => { setReason(null); setEditInitial(r); } });

  // member_script.php actions
  const [confirm, setConfirm] = useState<'pcd' | 'out' | 'use' | 'delete' | null>(null);
  const initPw = useAdminMutation({ fn: () => adminMembersParityApi.initPassword(id), success: tr('비밀번호가 초기화되었습니다.', 'Password reset to 1111.'), invalidate, onSuccess: () => setConfirm(null) });
  const withdraw = useAdminMutation({ fn: () => adminMembersParityApi.withdraw(id), success: tr('탈퇴 처리가 완료되었습니다.', 'Member withdrawn.'), invalidate, onSuccess: () => { setConfirm(null); navigate(listHref); } });
  const setUse = useAdminMutation({ fn: (v: 'Y' | 'N') => adminMembersParityApi.setUse(id, v), success: tr('사용여부가 변경되었습니다.', 'Account status changed.'), invalidate, onSuccess: () => setConfirm(null) });
  const del = useAdminMutation({ fn: (r: string) => adminMembersParityApi.deleteData(id, r), success: tr('삭제되었습니다.', 'Deleted.'), invalidate: [['admin', 'members']], onSuccess: () => { setConfirm(null); navigate(listHref); } });
  // 회원으로 로그인 (member_login.php): the tab is opened inside the click (popup blockers), then pointed at the learner site once the session exists.
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const loginAs = async () => {
    const w = window.open('about:blank', '_blank');
    setLoginBusy(true);
    try {
      const r = await adminMembersParityApi.loginAs(id);
      setLoginOpen(false);
      if (w) w.location.href = r.url || '/'; else window.open(r.url || '/', '_blank');
      toast(tr(`[${r.id}] 회원으로 로그인했습니다. 새 탭에서 학습자 사이트가 열립니다.`, `Signed in as ${r.id}; the learner site opens in a new tab.`), { tone: 'ok' });
    } catch (e) { w?.close(); toast(errorMessage(e), { tone: 'danger' }); } finally { setLoginBusy(false); }
  };
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const resetPw = useAdminMutation({ fn: (password: string) => adminApi.resetPassword(id, password), success: adm.members.detail.resetDone, onSuccess: () => { setPwOpen(false); setPw(''); } });

  // 교육담당자 관리 업체 / 전화상담
  const [managed, setManaged] = useState<{ idx: number | null; companyCode: string; companyName: string } | null>(null);
  const saveManaged = useAdminMutation({ fn: (m: { idx: number | null; companyCode: string }) => (m.idx ? adminMembersParityApi.editManagedCompany(id, m.idx, m.companyCode) : adminMembersParityApi.addManagedCompany(id, m.companyCode)), success: tr('처리되었습니다.', 'Saved.'), invalidate, onSuccess: () => setManaged(null) });
  const removeManaged = useAdminMutation({ fn: (idx: number) => adminMembersParityApi.removeManagedCompany(id, idx), success: tr('처리되었습니다.', 'Deleted.'), invalidate, onSuccess: () => setManaged(null) });
  const [phone, setPhone] = useState<{ idx: number | null; Category: string; Name: string; Contents: string; Status: string } | null>(null);
  const savePhone = useAdminMutation({ fn: (v: { idx: number | null; Category: string; Name: string; Contents: string; Status: string }) => { const { idx, ...b } = v; return idx ? adminMembersParityApi.updateCounselPhone(id, idx, b) : adminMembersParityApi.createCounselPhone(id, b); }, success: tr('처리되었습니다.', 'Saved.'), invalidate, onSuccess: () => setPhone(null) });
  const removePhone = useAdminMutation({ fn: (idx: number) => adminMembersParityApi.removeCounselPhone(id, idx), success: tr('처리되었습니다.', 'Deleted.'), invalidate, onSuccess: () => setPhone(null) });
  // progress_info_pop.php / qna_read.php drawers (see enrollCols)
  const hasStudyPage = hasGrant(admin, 'B5') || hasGrant(admin, 'B1');
  const [progressSeq, setProgressSeq] = useState<number | null>(null);
  const [inquiryIdx, setInquiryIdx] = useState<number | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);
  const learningXls = async () => { setXlsBusy(true); try { await adminStudiesParityApi.downloadProgressExcel(id); } catch (e) { toast(errorMessage(e), { tone: 'danger' }); } finally { setXlsBusy(false); } };
  const phoneCsv = async () => { setCsvBusy(true); try { await adminMembersParityApi.downloadCounselPhoneCsv(id); } catch (e) { toast(errorMessage(e), { tone: 'danger' }); } finally { setCsvBusy(false); } };

  const masked = (field: RevealKey, value: string | null | undefined) => {
    if (revealed[field] !== undefined) return <span>{revealed[field]}</span>;
    if (!value) return '';
    return <button type="button" className="u-link" style={{ background: 'none', border: 0, padding: 0, color: 'var(--link, #1e6bd6)', cursor: 'pointer', textDecoration: 'underline' }} title={tr('사유를 남기고 열람', 'View with a logged reason')} onClick={() => setReason({ kind: 'reveal', field })}>{value}</button>;
  };

  const loginCols: Column<Login>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: desc(d?.loginTotal ?? 0) },
    { key: 'at', header: tr('로그인 시각', 'Login time'), nowrap: true, render: (r) => r.at ?? '' },
    { key: 'ip', header: tr('아이피', 'IP'), render: (r) => <span className="mono">{r.ip ?? ''}</span> },
    { key: 'device', header: tr('유형', 'Type'), align: 'center', render: (r) => r.device ?? '' },
    { key: 'ua', header: tr('브라우저 정보', 'Browser'), render: (r) => <span title={r.userAgent ?? ''}>{r.uaLabel}</span> },
  ];
  const certCols: Column<Cert>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 80, render: desc(d?.identity.certCount ?? d?.certHistory.length ?? 0) },
    { key: 'course', header: tr('교육과정', 'Course'), render: (r) => <span title={r.lectureCode}>{r.courseName ?? r.lectureCode}</span> },
    { key: 'at', header: tr('인증시간', 'Checked at'), nowrap: true, render: (r) => r.at ?? '' },
  ];
  const managedCols: Column<Managed>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 80, render: desc(d?.managedCompanies.length ?? 0) },
    { key: 'companyName', header: tr('기업명', 'Company'), render: (r) => <button type="button" style={{ background: 'none', border: 0, padding: 0, color: 'var(--link, #1e6bd6)', cursor: 'pointer' }} disabled={!canWrite} onClick={() => setManaged({ idx: r.idx, companyCode: r.companyCode, companyName: r.companyName ?? '' })}>{r.companyName ?? r.companyCode}</button> },
    { key: 'companyCode', header: tr('사업자등록번호', 'Biz no.'), render: (r) => r.companyCode },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
  ];
  const phoneCols: Column<Phone>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 80, render: desc(d?.counselPhone.length ?? 0) },
    { key: 'category', header: tr('문의종류', 'Category'), render: (r) => r.categoryLabel },
    { key: 'name', header: tr('상담자명', 'Counsellor'), render: (r) => r.name ?? '' },
    { key: 'contents', header: tr('상담내용', 'Notes'), render: (r) => <span style={{ whiteSpace: 'pre-wrap' }}>{r.contents}</span> },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'status', header: tr('처리상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={r.status === 'B' ? 'ok' : 'warn'}>{r.statusLabel}</StatusBadge> },
  ];
  const inquiryCols: Column<Inquiry>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 80, render: desc(d?.inquiries.length ?? 0) },
    { key: 'category', header: tr('문의종류', 'Category'), render: (r) => r.categoryLabel },
    { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
    // member_read.php opened qna_read.php?idx= for the clicked inquiry: read it here (A2 is enough); answering stays on 1:1 상담문의.
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <button type="button" style={linkBtn} onClick={() => setInquiryIdx(r.idx)}>{r.title ?? ''}</button> },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'status', header: tr('처리상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={r.status === 'B' ? 'ok' : 'warn'}>{r.statusLabel}</StatusBadge> },
  ];

  const co = d?.company;
  const check = (on: boolean) => <StatusBadge tone={on ? 'ok' : 'neutral'}>{on ? tr('사용', 'On') : tr('미사용', 'Off')}</StatusBadge>;
  const addr = (a: { zipcode?: string | null; address01?: string | null; address02?: string | null }) => [a.zipcode ? `[${a.zipcode}]` : '', a.address01, a.address02].filter(Boolean).join(' ');
  const passed = d ? d.enrollments.filter((e) => e.passOkRaw === 'Y').length : 0;
  const counselCount = d ? d.counselPhone.length + d.inquiries.length : 0;

  if (q.isError) return <DetailPage><StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /></DetailPage>;
  if (q.isPending || !d || !p) return <DetailPage><Skeleton lines={10} /></DetailPage>;

  return (
    <DetailPage>
      <DetailHeader
        initial={p.name ?? p.id}
        title={<>{p.name ?? p.id} <span style={{ fontWeight: 500, color: 'var(--c-muted)', fontSize: 16 }}>({p.id})</span></>}
        subtitle={[co?.companyName ?? p.companyCode, [p.depart, p.position].filter(Boolean).join(' · ')].filter(Boolean).join('  |  ') || tr('소속 정보 없음', 'No company')}
        badges={<>
          <StatusBadge tone={p.useYN === 'N' ? 'warn' : 'ok'}>{p.useYN === 'N' ? tr('미사용 계정', 'Inactive') : tr('사용 중', 'Active')}</StatusBadge>
          {p.memberTypeLabel ? <StatusBadge>{p.memberTypeLabel}</StatusBadge> : null}
          {p.eduManager === 'Y' ? <StatusBadge tone="info">{tr('교육담당자', 'Training manager')}</StatusBadge> : null}
          {p.testId === 'Y' ? <StatusBadge>{tr('테스트 계정', 'Test account')}</StatusBadge> : null}
          {p.memberOut === 'Y' ? <StatusBadge tone="danger">{tr(`탈퇴 ${p.memberOutDate ?? ''}`, `Withdrawn ${p.memberOutDate ?? ''}`)}</StatusBadge> : null}
          {p.sleep === 'Y' ? <StatusBadge tone="warn">{tr(`휴면 ${p.sleepDate ?? ''}`, `Dormant ${p.sleepDate ?? ''}`)}</StatusBadge> : null}
        </>}
        facts={[
          { label: tr('수강', 'Enrollments'), value: tr(`${d.enrollments.length}건`, String(d.enrollments.length)) },
          { label: tr('수료', 'Completed'), value: tr(`${passed}건`, String(passed)), tone: passed ? 'ok' : undefined },
          { label: tr('로그인', 'Logins'), value: tr(`${d.loginTotal}회`, String(d.loginTotal)) },
          { label: tr('최근 로그인', 'Last login'), value: p.lastLogin ? p.lastLogin.slice(0, 16) : null, hint: p.lastLoginIp ?? undefined },
          { label: tr('가입일', 'Joined'), value: p.regDate ? p.regDate.slice(0, 10) : null },
        ]}
        back={{ to: listHref, label: tr('목록', 'List') }}
        actions={<AButton variant="primary" icon="edit" disabled={!canWrite || p.memberOut === 'Y'} title={readOnlyTitle} onClick={() => setReason({ kind: 'edit' })}>{tr('정보 수정', 'Edit')}</AButton>}
        dangerActions={<>
          <MenuAction onClick={() => setConfirm('pcd')} disabled={!canWrite} title={readOnlyTitle}>{tr('비밀번호 초기화 (1111)', 'Reset password (1111)')}</MenuAction>
          <MenuAction onClick={() => setPwOpen(true)} disabled={!canWrite} title={readOnlyTitle}>{tr('비밀번호 지정', 'Set password')}</MenuAction>
          <MenuAction onClick={() => setConfirm('use')} disabled={!canWrite} title={readOnlyTitle}>{p.useYN === 'Y' ? tr('회원 미사용처리', 'Deactivate') : tr('회원 사용처리', 'Activate')}</MenuAction>
          <MenuAction onClick={() => setConfirm('out')} disabled={!canWrite || p.memberOut === 'Y'} title={readOnlyTitle} danger>{tr('회원 탈퇴처리', 'Withdraw')}</MenuAction>
          <MenuAction onClick={() => setConfirm('delete')} disabled={!canWrite} title={readOnlyTitle} danger>{tr('회원 데이터 삭제', 'Delete member data')}</MenuAction>
          <MenuAction onClick={() => setLoginOpen(true)} disabled={!canWrite || p.memberOut === 'Y' || p.useYN !== 'Y'} title={p.memberOut === 'Y' || p.useYN !== 'Y' ? tr('로그인이 불가능한 아이디입니다.[미사용 전환 아이디]', 'This account cannot be signed in (inactive or withdrawn).') : readOnlyTitle}>{tr('회원으로 로그인', 'Log in as member')}</MenuAction>
        </>}
      />

      {p.memberOut === 'Y' ? <Callout tone="warn">{tr(`탈퇴 처리된 회원입니다 (${p.memberOutDate ?? ''}). 복구는 탈퇴회원 관리에서 합니다.`, `Withdrawn member (${p.memberOutDate ?? ''}). Restore it from Withdrawn members.`)}</Callout> : null}

      <DetailTabs label={tr('수강생 상세 항목', 'Learner sections')}>
        <DetailTab id="info" label={tr('기본 정보', 'Profile')} icon="user">
          <InfoTable groups={[
            { title: tr('계정', 'Account'), rows: [
              { label: tr('아이디', 'ID'), value: <b>{p.id}</b> }, { label: tr('이름', 'Name'), value: p.name },
              { label: tr('영문 이름', 'English name'), value: p.nameEng }, { label: tr('회원구분', 'Member type'), value: p.memberTypeLabel },
              { label: tr('가입일', 'Joined'), value: p.regDate }, { label: tr('최종로그인', 'Last login'), value: p.lastLogin ? `${p.lastLogin} (${p.lastLoginIp ?? ''})` : null },
              { label: tr('교육 담당자', 'Training manager'), value: p.eduManager }, { label: tr('계정 사용', 'Account'), value: p.useYN === 'N' ? tr('미사용', 'Inactive') : tr('사용', 'Active') },
              // member_info_pop.php 대리수강 방지 (Member.ProtectID, $UseYN_array)
              { label: tr('대리수강 방지', 'Proxy-study guard'), value: p.protectId === 'Y' ? tr('사용', 'On') : p.protectId === 'N' ? tr('미사용', 'Off') : null },
            ] },
            { title: tr('개인정보', 'Personal data'), aside: <span className="muted" style={{ fontSize: 12 }}>{tr('가려진 값을 누르면 사유를 남기고 열람합니다', 'Click a masked value to view it with a logged reason')}</span>, rows: [
              { label: tr('생년월일 / 성별', 'Birth date / gender'), value: <span>{masked('BirthDay', p.birthDay) || '—'}{p.genderLabel ? ` / ${p.genderLabel}` : ''}</span> },
              { label: tr('이메일', 'Email'), value: masked('Email', p.email) },
              { label: tr('휴대폰', 'Mobile'), value: masked('Mobile', p.mobile) },
              { label: tr('전화번호', 'Phone'), value: masked('Tel', p.tel) },
              { label: tr('주소', 'Address'), value: addr(p.address), wide: true },
            ] },
            { title: tr('소속 · 기타', 'Work · other'), rows: [
              { label: tr('부서', 'Department'), value: p.depart }, { label: tr('직위', 'Title'), value: p.position },
              { label: tr('관심분야', 'Interests'), value: p.etc01 }, { label: tr('가입경로', 'Referral'), value: p.etc02 },
              { label: tr('메일링', 'Mailing'), value: p.mailling }, { label: 'ACS', value: p.acs },
              { label: tr('마케팅 수신동의', 'Marketing consent'), value: p.marketingLabel }, { label: tr('내일배움카드', 'Learning card'), value: [p.cardName, p.cardNumber].filter(Boolean).join(' ') },
            ] },
          ]} />
        </DetailTab>

        <DetailTab id="company" label={tr('소속 정보', 'Company')} icon="building" hidden={!p.companyCode}>
          {co ? (
            <InfoTable groups={[
              { title: tr('사업주', 'Company'), aside: <Link to={`/admin/companies/${co.idx}`} style={{ fontSize: 13 }}>{tr('사업주 상세 보기 →', 'Open company →')}</Link>, rows: [
                { label: tr('회사명', 'Company'), value: <b>{co.companyName}</b> }, { label: tr('회사 규모', 'Size'), value: co.scaleLabel },
                { label: tr('사업자 번호', 'Biz no.'), value: co.companyCode }, { label: tr('HRD 번호', 'HRD no.'), value: co.hrd },
                { label: tr('사업주 ID', 'Company ID'), value: co.companyId }, { label: tr('대표자명', 'CEO'), value: co.ceo },
                { label: tr('업태', 'Business type'), value: co.uptae }, { label: tr('업종', 'Industry'), value: co.upjong },
              ] },
              { title: tr('연락처', 'Contact'), rows: [
                { label: tr('대표 전화번호', 'Main phone'), value: co.tel }, { label: tr('고객센터 전화번호', 'Support phone'), value: <span>{co.tel2 ?? ''} {check(co.csEnabled)}</span> },
                { label: tr('대표 팩스번호', 'Main fax'), value: co.fax }, { label: tr('고객센터 팩스번호', 'Support fax'), value: co.fax2 },
                { label: tr('이메일', 'Email'), value: co.email }, { label: tr('홈페이지', 'Homepage'), value: co.homePage },
                { label: tr('주소', 'Address'), value: addr(co.address), wide: true },
              ] },
              { title: tr('운영', 'Operations'), rows: [
                { label: tr('교육담당자', 'Training manager'), value: [co.eduManager, co.eduManagerPhone, co.eduManagerEmail].filter(Boolean).join(' / ') }, { label: tr('영업담당자', 'Sales rep'), value: co.salesName },
                { label: tr('계좌정보', 'Bank'), value: [co.bankName, co.bankNumber].filter(Boolean).join(' ') }, { label: tr('사이버교육센터', 'Cyber centre'), value: <span>{co.cyberUrl ?? ''} {check(co.cyberEnabled)}</span> },
                { label: tr('메모', 'Memo'), value: co.remark, wide: true },
              ] },
            ]} />
          ) : <Callout>{tr(`사업자번호 ${p.companyCode} 의 사업주 정보가 없습니다.`, `No company record for ${p.companyCode}.`)}</Callout>}
        </DetailTab>

        <DetailTab id="studies" label={tr('수강 내역', 'Enrollments')} icon="book" count={d.enrollments.length}>
          <SectionPanel title={tr('수강 내역', 'Enrollments')} count={d.enrollments.length}
            note={tr('진도율 = 학습시간 ÷ 15시간 (패키지는 하위 과정 합산). 진도 로그 "보기"를 누르면 차시별 학습 기록과 로그가 열립니다.', 'Progress = study time ÷ 15h (package: sub-courses summed). "View" opens the per-chapter record and log.')}
            toolbar={<AButton size="sm" icon="download" loading={xlsBusy} onClick={() => void learningXls()}>{tr('학습내역 엑셀 출력', 'Learning record CSV')}</AButton>}>
            <DataTable columns={enrollCols(d.enrollments.length, p.id, p.name ?? '', hasStudyPage ? undefined : setProgressSeq)} rows={d.enrollments} rowKey={(r) => r.studySeq} emptyTitle={tr('수강 내역이 없습니다.', 'No enrollments.')} dense />
          </SectionPanel>
        </DetailTab>

        <DetailTab id="access" label={tr('로그인 · 본인인증', 'Logins · identity')} icon="shield" count={d.loginTotal}>
          <PanelGrid>
            <SectionPanel title={tr('로그인 내역', 'Login history')} count={d.loginTotal} maxHeight={520}>
              <DataTable columns={loginCols} rows={d.loginHistory} rowKey={(r) => r.idx} emptyTitle={tr('로그인 내역이 없습니다.', 'No logins.')} dense />
            </SectionPanel>
            <SectionPanel title={tr('본인인증 내역', 'Identity checks')} count={d.identity.certCount} note={tr(`성공 ${d.identity.certSuccess}건`, `${d.identity.certSuccess} succeeded`)} maxHeight={520}>
              <DataTable columns={certCols} rows={d.certHistory} rowKey={(r) => r.seq} emptyTitle={tr('본인인증 내역이 없습니다.', 'No identity checks.')} dense />
            </SectionPanel>
          </PanelGrid>
        </DetailTab>

        <DetailTab id="counsel" label={tr('상담 · 문의', 'Counselling')} icon="headset" count={counselCount}>
          <SectionPanel title={tr('전화상담 내역', 'Phone counselling')} count={d.counselPhone.length} note={canWrite ? tr('행을 누르면 수정할 수 있습니다.', 'Click a row to edit it.') : undefined}
            toolbar={<><AButton size="sm" variant="primary" icon="plus" disabled={!canWrite} title={readOnlyTitle} onClick={() => setPhone({ idx: null, Category: '', Name: admin?.name ?? '', Contents: '', Status: '' })}>{tr('신규 작성', 'New')}</AButton><AButton size="sm" icon="download" loading={csvBusy} onClick={() => void phoneCsv()}>{tr('엑셀 출력', 'Export')}</AButton></>}>
            <DataTable columns={phoneCols} rows={d.counselPhone} rowKey={(r) => r.idx} onRowClick={canWrite ? (r) => setPhone({ idx: r.idx, Category: r.category ?? '', Name: r.name ?? '', Contents: r.contents, Status: r.status ?? '' }) : undefined} emptyTitle={tr('전화상담 내역이 없습니다.', 'No phone counselling.')} dense />
          </SectionPanel>
          <SectionPanel title={tr('1:1 문의 내역', '1:1 inquiries')} count={d.inquiries.length}>
            <DataTable columns={inquiryCols} rows={d.inquiries} rowKey={(r) => r.idx} emptyTitle={tr('1:1 문의 내역이 없습니다.', 'No inquiries.')} dense />
          </SectionPanel>
        </DetailTab>

        <DetailTab id="managed" label={tr('관리 업체', 'Managed companies')} icon="briefcase" count={d.managedCompanies.length} hidden={p.eduManager !== 'Y'}>
          <SectionPanel title={tr('교육담당자 관리 업체', 'Managed companies')} count={d.managedCompanies.length}
            note={tr('등록된 업체는 소속업체와 같이 교육담당자 메뉴에서 관리할 수 있습니다.', 'Listed companies can be managed from the training-manager menu like the own company.')}
            toolbar={<AButton size="sm" variant="primary" icon="plus" disabled={!canWrite} title={readOnlyTitle} onClick={() => setManaged({ idx: null, companyCode: '', companyName: '' })}>{tr('신규 등록', 'Add')}</AButton>}>
            <DataTable columns={managedCols} rows={d.managedCompanies} rowKey={(r) => r.idx} emptyTitle={tr('등록된 회사가 없습니다.', 'No companies.')} dense />
          </SectionPanel>
        </DetailTab>
      </DetailTabs>

      <PrivacyReasonDialog open={!!reason} item={reason?.kind === 'reveal' ? REVEAL_LABEL[reason.field] : '회원정보수정'} loading={reveal.isPending || editForm.isPending} onCancel={() => setReason(null)}
        onSubmit={(gubun, text) => { if (reason?.kind === 'reveal') reveal.mutate({ field: reason.field, gubun, reason: text }); else editForm.mutate({ gubun, reason: text }); }} />
      <MemberFormDrawer open={!!editInitial} mode="edit" initial={editInitial} onClose={() => setEditInitial(null)} onSaved={() => setRevealed({})} />

      <ConfirmDialog open={loginOpen} tone="info" title={tr('회원으로 로그인', 'Log in as member')} body={<p>{tr(`[${id}]로 로그인 하시겠습니까?`, `Log in as [${id}]?`)}<br /><small className="muted">{tr('이 브라우저의 학습자 로그인이 이 회원으로 바뀌고, 이 회원의 다른 접속은 끊어집니다.', "This browser's learner session switches to this member and their other session is signed out.")}</small></p>} loading={loginBusy} onCancel={() => setLoginOpen(false)} onConfirm={() => void loginAs()} />
      <ConfirmDialog open={confirm === 'pcd'} title={tr('비밀번호 초기화', 'Reset password')} body={<p>{tr('비밀번호를 1111 으로 초기화 하시겠습니까?', 'Reset the password to 1111?')}</p>} loading={initPw.isPending} onCancel={() => setConfirm(null)} onConfirm={() => initPw.mutate(undefined)} />
      <ConfirmDialog open={confirm === 'out'} tone="danger" title={tr('회원 탈퇴처리', 'Withdraw member')} body={<p>{tr('현재회원을 탈퇴처리 하시겠습니까?', 'Withdraw this member?')}</p>} loading={withdraw.isPending} onCancel={() => setConfirm(null)} onConfirm={() => withdraw.mutate(undefined)} />
      <ConfirmDialog open={confirm === 'use'} title={p?.useYN === 'Y' ? tr('회원 미사용처리', 'Deactivate') : tr('회원 사용처리', 'Activate')} body={<p>{p?.useYN === 'Y' ? tr('현재회원을 미사용처리 하시겠습니까?', 'Deactivate this member?') : tr('현재회원을 사용처리 하시겠습니까?', 'Activate this member?')}</p>} loading={setUse.isPending} onCancel={() => setConfirm(null)} onConfirm={() => setUse.mutate(p?.useYN === 'Y' ? 'N' : 'Y')} />
      <ConfirmDialog open={confirm === 'delete'} tone="danger" title={tr('회원 데이터 삭제 기록', 'Delete member data')} reason reasonRequired reasonLabel={tr('삭제 사유', 'Reason')}
        body={<DescList items={[[tr('삭제될 회원', 'Member'), id], [tr('삭제일', 'Date'), new Date().toISOString().slice(0, 10)], [tr('삭제한 관리자', 'Admin'), admin?.id ?? '']]} />}
        confirmLabel={tr('삭제하기', 'Delete')} loading={del.isPending} onCancel={() => setConfirm(null)} onConfirm={(r) => del.mutate(r)} />
      <ConfirmDialog open={pwOpen} title={tr('비밀번호 지정', 'Set password')} tone="danger" confirmLabel={tr('저장', 'Save')} loading={resetPw.isPending} onCancel={() => setPwOpen(false)} onConfirm={() => resetPw.mutate(pw)}
        body={<div><p>{adm.members.detail.resetPwBody}</p><div className="u-mt-16"><label htmlFor="f-pw" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{adm.members.detail.newPw}</label><AInput id="f-pw" type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} maxLength={64} invalid={pw.length > 0 && pw.length < 8} /></div></div>} />

      <Modal open={!!managed} onClose={() => setManaged(null)} title={tr('교육담당자 관리회사', 'Managed company')}>
        {managed ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 340 }}>
          <FieldRow label={tr('관리기업', 'Company')} htmlFor="mc-cname" help={managed.companyCode ? `${tr('사업자번호', 'Biz no.')}: ${managed.companyCode}` : undefined}><CompanyPicker idPrefix="mc" name={managed.companyName} onName={(v) => setManaged({ ...managed, companyName: v })} onPick={(code, name) => setManaged({ ...managed, companyCode: code, companyName: name })} /></FieldRow>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{managed.idx ? <AButton variant="danger" loading={removeManaged.isPending} onClick={() => { if (window.confirm(tr('삭제하시겠습니까?', 'Delete?'))) removeManaged.mutate(managed.idx!); }}>{tr('삭제', 'Delete')}</AButton> : null}</span>
            <span style={{ display: 'flex', gap: 8 }}><AButton onClick={() => setManaged(null)}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" loading={saveManaged.isPending} disabled={!managed.companyCode} onClick={() => saveManaged.mutate({ idx: managed.idx, companyCode: managed.companyCode })}>{tr('등록 하기', 'Save')}</AButton></span>
          </div>
        </div> : null}
      </Modal>

      <MemberProgressDrawer memberId={p.id} seq={progressSeq} onClose={() => setProgressSeq(null)} />
      <MemberInquiryDrawer memberId={p.id} idx={inquiryIdx} canAnswer={hasGrant(admin, 'F3')} onClose={() => setInquiryIdx(null)} />

      <Modal open={!!phone} onClose={() => setPhone(null)} title={tr('전화상담 내역 작성', 'Phone counselling')}>
        {phone ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 360 }}>
          <FieldRow label={tr('문의 종류', 'Category')} htmlFor="cp-cat" required><ASelect id="cp-cat" value={phone.Category} onChange={(e) => setPhone({ ...phone, Category: e.target.value })} options={[{ value: 'A', label: tr('학습 문의', 'Learning') }, { value: 'B', label: tr('시스템 문의', 'System') }, { value: 'C', label: tr('기타 문의', 'Other') }]} placeholder={tr('선택하세요', 'Choose')} /></FieldRow>
          <FieldRow label={tr('상담자명', 'Counsellor')} htmlFor="cp-name" required><AInput id="cp-name" value={phone.Name} maxLength={50} onChange={(e) => setPhone({ ...phone, Name: e.target.value })} /></FieldRow>
          <FieldRow label={tr('상담 내용', 'Notes')} htmlFor="cp-body" required><ATextarea id="cp-body" rows={8} value={phone.Contents} onChange={(e) => setPhone({ ...phone, Contents: e.target.value })} /></FieldRow>
          <FieldRow label={tr('처리 상태', 'Status')} htmlFor="cp-st" required><ASelect id="cp-st" value={phone.Status} onChange={(e) => setPhone({ ...phone, Status: e.target.value })} options={[{ value: 'A', label: tr('처리중', 'In progress') }, { value: 'B', label: tr('처리완료', 'Done') }]} placeholder={tr('선택하세요', 'Choose')} /></FieldRow>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{phone.idx ? <AButton variant="danger" loading={removePhone.isPending} onClick={() => { if (window.confirm(tr('삭제하시겠습니까?', 'Delete?'))) removePhone.mutate(phone.idx!); }}>{tr('삭제', 'Delete')}</AButton> : null}</span>
            <span style={{ display: 'flex', gap: 8 }}><AButton onClick={() => setPhone(null)}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" loading={savePhone.isPending} disabled={!phone.Category || !phone.Name.trim() || !phone.Contents.trim() || !phone.Status} onClick={() => savePhone.mutate(phone)}>{tr('등록 하기', 'Save')}</AButton></span>
          </div>
        </div> : null}
      </Modal>
    </DetailPage>
  );
}
