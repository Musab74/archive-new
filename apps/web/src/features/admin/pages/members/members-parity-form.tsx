import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminMembersParityApi, ETC01_OPTIONS, ETC02_OPTIONS, PRIVACY_GUBUN, PRIVACY_REASON_RE, type MemberEditForm } from '../../../../shared/api/endpoints/admin-members-parity';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import { AButton, ACheckbox, AInput, ASelect, ATextarea, Callout, DetailDrawer, FieldRow } from '../../../../shared/ui/admin';
import { Modal } from '../../../../shared/ui/Modal';
import { isAppError } from '../../../../shared/api/client';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { tr } from '../../../../shared/i18n/adminLang';
import { useAdminMutation } from '../../useAdminMutation';

/** include/function.js fn_jumin_validate: 내국인(1~4) weights 2..9,2..5 → (11 − sum%11)%10; 외국인(5~8) registration-number rule. */
export function residentNoValid(front: string, back: string): boolean {
  if (!/^\d{6}$/.test(front) || !/^\d{7}$/.test(back)) return false;
  const all = (front + back).split('').map(Number);
  const w = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  if ('1234'.includes(back[0]!)) return (11 - (all.slice(0, 12).reduce((s, d, i) => s + d * w[i]!, 0) % 11)) % 10 === all[12];
  if ((all[7]! * 10 + all[8]!) % 2 !== 0) return false;
  if (![6, 7, 8, 9].includes(all[11]!)) return false;
  let sum = 11 - (all.slice(0, 12).reduce((s, d, i) => s + d * w[i]!, 0) % 11);
  if (sum >= 10) sum -= 10;
  sum += 2;
  if (sum >= 10) sum -= 10;
  return sum === all[12];
}

const split3 = (v: string) => { const p = (v || '').split('-'); return [p[0] ?? '', p[1] ?? '', p[2] ?? ''] as [string, string, string]; };
const join3 = (p: [string, string, string]) => (p.every((x) => !x) ? '' : p.join('-'));

type Form = {
  ID: string; Pwd: string; Name: string; ResNo: string; checkResNo: boolean; Gender: string; Email: string; Tel: [string, string, string]; Mobile: [string, string, string]; Zipcode: string; Address01: string; Address02: string;
  NameEng: string; CompanyCode: string; CompanyName: string; Depart: string; Position: string; Etc01: string[]; Etc02: string[]; Mailling: boolean; ACS: boolean; EduManager: boolean; UseYN: 'Y' | 'N'; Marketing: string; recomId: string | null;
};
const blank: Form = { ID: '', Pwd: '1111', Name: '', ResNo: '', checkResNo: true, Gender: '', Email: '', Tel: ['', '', ''], Mobile: ['', '', ''], Zipcode: '', Address01: '', Address02: '', NameEng: '', CompanyCode: '', CompanyName: '', Depart: '', Position: '', Etc01: [], Etc02: [], Mailling: true, ACS: true, EduManager: false, UseYN: 'Y', Marketing: 'N', recomId: null };
const fromEdit = (e: MemberEditForm): Form => ({
  ...blank, ID: e.id, Pwd: '', Name: e.name ?? '', ResNo: e.resNo, Gender: e.gender, Email: e.email, Tel: split3(e.tel), Mobile: split3(e.mobile), Zipcode: e.zipcode, Address01: e.address01, Address02: e.address02, NameEng: e.nameEng,
  CompanyCode: e.companyCode, CompanyName: e.companyName, Depart: e.depart, Position: e.position, Etc01: e.etc01, Etc02: e.etc02, Mailling: e.mailling === 'Y', ACS: e.acs === 'Y', EduManager: e.eduManager === 'Y', UseYN: e.useYN === 'N' ? 'N' : 'Y', Marketing: e.marketing || 'N', recomId: e.recomId ?? null,
});

