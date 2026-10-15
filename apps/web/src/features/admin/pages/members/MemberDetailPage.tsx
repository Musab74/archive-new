import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { adminMembersParityApi, type MemberEditForm, type MemberParityDetail } from '../../../../shared/api/endpoints/admin-members-parity';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Callout, Card, ConfirmDialog, DataTable, DescList, FieldRow, StatusBadge, type Column } from '../../../../shared/ui/admin';
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
const scroll = (h: number, children: ReactNode) => <div style={{ maxHeight: h, overflowY: 'auto' }}>{children}</div>;

const enrollCols = (total: number, memberId: string, memberName: string): Column<Enrollment>[] => [
  { key: 'no', header: <>{tr('번호', 'No.')}<br />{tr('구분', 'Type')}</>, align: 'center', render: (r, i) => <>{total - i}<br /><small className="muted">{r.serviceTypeLabel || r.serviceType || ''}</small></> },
  { key: 'name', header: <>{tr('이름', 'Name')}<br />ID</>, render: (r) => <>{r.memberName ?? memberName}<br /><small className="muted">{memberId}</small></> },
  { key: 'course', header: <>{tr('과정명', 'Course')}<br />{tr('수강기간', 'Period')}</>, render: (r) => <><small style={{ color: r.packageYN === 'Y' ? 'var(--info, #1e6bd6)' : 'var(--muted, #888)' }}>[{r.packageYN === 'Y' ? tr('패키지', 'Package') : tr('단과', 'Single')}]</small> <b title={r.lectureCode}>{r.courseName}</b><br /><small>{r.period.start} ~ {r.period.end}</small></> },
  { key: 'percent', header: tr('진도율', 'Progress'), align: 'center', render: (r) => <Link to={`/admin/studies/${r.studySeq}`} title={`${r.formatted} · ${tr('저장값', 'stored')} ${r.storedProgress}%`}>{r.percent}%</Link> },
  { key: 'passOk', header: tr('수료여부', 'Completion'), align: 'center', render: (r) => (r.passOkRaw === 'Y' ? <StatusBadge tone="ok">{tr('수료', 'Completed')}</StatusBadge> : r.passOkRaw === 'N' ? <StatusBadge tone="warn">{tr('미수료', 'Not completed')}</StatusBadge> : '') },
  { key: 'studyEnd', header: tr('수강마감', 'Closed'), align: 'center', render: (r) => (r.studyEnd ? <><StatusBadge tone="info">{tr('마감완료', 'Closed')}</StatusBadge>{r.studyEndInPeriod ? <><br /><small style={{ color: 'var(--warn, #c77700)' }}>{tr('기간중', 'In period')}</small></> : null}</> : <StatusBadge tone="warn">{tr('미마감', 'Open')}</StatusBadge>) },
  { key: 'tutor', header: tr('교·강사', 'Tutor'), render: (r) => r.tutorName ?? '' },
  { key: 'company', header: <>{tr('사업주', 'Company')}<br />{tr('부서', 'Dept')}</>, render: (r) => <>{r.companyName ?? ''}{r.depart ? <><br /><small>{tr('부서', 'Dept')} : {r.depart}</small></> : null}</> },
  { key: 'certCount', header: <>{tr('실명인증', 'ID checks')}<br />({tr('건', 'n')})</>, align: 'right', render: (r) => r.certCount ?? '' },
];

