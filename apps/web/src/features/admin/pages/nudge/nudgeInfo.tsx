import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminNudgeApi, type NudgeCompanyCard, type RevealField } from '../../../../shared/api/endpoints/admin-nudge';
import { AButton, AInput, ASelect, Callout, Card, DataTable, DescList, DetailDrawer, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { tr } from '../../../../shared/i18n/adminLang';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { hasGrant } from '../../../../shared/auth/adminMenu';
import { adm } from '../../strings';

/** Information_protection_regist2.php 구분 select. */
const PRIVACY_GUBUN = ['학습자 관리', '학습자 요청', '기타 상담'];
const REASON_RE = /^[가-힣a-zA-Z0-9\s]+$/u;
const won = (n: number) => n.toLocaleString('ko-KR');
const check = (on: boolean) => <StatusBadge tone={on ? 'ok' : 'neutral'}>{on ? tr('사용', 'On') : tr('미사용', 'Off')}</StatusBadge>;

/** Link-styled trigger for the MemberInfo(ID) / CompanyInfo(CompanyCode) popups of the legacy lists. */
export function InfoLink({ onClick, children, label }: { onClick: () => void; children: ReactNode; label?: string }) {
  return <AButton variant="link" size="xs" aria-label={label} onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ padding: 0, textAlign: 'inherit' }}>{children}</AButton>;
}

/** One popup state per page: `const info = useNudgeInfo();` → `info.openMember(id)`, `info.openCompany(code)`, render `{info.drawers}`. */
export function useNudgeInfo() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  return {
    openMember: (id: string | null | undefined) => { if (id) setMemberId(id); },
    openCompany: (code: string | null | undefined) => { if (code) setCompanyCode(code); },
    drawers: <>
      <MemberInfoDrawer id={memberId} onClose={() => setMemberId(null)} onCompany={(c) => { setMemberId(null); setCompanyCode(c); }} />
      <CompanyInfoDrawer code={companyCode} onClose={() => setCompanyCode(null)} />
    </>,
  };
}