/** member_write.php SubmitOk() checks. */
export function validateMemberForm(f: Form, mode: 'new' | 'edit'): Record<string, string> {
  const e: Record<string, string> = {};
  if (mode === 'new') {
    if (!f.ID) e.ID = tr('아이디를 입력하세요.', 'Enter an ID.');
    else if (!/^[A-Za-z0-9]{4,20}$/.test(f.ID)) e.ID = tr('아이디는 영문/숫자 4~20자로 입력하세요.', 'ID: 4–20 letters/digits.');
    if (!f.Pwd) e.Pwd = tr('비밀번호를 입력하세요.', 'Enter a password.');
  }
  if (!f.Name.trim()) e.Name = tr('이름을 입력하세요.', 'Enter a name.');
  if (mode === 'new' || f.ResNo) {
    if (f.ResNo.length !== 14 || !/^\d{6}-\d{7}$/.test(f.ResNo)) e.ResNo = tr('주민번호를 정확하게 입력하세요. ex)820304-1172917', 'Enter the resident number as 820304-1172917.');
    else {
      const [a, b] = f.ResNo.split('-') as [string, string];
      if (f.checkResNo && !residentNoValid(a, b)) e.ResNo = tr('올바른 주민번호가 아닙니다.', 'Invalid resident number.');
      else if (!'12345678'.includes(b[0]!)) e.ResNo = tr('주민번호 두번째 자리의 첫번째 숫자는 1~8의 숫자를 입력하세요.', 'The 7th digit must be 1–8.');
    }
  }
  if (f.Email && f.Email.length < 8) e.Email = tr('이메일을 정확하게 입력하세요.', 'Enter a valid email.');
  if (f.Mobile.some((p) => !p)) e.Mobile = tr('휴대폰을 입력하세요.', 'Enter the mobile number.');
  else if (f.Mobile.some((p) => !/^\d+$/.test(p))) e.Mobile = tr('휴대폰은 숫자만 입력하세요.', 'Digits only.');
  return e;
}

function PhoneParts({ id, value, onChange, label }: { id: string; value: [string, string, string]; onChange: (v: [string, string, string]) => void; label: string }) {
  const set = (i: number, v: string) => { const n = [...value] as [string, string, string]; n[i] = v.replace(/\D/g, ''); onChange(n); };
  return <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{[3, 4, 4].map((max, i) => <span key={i} style={{ display: 'contents' }}>{i ? '-' : null}<AInput id={i === 0 ? id : undefined} aria-label={`${label} ${i + 1}`} style={{ width: 70 }} inputMode="numeric" maxLength={max} value={value[i]} onChange={(e) => set(i, e.target.value)} /></span>)}</div>;
}

/** 회사명 검색 → 선택 (member_company_search.php + MemberCompanySearchSelect). */
export function CompanyPicker({ name, onName, onPick, idPrefix }: { name: string; onName: (v: string) => void; onPick: (code: string, name: string) => void; idPrefix: string }) {
  const [term, setTerm] = useState('');
  const q = useQuery({ queryKey: ['admin', 'members', 'company-search', term], queryFn: ({ signal }) => adminMembersParityApi.companySearch(term, signal), enabled: term.length > 0 });
  const opts = (q.data?.items ?? []).map((c) => ({ value: `${c.companyCode}|${c.companyName ?? ''}`, label: `${c.companyName ?? ''} (${c.companyCode})` }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}><AInput id={`${idPrefix}-cname`} value={name} onChange={(e) => onName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setTerm(name.trim()); } }} /><AButton onClick={() => setTerm(name.trim())} disabled={!name.trim()}>{tr('검색', 'Search')}</AButton></div>
      {term ? (q.isPending ? <span className="muted" style={{ fontSize: 12 }}>{tr('검색 중…', 'Searching…')}</span> : opts.length ? <ASelect aria-label={tr('검색 결과', 'Results')} value="" onChange={(e) => { const [c, n] = e.target.value.split('|'); if (c) { onPick(c, n ?? ''); setTerm(''); } }} options={opts} placeholder={tr('-- 소속된 회사를 선택하세요. --', '-- choose a company --')} /> : <span className="muted" style={{ fontSize: 12 }}>{tr('등록된 사업자정보가 없습니다.', 'No company found.')}</span>) : null}
    </div>
  );
}

