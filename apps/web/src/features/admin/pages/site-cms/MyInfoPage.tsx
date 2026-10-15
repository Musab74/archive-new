import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import { AButton, ACheckbox, AdminPage, AInput, Card, DescList, FieldRow } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { joinPhone, splitPhone, staffPasswordError } from './siteCms.helpers';

interface Form { Team: string; Mobile: [string, string, string]; Phone: [string, string, string]; Email: string; BankName: string; BankNumber: string; PwdChange: boolean; Passwd: string; Passwd2: string; Current: string }
const EMPTY: Form = { Team: '', Mobile: ['', '', ''], Phone: ['', '', ''], Email: '', BankName: '', BankNumber: '', PwdChange: false, Passwd: '', Passwd2: '', Current: '' };

/**
 * my_info.php / my_info_script.php — 정보변경 (the signed-in staff member edits their own StaffInfo row).
 * Not behind useWriteGate(): every department, including 영업 (B, otherwise read-only), may save its own profile, as the PHP allowed.
 */
export default function MyInfoPage() {
  const { toast } = useToast();
  const me = useQuery({ queryKey: ['admin', 'my-info'], queryFn: ({ signal }) => adminSiteCmsApi.myInfo(signal) });
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { const d = me.data; if (d) setF({ ...EMPTY, Team: d.team ?? '', Mobile: splitPhone(d.mobile), Phone: splitPhone(d.phone), Email: d.email ?? '', BankName: d.bankName ?? '', BankNumber: d.bankNumber ?? '' }); }, [me.data]);
  const save = useAdminMutation({
    fn: () => adminSiteCmsApi.updateMyInfo({ Team: f.Team.trim(), Mobile: joinPhone(...f.Mobile), Phone: joinPhone(...f.Phone), Email: f.Email.trim(), BankName: f.BankName.trim() || null, BankNumber: f.BankNumber.trim() || null, ...(f.PwdChange ? { currentPassword: f.Current, newPassword: f.Passwd } : {}) }),
    invalidate: [['admin', 'my-info']], success: tr('처리되었습니다.', 'Saved.'),
    onSuccess: () => setF((s) => ({ ...s, PwdChange: false, Passwd: '', Passwd2: '', Current: '' })),
    onError: (err) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); },
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.Team.trim()) e.Team = tr('소속을 입력하세요.', 'Enter your team.');
    if (f.PwdChange) {
      if (!f.Current) e.currentPassword = tr('현재 비밀번호를 입력하세요.', 'Enter your current password.');
      if (!f.Passwd) e.newPassword = tr('비밀번호를 입력하세요.', 'Enter a password.');
      else { const pe = staffPasswordError(f.Passwd); if (pe) e.newPassword = pe; }
      if (!e.newPassword && f.Passwd !== f.Passwd2) e.Passwd2 = tr('비밀번호가 일치하지 않습니다.', 'Passwords do not match.');
    }
    if (f.Mobile.some((s) => !s.trim())) e.Mobile = tr('휴대폰을 입력하세요.', 'Enter your mobile number.');
    if (!f.Email.trim()) e.Email = tr('이메일을 입력하세요.', 'Enter your e-mail.');
    setErrors(e); if (Object.keys(e).length) return;
    if (window.confirm(tr('수정 하시겠습니까?', 'Save changes?'))) save.mutate(undefined as never);
  };
  const tri = (k: 'Mobile' | 'Phone', id: string) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[3, 4, 4].map((len, i) => <span key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{i > 0 ? '-' : null}<AInput id={i === 0 ? id : undefined} aria-label={`${k} ${i + 1}`} value={f[k][i]} maxLength={len} inputMode="numeric" style={{ width: 90 }} onChange={(e) => { const next = [...f[k]] as [string, string, string]; next[i] = e.target.value.replace(/\D/g, ''); setF({ ...f, [k]: next }); }} /></span>)}
    </div>
  );
  const d = me.data;
  return (
    <AdminPage title={tr('정보변경', 'My profile')} lead={tr('로그인한 운영자 본인의 소속·연락처·이메일·계좌·비밀번호를 변경합니다.', 'Edit your own team, contact details, bank account and password.')}>
      {d ? (
        <div style={{ display: 'grid', gap: 12, maxWidth: 860 }}>
          <Card title={tr('계정', 'Account')}>
            <DescList cols={2} items={[[tr('카테고리', 'Category'), d.deptPath], [tr('아이디', 'User ID'), <b key="id" className="mono">{d.id}</b>], [tr('이 름', 'Name'), d.name], [tr('최근 로그인', 'Last login'), d.lastLogin ? `${d.lastLogin} (${d.lastLoginIp ?? ''})` : null]]} />
          </Card>
          <Card title={tr('정보 수정', 'Edit')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FieldRow label={tr('소 속', 'Team')} htmlFor="mi-team" required error={errors.Team}><AInput id="mi-team" value={f.Team} onChange={(e) => setF({ ...f, Team: e.target.value })} maxLength={50} /></FieldRow>
              <FieldRow label={tr('비밀번호', 'Password')} htmlFor="mi-pw" error={errors.newPassword} help={tr('* 비밀번호 변경시 체크하세요. (영문, 숫자, 특수문자 중 2개 이상의 조합으로 10자 이상 또는 3개 이상의 조합으로 8자 이상)', '* Tick to change. 10+ chars with 2 of letters/digits/specials, or 8+ with all 3.')}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <AInput id="mi-pw" type="password" value={f.PwdChange ? f.Passwd : '********'} disabled={!f.PwdChange} autoComplete="new-password" maxLength={64} style={{ width: 220 }} onChange={(e) => setF({ ...f, Passwd: e.target.value })} />
                  <ACheckbox label={tr('비밀번호 변경', 'Change password')} checked={f.PwdChange} onChange={(e) => setF({ ...f, PwdChange: e.target.checked, Passwd: '', Passwd2: '', Current: '' })} />
                </div>
              </FieldRow>
              <FieldRow label={tr('비밀번호 재입력', 'Repeat password')} htmlFor="mi-pw2" error={errors.Passwd2} help={tr('* 비밀번호는 암호화 되어 저장되어 있습니다. 확인은 불가능하며 변경만 가능합니다.', '* Passwords are stored hashed; they can only be changed, not shown.')}><AInput id="mi-pw2" type="password" value={f.PwdChange ? f.Passwd2 : '********'} disabled={!f.PwdChange} autoComplete="new-password" maxLength={64} style={{ width: 220 }} onChange={(e) => setF({ ...f, Passwd2: e.target.value })} /></FieldRow>
              {f.PwdChange ? <FieldRow label={tr('현재 비밀번호', 'Current password')} htmlFor="mi-cur" required error={errors.currentPassword}><AInput id="mi-cur" type="password" value={f.Current} autoComplete="current-password" maxLength={64} style={{ width: 220 }} onChange={(e) => setF({ ...f, Current: e.target.value })} /></FieldRow> : null}
              <FieldRow label={tr('휴대폰', 'Mobile')} htmlFor="mi-mobile" required error={errors.Mobile}>{tri('Mobile', 'mi-mobile')}</FieldRow>
              <FieldRow label={tr('연락처', 'Phone')} htmlFor="mi-phone" error={errors.Phone}>{tri('Phone', 'mi-phone')}</FieldRow>
              {d.showBank ? <FieldRow label={tr('계좌정보', 'Bank account')}><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{tr('은행명', 'Bank')} : <AInput aria-label={tr('은행명', 'Bank')} value={f.BankName} maxLength={50} style={{ width: 140 }} onChange={(e) => setF({ ...f, BankName: e.target.value })} /> {tr('계좌번호', 'Account no.')} : <AInput aria-label={tr('계좌번호', 'Account no.')} value={f.BankNumber} maxLength={50} style={{ width: 260 }} onChange={(e) => setF({ ...f, BankNumber: e.target.value })} /></div></FieldRow> : null}
              <FieldRow label={tr('이메일', 'E-mail')} htmlFor="mi-email" required error={errors.Email}><AInput id="mi-email" type="text" inputMode="email" value={f.Email} maxLength={50} onChange={(e) => setF({ ...f, Email: e.target.value })} /></FieldRow>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><AButton variant="primary" loading={save.isPending} onClick={submit}>{tr('수정 하기', 'Save')}</AButton></div>
          </Card>
        </div>
      ) : me.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
    </AdminPage>
  );
}