/** Masked value that reveals after a 구분 + 사유 entry (InformationProtection() → InformationProtectionLog). */
function RevealValue({ id, field, label, masked, has }: { id: string; field: RevealField; label: string; masked: string | null | undefined; has: boolean }) {
  const [open, setOpen] = useState(false);
  const [gubun, setGubun] = useState(PRIVACY_GUBUN[0]!);
  const [reason, setReason] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!has) return <span className="muted">—</span>;
  if (value !== null) return <span>{value}</span>;
  const submit = async () => {
    if (!reason.trim()) { setErr(tr('사유를 입력하세요.', 'Enter a reason.')); return; }
    if (!REASON_RE.test(reason.trim())) { setErr(tr('사유에는 한글, 영문, 숫자, 공백만 입력 가능합니다. (기호 금지)', 'Letters, digits and spaces only.')); return; }
    setBusy(true); setErr(null);
    try { const r = await adminNudgeApi.revealMember(id, { field, gubun, reason: reason.trim() }); setValue(r.value); }
    catch (e) { setErr(isAppError(e) ? e.message : adm.common.failed); }
    finally { setBusy(false); }
  };
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <AButton variant="link" size="xs" style={{ padding: 0 }} title={tr(`${label} 열람 (사유 기록)`, `Reveal ${label} (reason is logged)`)} onClick={() => setOpen((o) => !o)}>{masked}</AButton>
      {open ? (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <ASelect aria-label={tr('열람 구분', 'Purpose')} value={gubun} onChange={(e) => setGubun(e.target.value)} options={PRIVACY_GUBUN.map((g) => ({ value: g, label: g }))} style={{ width: 130 }} />
          <AInput aria-label={tr(`${label} 열람 사유`, `Reason to reveal ${label}`)} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr('열람 사유', 'Reason')} style={{ width: 180 }} />
          <AButton size="xs" variant="primary" loading={busy} onClick={() => void submit()}>{tr('열람', 'Reveal')}</AButton>
          {err ? <span role="alert" style={{ color: 'var(--c-danger)', fontSize: 12 }}>{err}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

/** company_info_pop.php shows 22 rows; member_info_pop.php's 소속 정보 block shows the first 20 (labels 교육담당자명 / 영업담당자명, no 독려문자 수신 / 영업팀 카테고리). */
function CompanyCardList({ c, variant = 'company' }: { c: NudgeCompanyCard; variant?: 'company' | 'member' }) {
  const member = variant === 'member';
  const items: [ReactNode, ReactNode][] = [
    [tr('회사 규모', 'Scale'), c.companyScaleLabel], [tr('회사명', 'Company'), c.companyName], [tr('사업자 번호', 'Business no.'), c.companyCode], [tr('HRD 번호', 'HRD no.'), c.hrd],
    [tr('사업주 ID', 'Company ID'), c.companyId], [tr('대표자명', 'CEO'), c.ceo], [tr('대표 전화번호', 'Main phone'), c.tel], [tr('고객센터 전화번호', 'CS phone'), <>{c.tel2} {check(c.csEnabled)}</>],
    [tr('업태', 'Business type'), c.uptae], [tr('업종', 'Industry'), c.upjong], [tr('대표 팩스번호', 'Main fax'), c.fax], [tr('고객센터 팩스번호', 'CS fax'), c.fax2],
    [tr('주소', 'Address'), `[${c.zipcode}] ${c.address01} ${c.address02}`.trim()], [tr('계좌정보', 'Bank account'), `${c.bankName} ${c.bankNumber}`.trim()], [tr('이메일', 'E-mail'), c.email], [tr('홈페이지', 'Homepage'), c.homePage],
    [member ? tr('교육담당자명', 'Training manager') : tr('교육담당자', 'Training manager'), `${c.eduManager} / ${c.eduManagerPhone} / ${c.eduManagerEmail}`], [member ? tr('영업담당자명', 'Sales rep') : tr('영업담당자', 'Sales rep'), c.salesName], [tr('메모', 'Memo'), c.remark], [tr('사이버교육센터', 'Cyber center'), <>{c.cyberUrl} {check(c.cyberEnabled)}</>],
  ];
  if (!member) items.push([tr('독려문자 수신', 'Nudge SMS'), c.sendSmsLabel], [tr('영업팀 카테고리', 'Sales team'), c.salesDeptName]);
  return <DescList cols={2} items={items} />;
}

/** member_info_pop.php — 수강생 상세 정보 / 소속 정보 / 로그인 내역 / 본인인증 내역 / 1:1 문의 내역. */
export function MemberInfoDrawer({ id, onClose, onCompany }: { id: string | null; onClose: () => void; onCompany?: (code: string) => void }) {
  const q = useQuery({ queryKey: ['admin', 'nudge', 'member-info', id], queryFn: ({ signal }) => adminNudgeApi.memberInfo(id!, signal), enabled: !!id });
  const { admin } = useAdminSession();
  const d = q.data; const p = d?.profile;
  return (
    <DetailDrawer open={!!id} onClose={onClose} title={tr('수강생 상세 정보', 'Learner details')} subtitle={p ? `${p.name ?? ''} (${p.id})` : id ?? ''} wide
      footer={<>{p && hasGrant(admin, 'A2') ? <AButton to={`/admin/members/${encodeURIComponent(p.id)}`}>{tr('수강생 상세 페이지', 'Open member page')}</AButton> : null}<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <Callout tone="warn">{isAppError(q.error) ? q.error.message : adm.common.failed}</Callout> : !d || !p ? <p className="muted">{adm.common.loading}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <DescList cols={2} items={[
            [tr('아이디', 'ID'), <>{p.id}{p.unused ? <> <StatusBadge tone="warn">{tr('미사용 계정', 'Unused account')}</StatusBadge></> : null}</>], [tr('이름', 'Name'), p.name], [tr('성별', 'Gender'), p.genderLabel],
            [tr('이메일', 'E-mail'), <RevealValue id={p.id} field="Email" label={tr('이메일', 'E-mail')} masked={p.email} has={p.hasEmail} />],
            [tr('전화번호', 'Phone'), <RevealValue id={p.id} field="Tel" label={tr('전화번호', 'Phone')} masked={p.tel} has={p.hasTel} />],
            [tr('휴대폰', 'Mobile'), <RevealValue id={p.id} field="Mobile" label={tr('휴대폰', 'Mobile')} masked={p.mobile} has={p.hasMobile} />],
            [tr('영문 이름', 'English name'), p.nameEng], [tr('주소', 'Address'), `[${p.zipcode}] ${p.address01} ${p.address02}`.trim()], [tr('부서', 'Department'), p.depart], [tr('직위', 'Position'), p.position],
            [tr('관심분야', 'Interests'), p.etc01], [tr('가입경로', 'Joined via'), p.etc02], [tr('메일링', 'Mailing'), p.mailling], ['ACS', p.acs], [tr('가입일', 'Joined'), p.regDate],
            [tr('교육 담당자', 'Training manager'), p.eduManager], [tr('대리수강 방지', 'Proxy guard'), p.protectId], [tr('마케팅 수신동의', 'Marketing'), p.marketingLabel], [tr('내일배움카드', 'Learning card'), `${p.cardName} ${p.cardNumber}`.trim()],
          ]} />
          {d.company ? <Card title={tr('소속 정보', 'Company')} aside={onCompany ? <AButton size="xs" onClick={() => onCompany(d.company!.companyCode)}>{tr('사업주 상세 정보', 'Company details')}</AButton> : null}><CompanyCardList c={d.company} variant="member" /></Card> : null}
          <Card title={tr('로그인 내역', 'Login history')}>
            <DataTable dense rows={d.loginHistory} rowKey={(r) => `${r.no}`} emptyTitle={tr('로그인 내역이 없습니다.', 'No logins.')}
              columns={[{ key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 }, { key: 'regDate', header: tr('로그인 시각', 'Logged in'), nowrap: true }, { key: 'ip', header: tr('아이피', 'IP'), nowrap: true }, { key: 'device', header: tr('유형', 'Type') }, { key: 'browser', header: tr('브라우저 정보', 'Browser'), render: (r) => <span title={r.userAgent || undefined}>{r.browser}</span> }]} />
          </Card>
          <Card title={tr('본인인증 내역', 'Identity checks')}>
            <DataTable dense rows={d.certHistory} rowKey={(r) => `${r.no}`} emptyTitle={tr('본인인증 내역이 없습니다.', 'No identity checks.')}
              columns={[{ key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 }, { key: 'contentsName', header: tr('교육과정', 'Course') }, { key: 'regDate', header: tr('인증시간', 'Checked at'), nowrap: true }]} />
          </Card>
          <Card title={tr('1:1 문의 내역', 'Inquiries')}>
            <DataTable dense rows={d.inquiries} rowKey={(r) => r.idx} emptyTitle={tr('1:1 문의 내역이 없습니다.', 'No inquiries.')}
              columns={[{ key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 }, { key: 'categoryLabel', header: tr('문의종류', 'Category') }, { key: 'name', header: tr('이름', 'Name') }, { key: 'title', header: tr('제목', 'Title') }, { key: 'regDate', header: tr('등록일', 'Created'), nowrap: true }, { key: 'statusLabel', header: tr('처리상태', 'Status') }]} />
          </Card>
        </div>
      )}
    </DetailDrawer>
  );
}

type StudyRow = { no: number; contentsName: string; lectureStart: string; lectureEnd: string; studyCount: number; passCount: number; passRatio: number; price: number; rPrice: number };
type MemberRow = { no: number; id: string; name?: string | null; birthDay?: string | null; genderLabel: string; email?: string | null; mobile?: string | null; depart: string; position: string; lastLogin?: string | null; regDate?: string | null; useYNLabel: string };

/** company_info_pop.php — 사업주 상세 정보 / 수강 정보 / 수강생 정보 (masked). */
export function CompanyInfoDrawer({ code, onClose }: { code: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'nudge', 'company-info', code], queryFn: ({ signal }) => adminNudgeApi.companyInfo(code!, signal), enabled: !!code });
  const { admin } = useAdminSession();
  const d = q.data;
  const studyCols: Column<StudyRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 }, { key: 'contentsName', header: tr('강의명', 'Course') },
    { key: 'period', header: tr('기간', 'Period'), nowrap: true, render: (r) => `${r.lectureStart} ~ ${r.lectureEnd}` },
    { key: 'counts', header: tr('수강/수료', 'Enrolled / passed'), align: 'center', render: (r) => `${r.studyCount} / ${r.passCount}` },
    { key: 'passRatio', header: tr('수료율', 'Pass rate'), align: 'right', render: (r) => `${r.passRatio}%` },
    { key: 'price', header: tr('교육비', 'Fee'), align: 'right', render: (r) => won(r.price) }, { key: 'rPrice', header: tr('환급비', 'Refund'), align: 'right', render: (r) => won(r.rPrice) },
  ];
  const memberCols: Column<MemberRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56 }, { key: 'id', header: tr('아이디', 'ID'), nowrap: true }, { key: 'name', header: tr('이름', 'Name'), nowrap: true },
    { key: 'birthDay', header: tr('생년월일', 'Birthday'), nowrap: true }, { key: 'genderLabel', header: tr('성별', 'Gender') }, { key: 'email', header: tr('이메일', 'E-mail') }, { key: 'mobile', header: tr('휴대폰', 'Mobile'), nowrap: true },
    { key: 'depart', header: tr('부서', 'Department') }, { key: 'position', header: tr('직위', 'Position') }, { key: 'lastLogin', header: tr('최종로그인', 'Last login'), nowrap: true }, { key: 'regDate', header: tr('가입일', 'Joined'), nowrap: true },
    { key: 'useYNLabel', header: tr('계정 사용유무', 'Account') },
  ];
  return (
    <DetailDrawer open={!!code} onClose={onClose} title={tr('사업주 상세 정보', 'Company details')} subtitle={d ? `${d.company.companyName} (${d.company.companyCode})` : code ?? ''} wide
      footer={<>{d?.company.idx && hasGrant(admin, 'A1') ? <AButton to={`/admin/companies/${d.company.idx}`}>{tr('사업주 상세 페이지', 'Open company page')}</AButton> : null}<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton></>}>
      {q.isError ? <Callout tone="warn">{isAppError(q.error) ? q.error.message : adm.common.failed}</Callout> : !d ? <p className="muted">{adm.common.loading}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CompanyCardList c={d.company} />
          <Card title={tr('수강 정보', 'Enrollments')}><DataTable dense rows={d.studies} rowKey={(r) => r.no} columns={studyCols} emptyTitle={tr('수강 정보가 없습니다.', 'No enrollments.')} /></Card>
          <Card title={tr('수강생 정보', 'Learners')}><DataTable dense rows={d.members} rowKey={(r) => r.id} columns={memberCols} emptyTitle={tr('수강생 정보가 없습니다.', 'No learners.')} /></Card>
        </div>
      )}
    </DetailDrawer>
  );
}