/** member_write.php (mode=new / mode=edit) in a drawer. Edit values come from POST :id/edit-form (reason logged first). */
export function MemberFormDrawer({ open, mode, initial, onClose, onSaved }: { open: boolean; mode: 'new' | 'edit'; initial?: MemberEditForm | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<Form>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idMsg, setIdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (open) { setF(mode === 'edit' && initial ? fromEdit(initial) : blank); setErrors({}); setIdMsg(null); } }, [open, mode, initial]);
  const body = () => ({
    Name: f.Name.trim(), ResNo: f.ResNo, Gender: f.Gender, Email: f.Email.trim() || null, Tel: join3(f.Tel) || null, Mobile: join3(f.Mobile), Zipcode: f.Zipcode || null, Address01: f.Address01 || null, Address02: f.Address02 || null, NameEng: f.NameEng || null,
    CompanyCode: f.CompanyCode || null, Depart: f.Depart || null, Position: f.Position || null, Etc01: f.Etc01, Etc02: f.Etc02, Mailling: f.Mailling ? 'Y' : 'N', ACS: f.ACS ? 'Y' : 'N', EduManager: f.EduManager ? 'Y' : 'N', UseYN: f.UseYN, Marketing: f.Marketing,
  });
  const onErr = (err: unknown) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } };
  const save = useAdminMutation({
    fn: () => (mode === 'new' ? adminMembersParityApi.createMember({ ID: f.ID.trim(), Pwd: f.Pwd, ...body() }) : adminMembersParityApi.updateMember(f.ID, body())),
    invalidate: [['admin', 'members'], ['admin', 'member']], success: mode === 'new' ? tr('등록이 완료되었습니다.', 'Registered.') : tr('수정이 완료되었습니다.', 'Saved.'),
    onSuccess: () => { onSaved?.(f.ID.trim()); onClose(); },
    onError: (err) => { onErr(err); },
  });
  const submit = () => { const e = validateMemberForm(f, mode); setErrors(e); if (!Object.keys(e).length && window.confirm(mode === 'new' ? tr('등록 하시겠습니까?', 'Register?') : tr('수정 하시겠습니까?', 'Save changes?'))) save.mutate(undefined); };
  const toggle = (k: 'Etc01' | 'Etc02', v: string, on: boolean) => setF({ ...f, [k]: on ? [...f[k], v] : f[k].filter((x) => x !== v) });
  const checkId = async () => { if (!/^[A-Za-z0-9]{4,20}$/.test(f.ID)) { setIdMsg({ ok: false, text: tr('아이디는 4자이상 20자 이내 영문/숫자로 입력하세요.', 'ID: 4–20 letters/digits.') }); return; } const r = await adminMembersParityApi.checkId(f.ID); setIdMsg({ ok: r.available, text: r.message }); };
  return (
    <DetailDrawer open={open} onClose={onClose} wide title={mode === 'new' ? tr('수강생 등록', 'Register learner') : tr('수강생 수정', 'Edit learner')} subtitle={mode === 'edit' ? f.ID : undefined}
      footer={<><AButton onClick={() => setF(mode === 'edit' && initial ? fromEdit(initial) : blank)}>{tr('다시 작성', 'Reset')}</AButton><AButton onClick={onClose}>{tr('취소', 'Cancel')}</AButton><AButton variant="primary" loading={save.isPending} onClick={submit}>{mode === 'new' ? tr('등록', 'Register') : tr('수정', 'Save')}</AButton></>}>
      {save.error && isAppError(save.error) ? <Callout tone="warn" className="u-mb-8">{save.error.message}</Callout> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldRow label={tr('아이디', 'ID')} htmlFor="mf-id" required={mode === 'new'} error={errors.ID}>{mode === 'new' ? <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AInput id="mf-id" value={f.ID} maxLength={20} onChange={(e) => { setF({ ...f, ID: e.target.value.trim() }); setIdMsg(null); }} /><AButton onClick={() => void checkId()} disabled={!f.ID}>{tr('중복 검색', 'Check')}</AButton>{idMsg ? <span style={{ fontSize: 12, color: idMsg.ok ? 'var(--ok, #1f7a3a)' : 'var(--danger, #c0392b)' }}>[ {idMsg.text} ]</span> : null}</div> : <div style={{ paddingTop: 6 }}><b>{f.ID}</b></div>}</FieldRow>
        {mode === 'new' ? <FieldRow label={tr('비밀번호', 'Password')} htmlFor="mf-pw" required error={errors.Pwd}><AInput id="mf-pw" value={f.Pwd} onChange={(e) => setF({ ...f, Pwd: e.target.value })} maxLength={64} /></FieldRow> : null}
        <FieldRow label={tr('이름', 'Name')} htmlFor="mf-name" required error={errors.Name}><AInput id="mf-name" value={f.Name} maxLength={50} onChange={(e) => setF({ ...f, Name: e.target.value })} /></FieldRow>
        <FieldRow label={tr('주민번호', 'Resident no.')} htmlFor="mf-res" required={mode === 'new'} error={errors.ResNo} help={tr('유효성 체크를 하지 않더라도 앞자리 생년월일과 뒷자리의 첫번째 숫자는 정확하게 입력하세요. (내국인 : 1~4, 외국인 : 5~8)', 'Even without the check, enter the birth date and the 7th digit correctly (1–4 citizens, 5–8 foreigners).')}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><AInput id="mf-res" style={{ width: 170 }} value={f.ResNo} maxLength={14} autoComplete="off" onChange={(e) => setF({ ...f, ResNo: e.target.value.replace(/[^0-9-]/g, '') })} /><ACheckbox label={tr('주민번호 유효성 체크하기', 'Validate checksum')} checked={f.checkResNo} onChange={(e) => setF({ ...f, checkResNo: e.target.checked })} /></div>
        </FieldRow>
        <FieldRow label={tr('성별', 'Gender')} htmlFor="mf-gender"><ASelect id="mf-gender" value={f.Gender} onChange={(e) => setF({ ...f, Gender: e.target.value })} options={[{ value: 'M', label: tr('남성', 'Male') }, { value: 'F', label: tr('여성', 'Female') }]} placeholder={tr('-- 성별 선택 --', '-- gender --')} /></FieldRow>
        <FieldRow label={tr('이메일', 'Email')} htmlFor="mf-email" error={errors.Email}><AInput id="mf-email" value={f.Email} maxLength={100} onChange={(e) => setF({ ...f, Email: e.target.value })} /></FieldRow>
        <FieldRow label={tr('전화번호', 'Phone')} htmlFor="mf-tel"><PhoneParts id="mf-tel" label={tr('전화번호', 'Phone')} value={f.Tel} onChange={(v) => setF({ ...f, Tel: v })} /></FieldRow>
        <FieldRow label={tr('휴대폰', 'Mobile')} htmlFor="mf-mob" required error={errors.Mobile}><PhoneParts id="mf-mob" label={tr('휴대폰', 'Mobile')} value={f.Mobile} onChange={(v) => setF({ ...f, Mobile: v })} /></FieldRow>
        <FieldRow label={tr('주소', 'Address')} htmlFor="mf-zip"><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><AInput id="mf-zip" style={{ width: 120 }} placeholder={tr('우편번호', 'Zip')} value={f.Zipcode} maxLength={10} onChange={(e) => setF({ ...f, Zipcode: e.target.value })} /><AInput aria-label={tr('주소', 'Address')} placeholder={tr('주소', 'Address')} value={f.Address01} maxLength={250} onChange={(e) => setF({ ...f, Address01: e.target.value })} /><AInput aria-label={tr('나머지 주소', 'Address line 2')} placeholder={tr('나머지 주소', 'Address line 2')} value={f.Address02} maxLength={250} onChange={(e) => setF({ ...f, Address02: e.target.value })} /></div></FieldRow>
        <FieldRow label={tr('영문이름', 'English name')} htmlFor="mf-eng"><AInput id="mf-eng" value={f.NameEng} maxLength={250} onChange={(e) => setF({ ...f, NameEng: e.target.value })} /></FieldRow>
        <FieldRow label={tr('회사명', 'Company')} htmlFor="mf-cname" help={f.CompanyCode ? `${tr('사업자번호', 'Biz no.')}: ${f.CompanyCode}` : undefined}><CompanyPicker idPrefix="mf" name={f.CompanyName} onName={(v) => setF({ ...f, CompanyName: v })} onPick={(code, name) => setF({ ...f, CompanyCode: code, CompanyName: name })} /></FieldRow>
        <FieldRow label={tr('부서', 'Department')} htmlFor="mf-dep"><AInput id="mf-dep" value={f.Depart} maxLength={250} onChange={(e) => setF({ ...f, Depart: e.target.value })} /></FieldRow>
        <FieldRow label={tr('직위', 'Title')} htmlFor="mf-pos"><AInput id="mf-pos" value={f.Position} maxLength={250} onChange={(e) => setF({ ...f, Position: e.target.value })} /></FieldRow>
        <FieldRow label={tr('관심분야', 'Interests')}><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{ETC01_OPTIONS.map((o) => <ACheckbox key={o} label={o} checked={f.Etc01.includes(o)} onChange={(e) => toggle('Etc01', o, e.target.checked)} />)}</div></FieldRow>
        <FieldRow label={tr('가입경로', 'Referral')}><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{ETC02_OPTIONS.map((o) => <ACheckbox key={o} label={o} checked={f.Etc02.includes(o)} onChange={(e) => toggle('Etc02', o, e.target.checked)} />)}</div></FieldRow>
        <FieldRow label={tr('메일링 서비스', 'Mailing')}><ACheckbox label={tr('최신 메일링 서비스를 받겠습니다.', 'Receive the newsletter.')} checked={f.Mailling} onChange={(e) => setF({ ...f, Mailling: e.target.checked })} /></FieldRow>
        <FieldRow label={tr('수강확인 문자발송', 'Enrolment SMS (ACS)')}><ACheckbox label={tr('수강확인 문자발송에 동의합니다.', 'Agree to enrolment SMS.')} checked={f.ACS} onChange={(e) => setF({ ...f, ACS: e.target.checked })} /></FieldRow>
        <FieldRow label={tr('교육담당자 여부', 'Training manager')}><ACheckbox label={tr('교육담당자로 설정합니다.', 'Set as training manager.')} checked={f.EduManager} onChange={(e) => setF({ ...f, EduManager: e.target.checked })} /></FieldRow>
        <FieldRow label={tr('계정 사용유무', 'Account')} htmlFor="mf-use"><ASelect id="mf-use" value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value === 'N' ? 'N' : 'Y' })} options={[{ value: 'Y', label: tr('사용', 'Active') }, { value: 'N', label: tr('미사용', 'Inactive') }]} /></FieldRow>
        <FieldRow label={tr('마케팅 수신동의', 'Marketing consent')} htmlFor="mf-mkt"><ASelect id="mf-mkt" value={f.Marketing === 'Y' ? 'Y' : 'N'} onChange={(e) => setF({ ...f, Marketing: e.target.value })} options={[{ value: 'Y', label: tr('수신허용', 'Allowed') }, { value: 'N', label: tr('수신거부', 'Declined') }]} /></FieldRow>
        {mode === 'edit' ? <FieldRow label={tr('추천 아이디', 'Referrer ID')}><div style={{ paddingTop: 6 }}>{f.recomId || '-'}</div></FieldRow> : null}
      </div>
    </DetailDrawer>
  );
}