export default function MemberDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { admin } = useAdminSession();
  const { canWrite, readOnlyTitle } = useWriteGate();
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
  const withdraw = useAdminMutation({ fn: () => adminMembersParityApi.withdraw(id), success: tr('탈퇴 처리가 완료되었습니다.', 'Member withdrawn.'), invalidate, onSuccess: () => { setConfirm(null); navigate('/admin/members'); } });
  const setUse = useAdminMutation({ fn: (v: 'Y' | 'N') => adminMembersParityApi.setUse(id, v), success: tr('사용여부가 변경되었습니다.', 'Account status changed.'), invalidate, onSuccess: () => setConfirm(null) });
  const del = useAdminMutation({ fn: (r: string) => adminMembersParityApi.deleteData(id, r), success: tr('삭제되었습니다.', 'Deleted.'), invalidate: [['admin', 'members']], onSuccess: () => { setConfirm(null); navigate('/admin/members'); } });
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
  const [csvBusy, setCsvBusy] = useState(false);
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
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <Link to={`/admin/counsel?q=${encodeURIComponent(id)}`}>{r.title ?? ''}</Link> },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'status', header: tr('처리상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={r.status === 'B' ? 'ok' : 'warn'}>{r.statusLabel}</StatusBadge> },
  ];

  const co = d?.company;
  const check = (on: boolean) => <span aria-label={on ? tr('사용', 'on') : tr('미사용', 'off')}>{on ? '☑' : '☐'} {tr('사용 여부', 'enabled')}</span>;
  return (
    <AdminPage title={tr('수강생 상세 내용', 'Learner detail')} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr('수강생 관리', 'Learners'), to: '/admin/members' }, { label: id }]}
      actions={<AButton to="/admin/members">{tr('목록', 'List')}</AButton>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d || !p ? <Skeleton lines={8} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <DescList cols={2} items={[
              [tr('아이디', 'ID'), <span key="id"><b>{p.id}</b> {p.useYN === 'N' ? <StatusBadge tone="warn">{tr('미사용 계정', 'Inactive account')}</StatusBadge> : null}{p.testId === 'Y' ? <> <StatusBadge>{tr('테스트', 'Test')}</StatusBadge></> : null}</span>],
              [tr('이름', 'Name'), p.name],
              [tr('생년월일/성별', 'Birth date / gender'), <span key="b">{masked('BirthDay', p.birthDay)} / {p.genderLabel}</span>],
              [tr('이메일', 'Email'), masked('Email', p.email)],
              [tr('전화번호', 'Phone'), masked('Tel', p.tel)],
              [tr('휴대폰', 'Mobile'), masked('Mobile', p.mobile)],
              [tr('영문 이름', 'English name'), p.nameEng],
              [tr('주소', 'Address'), `[${p.address.zipcode ?? ''}] ${p.address.address01 ?? ''} ${p.address.address02 ?? ''}`],
              [tr('부서', 'Department'), p.depart], [tr('직위', 'Title'), p.position],
              [tr('관심분야', 'Interests'), p.etc01], [tr('가입경로', 'Referral'), p.etc02],
              [tr('메일링', 'Mailing'), p.mailling], ['ACS', p.acs],
              [tr('가입일', 'Joined'), p.regDate], [tr('교육 담당자', 'Training manager'), p.eduManager],
              [tr('마케팅 수신동의', 'Marketing consent'), p.marketingLabel], [tr('회원구분', 'Member type'), p.memberTypeLabel],
              [tr('내일배움카드', 'Learning card'), [p.cardName, p.cardNumber].filter(Boolean).join(' ')],
              [tr('최종로그인', 'Last login'), p.lastLogin ? `${p.lastLogin} (${p.lastLoginIp ?? ''})` : null],
            ]} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
              <AButton variant="primary" disabled={!canWrite || p.memberOut === 'Y'} title={readOnlyTitle} onClick={() => setReason({ kind: 'edit' })}>{tr('정보 수정', 'Edit')}</AButton>
              <AButton disabled title={tr('회원으로 로그인은 아직 이전 사이트(hrd_manager)에서만 가능합니다.', 'Log in as member is still only available on the previous site.')}>{tr('회원으로 로그인', 'Log in as member')}</AButton>
              <AButton disabled={!canWrite} title={readOnlyTitle} onClick={() => setConfirm('pcd')}>{tr('비밀번호 초기화', 'Reset password')}</AButton>
              <AButton disabled={!canWrite} title={readOnlyTitle} onClick={() => setPwOpen(true)}>{tr('비밀번호 지정', 'Set password')}</AButton>
              <AButton disabled={!canWrite || p.memberOut === 'Y'} title={readOnlyTitle} onClick={() => setConfirm('out')}>{tr('회원 탈퇴처리', 'Withdraw')}</AButton>
              <AButton disabled={!canWrite} title={readOnlyTitle} onClick={() => setConfirm('use')}>{p.useYN === 'Y' ? tr('회원 미사용처리', 'Deactivate') : tr('회원 사용처리', 'Activate')}</AButton>
              <AButton variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={() => setConfirm('delete')}>{tr('회원 데이터 삭제', 'Delete member data')}</AButton>
              <AButton to="/admin/members">{tr('목록', 'List')}</AButton>
            </div>
            {p.memberOut === 'Y' ? <Callout tone="warn" className="u-mt-16">{tr(`탈퇴 처리된 회원입니다 (${p.memberOutDate ?? ''}). 복구는 탈퇴회원 관리에서 합니다.`, `Withdrawn member (${p.memberOutDate ?? ''}). Restore it from Withdrawn members.`)}</Callout> : null}
            {p.sleep === 'Y' ? <Callout tone="warn" className="u-mt-16">{tr(`휴면 계정입니다 (${p.sleepDate ?? ''}).`, `Dormant account (${p.sleepDate ?? ''}).`)}</Callout> : null}
          </Card>

          {p.companyCode ? (
            <Card title={tr('소속 정보', 'Company')}>
              {co ? <DescList cols={2} items={[
                [tr('회사 규모', 'Size'), co.scaleLabel], [tr('회사명', 'Company'), co.companyName], [tr('사업자 번호', 'Biz no.'), co.companyCode], [tr('HRD 번호', 'HRD no.'), co.hrd],
                [tr('사업주 ID', 'Company ID'), co.companyId], [tr('대표자명', 'CEO'), co.ceo], [tr('대표 전화번호', 'Main phone'), co.tel], [tr('고객센터 전화번호', 'Support phone'), <span key="t2">{co.tel2 ?? ''} {check(co.csEnabled)}</span>],
                [tr('업태', 'Business type'), co.uptae], [tr('업종', 'Industry'), co.upjong], [tr('대표 팩스번호', 'Main fax'), co.fax], [tr('고객센터 팩스번호', 'Support fax'), co.fax2],
                [tr('주소', 'Address'), `[${co.address.zipcode ?? ''}] ${co.address.address01 ?? ''} ${co.address.address02 ?? ''}`], [tr('계좌정보', 'Bank'), [co.bankName, co.bankNumber].filter(Boolean).join(' ')], [tr('이메일', 'Email'), co.email], [tr('홈페이지', 'Homepage'), co.homePage],
                [tr('교육담당자', 'Training manager'), [co.eduManager, co.eduManagerPhone, co.eduManagerEmail].map((x) => x ?? '').join(' / ')], [tr('영업담당자', 'Sales rep'), co.salesName], [tr('메모', 'Memo'), co.remark], [tr('사이버교육센터', 'Cyber centre'), <span key="cy">{co.cyberUrl ?? ''} {check(co.cyberEnabled)}</span>],
              ]} /> : <p className="muted" style={{ fontSize: 13 }}>{tr(`사업자번호 ${p.companyCode} 의 사업주 정보가 없습니다.`, `No company record for ${p.companyCode}.`)}</p>}
              {co ? <div style={{ marginTop: 8 }}><Link to={`/admin/companies/${co.idx}`} style={{ fontSize: 12 }}>{tr('사업주 상세 보기 →', 'Open company →')}</Link></div> : null}
            </Card>
          ) : null}

          <Card title={tr('로그인 내역', 'Login history')} aside={<span className="muted" style={{ fontSize: 12 }}>{d.loginTotal}{tr('건', '')}</span>}>{scroll(350, <DataTable columns={loginCols} rows={d.loginHistory} rowKey={(r) => r.idx} emptyTitle={tr('로그인 내역이 없습니다.', 'No logins.')} dense />)}</Card>
          <Card title={tr('본인인증 내역', 'Identity checks')} aside={<span className="muted" style={{ fontSize: 12 }}>{tr(`${d.identity.certCount}건 · 성공 ${d.identity.certSuccess}`, `${d.identity.certCount} · ${d.identity.certSuccess} ok`)}</span>}>{scroll(350, <DataTable columns={certCols} rows={d.certHistory} rowKey={(r) => r.seq} emptyTitle={tr('본인인증 내역이 없습니다.', 'No identity checks.')} dense />)}</Card>

          {p.eduManager === 'Y' ? (
            <Card title={tr('교육담당자 관리 업체', 'Managed companies')} aside={<AButton size="sm" variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setManaged({ idx: null, companyCode: '', companyName: '' })}>{tr('신규 등록', 'Add')}</AButton>}>
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{tr('등록된 업체는 소속업체와 같이 교육담당자 메뉴에서 관리할 수 있습니다', 'Listed companies can be managed from the training-manager menu like the own company.')}</p>
              <DataTable columns={managedCols} rows={d.managedCompanies} rowKey={(r) => r.idx} emptyTitle={tr('등록된 회사가 없습니다.', 'No companies.')} dense />
            </Card>
          ) : null}

          <Card title={tr('전화상담 내역', 'Phone counselling')} aside={<div style={{ display: 'flex', gap: 6 }}><AButton size="sm" variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setPhone({ idx: null, Category: '', Name: admin?.name ?? '', Contents: '', Status: '' })}>{tr('신규 작성', 'New')}</AButton><AButton size="sm" icon="download" loading={csvBusy} onClick={() => void phoneCsv()}>{tr('엑셀 출력', 'Export')}</AButton></div>}>
            <DataTable columns={phoneCols} rows={d.counselPhone} rowKey={(r) => r.idx} onRowClick={canWrite ? (r) => setPhone({ idx: r.idx, Category: r.category ?? '', Name: r.name ?? '', Contents: r.contents, Status: r.status ?? '' }) : undefined} emptyTitle={tr('전화상담 내역이 없습니다.', 'No phone counselling.')} dense />
          </Card>
          <Card title={tr('1:1 문의 내역', '1:1 inquiries')}><DataTable columns={inquiryCols} rows={d.inquiries} rowKey={(r) => r.idx} emptyTitle={tr('1:1 문의 내역이 없습니다.', 'No inquiries.')} dense /></Card>
          <Card title={tr('수강 내역', 'Enrollments')} aside={<span className="muted" style={{ fontSize: 12 }}>{tr('진도율 = 학습시간 ÷ 15시간 (패키지는 하위 과정 합산)', 'Progress = study time ÷ 15h (package: sub-courses summed)')}</span>}>
            {scroll(500, <DataTable columns={enrollCols(d.enrollments.length, p.id, p.name ?? '')} rows={d.enrollments} rowKey={(r) => r.studySeq} emptyTitle={tr('수강 내역이 없습니다.', 'No enrollments.')} dense />)}
          </Card>
        </div>
      )}

      <PrivacyReasonDialog open={!!reason} item={reason?.kind === 'reveal' ? REVEAL_LABEL[reason.field] : '회원정보수정'} loading={reveal.isPending || editForm.isPending} onCancel={() => setReason(null)}
        onSubmit={(gubun, text) => { if (reason?.kind === 'reveal') reveal.mutate({ field: reason.field, gubun, reason: text }); else editForm.mutate({ gubun, reason: text }); }} />
      <MemberFormDrawer open={!!editInitial} mode="edit" initial={editInitial} onClose={() => setEditInitial(null)} onSaved={() => setRevealed({})} />

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
    </AdminPage>
  );
}
