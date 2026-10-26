import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { FindShell } from './FindShell';
import { LegacyNotice } from './FindIdPage';
import { membersApi, type AccountSmsResult } from '../../shared/api/endpoints/members';
import { isAppError } from '../../shared/api/client';
import { isMobile, LEGACY_MEMBER_PAGES } from '../../shared/auth/accountRules';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { FormField, FormMessage, Input } from '../../shared/ui/Form';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

/** function.js PWD_Verify_OTP() checks. */
export function otpError(otp: string): string {
  if (!otp) return copy.find.otpRequired;
  if (otp.length !== 6) return copy.find.otpLength;
  if (!/^\d+$/.test(otp)) return copy.find.otpDigits;
  return '';
}

/**
 * AR-20 07 비밀번호 찾기 = public/member/find_pw.html: 아이디 + 이름 + 휴대폰 → 인증번호 (5분, search_pw_otp_send.php) →
 * 인증번호 확인 → 임시 비밀번호 by SMS (search_pw_result.php, PassChange=N so the next login asks for a new password).
 */
export default function FindPasswordPage() {
  const f = copy.find;
  const [form, setForm] = useState({ id: '', name: '', mobile: '' });
  const [otp, setOtp] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<AccountSmsResult | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }));
  const send = useMutation({
    mutationFn: () => membersApi.passwordOtp({ id: form.id.trim(), name: form.name.trim(), mobile: form.mobile.trim() }),
    onSuccess: (r) => { setNotice(r); setChallenge(r.sent && r.challenge ? r.challenge : null); setOtp(''); },
    onError: (e) => setError(isAppError(e) ? e.message : errorCopy.network),
  });
  const verify = useMutation({
    mutationFn: () => membersApi.passwordOtpVerify({ id: form.id.trim(), challenge: challenge ?? '', otp: otp.trim() }),
    onSuccess: (r) => { setNotice(r); if (r.sent) setChallenge(null); },
    onError: (e) => setError(isAppError(e) ? e.message : errorCopy.network),
  });

  const onSend = (e: FormEvent) => {
    e.preventDefault();
    const err = !form.id.trim() ? f.idRequired : !form.name.trim() ? f.nameRequired : !form.mobile.trim() ? f.mobileRequired : !isMobile(form.mobile) ? f.mobileDigits : '';
    setError(err); setNotice(null);
    if (!err) send.mutate();
  };
  const onVerify = (e: FormEvent) => {
    e.preventDefault();
    const err = otpError(otp.trim());
    setError(err);
    if (!err) verify.mutate();
  };

  if (verify.data?.sent) {
    return (
      <FindShell>
        <div className={styles.card} role="status">
          <div className={`${styles.symbol} ${styles.mint}`} aria-hidden="true"><Icon name="check" size={27} /></div>
          <h3>{f.done}</h3>
          <p>{verify.data.message}</p>
          <p>{f.doneBody}</p>
          <Button square to="/auth/login">{f.toLogin}</Button>
        </div>
      </FindShell>
    );
  }
  const step2 = !!challenge;
  return (
    <FindShell>
      <form className={styles.card} onSubmit={step2 ? onVerify : onSend} noValidate>
        <h3>{f.pwTitle}</h3>
        <p>{f.pwLead}</p>
        <FormField label={f.id} required htmlFor="fp-id"><Input id="fp-id" value={form.id} onChange={set('id')} autoComplete="username" maxLength={50} disabled={step2} /></FormField>
        <FormField label={f.name} required htmlFor="fp-name"><Input id="fp-name" value={form.name} onChange={set('name')} autoComplete="name" maxLength={50} disabled={step2} /></FormField>
        <FormField label={f.mobile} required htmlFor="fp-mobile"><Input id="fp-mobile" type="tel" value={form.mobile} onChange={set('mobile')} placeholder={f.mobilePlaceholder} autoComplete="tel" maxLength={13} disabled={step2} /></FormField>
        {step2 ? (
          <FormField label={f.otp} required htmlFor="fp-otp" help={f.otpHelp}>
            <Input id="fp-otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder={f.otpPlaceholder} maxLength={6} />
          </FormField>
        ) : null}
        {notice && !error ? <FormMessage tone={notice.sent ? 'ok' : 'error'}>{notice.message}</FormMessage> : null}
        <FormMessage>{error}</FormMessage>
        {notice?.code === 'SEND_NOT_CONFIGURED' ? <LegacyNotice href={LEGACY_MEMBER_PAGES.findPassword} label={f.legacyFindPassword} /> : null}
        <div className={styles.actions}>
          <Button type="submit" square loading={step2 ? verify.isPending : send.isPending}>{step2 ? f.verify : f.sendOtp}</Button>
          {step2 ? <Button variant="secondary" square onClick={() => { setError(''); send.mutate(); }} loading={send.isPending}>{f.resendOtp}</Button> : null}
        </div>
        <div className={styles.links}><a href="/auth/find-id">{copy.login.findId}</a><a href="/auth/login">{copy.login.submit}</a></div>
      </form>
    </FindShell>
  );
}