/** Information_protection_regist2.php: 열람자 / 열람 항목 / 구분 / 사유 (한글·영문·숫자·공백). */
export function PrivacyReasonDialog({ open, item, loading, onCancel, onSubmit }: { open: boolean; item: string; loading?: boolean; onCancel: () => void; onSubmit: (gubun: string, reason: string) => void }) {
  const { admin } = useAdminSession();
  const [gubun, setGubun] = useState<string>(PRIVACY_GUBUN[0]);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setGubun(PRIVACY_GUBUN[0]); setReason(''); setErr(''); } }, [open]);
  const ok = () => {
    const r = reason.trim();
    if (!r) { setErr(tr('사유를 입력하세요.', 'Enter a reason.')); return; }
    if (!PRIVACY_REASON_RE.test(r)) { setErr(tr('사유에는 한글, 영문, 숫자, 공백만 입력 가능합니다.', 'Letters, digits and spaces only.')); return; }
    onSubmit(gubun, r);
  };
  return (
    <Modal open={open} onClose={onCancel} title={tr('개인정보 열람사유 작성', 'Reason for viewing personal data')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 320 }}>
        <FieldRow label={tr('열람자', 'Viewer')}><div style={{ paddingTop: 6 }}>{admin ? `${admin.name} (${admin.id})` : ''}</div></FieldRow>
        <FieldRow label={tr('열람 항목', 'Item')}><div style={{ paddingTop: 6 }}><b>{item}</b></div></FieldRow>
        <FieldRow label={tr('구분', 'Category')} htmlFor="pr-gubun"><ASelect id="pr-gubun" value={gubun} onChange={(e) => setGubun(e.target.value)} options={PRIVACY_GUBUN.map((g) => ({ value: g, label: g }))} /></FieldRow>
        <FieldRow label={tr('사유', 'Reason')} htmlFor="pr-reason" required error={err}><ATextarea id="pr-reason" rows={5} maxLength={1000} value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} /></FieldRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><AButton onClick={onCancel}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" loading={loading} onClick={ok}>{tr('등록 하기', 'Submit')}</AButton></div>
      </div>
    </Modal>
  );
}

/** member_testid_pop.php: 아이디(중복 검색) / 비밀번호(기본 1111) / 이름 / 계정 사용유무 / 수강 과정(옵션) / 수강기간. */
export function TestAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ ID: '', Pwd: '1111', Name: '테스트계정', UseYN: 'Y', LectureCode: '', Period: '3m' });
  const [idMsg, setIdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => { if (open) { setF({ ID: '', Pwd: '1111', Name: '테스트계정', UseYN: 'Y', LectureCode: '', Period: '3m' }); setIdMsg(null); setDone(null); } }, [open]);
  const opts = useQuery({ queryKey: ['admin', 'enrollments', 'options'], queryFn: ({ signal }) => adminApi.enrollmentOptions(signal), enabled: open, staleTime: 5 * 60_000 });
  const create = useAdminMutation({
    fn: () => adminMembersParityApi.createTestAccount({ ID: f.ID.trim(), Pwd: f.Pwd.trim() || '1111', Name: f.Name.trim() || '테스트계정', UseYN: f.UseYN, LectureCode: f.LectureCode || undefined, Period: f.Period }),
    invalidate: [['admin', 'members']],
    onSuccess: (r) => setDone(tr(`테스트 계정이 생성되었습니다. 아이디: ${r.id} / 비밀번호: ${r.password}${r.enrollment ? ` / 수강강의: ${r.enrollment.lectureCode} (${r.enrollment.lectureStart} ~ ${r.enrollment.lectureEnd}, 진도 0%)` : ''}`, `Test account created. ID ${r.id} / password ${r.password}${r.enrollment ? ` / course ${r.enrollment.lectureCode} (${r.enrollment.lectureStart} ~ ${r.enrollment.lectureEnd})` : ''}`)),
  });
  const checkId = async () => { if (!/^[A-Za-z0-9_-]{4,20}$/.test(f.ID)) { setIdMsg({ ok: false, text: tr('아이디는 영문/숫자/_/- 조합 4~20자로 입력하세요.', 'ID: 4–20 letters, digits, _ or -.') }); return; } const r = await adminMembersParityApi.checkId(f.ID); setIdMsg({ ok: r.available, text: r.message }); };
  const submit = () => {
    if (!f.ID.trim()) { setIdMsg({ ok: false, text: tr('아이디를 입력하세요.', 'Enter an ID.') }); return; }
    if (window.confirm(tr(`테스트 계정 '${f.ID}' 을(를) 생성하시겠습니까?${f.LectureCode ? `\n(강의 ${f.LectureCode} 에 수강등록됩니다)` : ''}`, `Create test account '${f.ID}'?`))) create.mutate(undefined);
  };
  const periods = [{ value: '1d', label: tr('하루', '1 day') }, { value: '3d', label: tr('3일', '3 days') }, { value: '1w', label: tr('일주일', '1 week') }, { value: '1m', label: tr('30일', '30 days') }, { value: '3m', label: tr('90일', '90 days') }];
  return (
    <Modal open={open} onClose={onClose} title={tr('테스트 계정 생성', 'Create test account')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 340 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{tr('본인인증 · 주민번호 · 개인정보 없이 로그인 테스트용 계정을 생성합니다. (TestID)', 'Creates a login-test account without identity check or personal data (TestID).')}</p>
        {done ? <Callout tone="ok">{done}</Callout> : null}
        {create.error && isAppError(create.error) ? <Callout tone="warn">{create.error.message}</Callout> : null}
        <FieldRow label={tr('아이디', 'ID')} htmlFor="ta-id" required><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><AInput id="ta-id" value={f.ID} maxLength={20} autoComplete="off" onChange={(e) => { setF({ ...f, ID: e.target.value.trim() }); setIdMsg(null); }} /><AButton onClick={() => void checkId()} disabled={!f.ID}>{tr('중복 검색', 'Check')}</AButton>{idMsg ? <span style={{ fontSize: 12 }}>[ {idMsg.text} ]</span> : null}</div></FieldRow>
        <FieldRow label={tr('비밀번호', 'Password')} htmlFor="ta-pw" required help={tr('(미입력 시 1111)', '(1111 when empty)')}><AInput id="ta-pw" value={f.Pwd} onChange={(e) => setF({ ...f, Pwd: e.target.value })} /></FieldRow>
        <FieldRow label={tr('이름', 'Name')} htmlFor="ta-name"><AInput id="ta-name" value={f.Name} maxLength={50} onChange={(e) => setF({ ...f, Name: e.target.value })} /></FieldRow>
        <FieldRow label={tr('계정 사용유무', 'Account')} htmlFor="ta-use"><ASelect id="ta-use" value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value })} options={[{ value: 'Y', label: tr('사용', 'Active') }, { value: 'N', label: tr('미사용', 'Inactive') }]} /></FieldRow>
        <FieldRow label={tr('수강 과정 (옵션)', 'Course (optional)')} htmlFor="ta-course" help={tr('과정을 선택하면 생성된 계정을 해당 과정에 수강등록합니다. (진도 0%) — 미선택 시 계정만 생성', 'Enrols the account (0%) when a course is chosen.')}><ASelect id="ta-course" value={f.LectureCode} onChange={(e) => setF({ ...f, LectureCode: e.target.value })} options={(opts.data?.courses ?? []).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` }))} placeholder={tr('-- 선택 안 함 (계정만 생성) --', '-- none (account only) --')} loading={opts.isPending} /></FieldRow>
        <FieldRow label={tr('수강기간', 'Period')} htmlFor="ta-period" help={tr('(강의코드 입력 시에만 적용, 시작일=오늘)', '(only with a course; starts today)')}><ASelect id="ta-period" value={f.Period} onChange={(e) => setF({ ...f, Period: e.target.value })} options={periods} /></FieldRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" loading={create.isPending} onClick={submit} disabled={!!done}>{tr('생성', 'Create')}</AButton></div>
      </div>
    </Modal>
  );
}
