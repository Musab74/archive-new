import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { continueAfterStep } from './FirstTermsPage';
import { authApi } from '../../shared/api/endpoints/auth';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { safeNext } from '../../shared/auth/roles';
import { passwordPolicyError, rememberPasswordSkip } from '../../shared/auth/accountRules';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

/** First failing check of function.js PassFirstChangeSubmit() / MemberEdit(), plus the current-password field. */
export function passwordChangeError(f: { current: string; pw: string; pw2: string }): string {
  if (!f.current) return copy.validation.required;
  if (!f.pw) return '비밀번호를 입력하세요.';
  const rule = passwordPolicyError(f.pw);
  if (rule) return rule;
  if (!f.pw2) return copy.signup.info.passwordConfirmRequired;
  if (f.pw !== f.pw2) return copy.signup.info.passwordMismatch;
  if (f.pw === f.current) return copy.passwordChange.sameAsCurrent;
  return '';
}

/**
 * 초기 비밀번호 변경 (PassChange='N', next='password') and 비밀번호 변경 from 회원·이용정보 → POST /auth/password/change
 * (mypage/pass_first_change_ok.php). 「나중에 변경하기」 = m/m_public/member/pwd_first_change.html (90 days, this browser).
 */
export default function PasswordChangePage() {
  const { isAuthed, phase, patchUser, user } = useSession();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [form, setForm] = useState({ current: '', pw: '', pw2: '' });
  const [error, setError] = useState('');
  const c = copy.passwordChange;
  const change = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: form.current, newPassword: form.pw }),
    onSuccess: async () => {
      patchUser({ flags: { termsPending: user?.flags.termsPending ?? false, mustChangePassword: false } });
      toast(c.done, { tone: 'ok' });
      await continueAfterStep(navigate, user?.id, next);
    },
    onError: (e) => setError(isAppError(e) ? (e.code === 'INVALID_CREDENTIALS' ? '현재 비밀번호를 확인해 주세요.' : e.message) : errorCopy.network),
  });
  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" page />;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = passwordChangeError(form);
    setError(err);
    if (!err) change.mutate();
  };
  const later = async () => { if (user) rememberPasswordSkip(user.id); await continueAfterStep(navigate, user?.id, next); };
  return (
    <div>
      <div className="page-heading"><div className="crumb">{c.crumb}</div><h1>{c.title}</h1><p>{c.lead}</p></div>
      <section className={styles.section}>
        <form className={`${styles.card} ${styles.single}`} onSubmit={onSubmit} noValidate>
          <FormField label={c.current} required htmlFor="pc-cur" help={user?.flags.mustChangePassword ? c.currentHelp : undefined}><Input id="pc-cur" type="password" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} autoComplete="current-password" maxLength={200} /></FormField>
          <FormField label={c.newPassword} required htmlFor="pc-pw" help={copy.signup.info.passwordHelp}><Input id="pc-pw" type="password" value={form.pw} onChange={(e) => setForm((f) => ({ ...f, pw: e.target.value }))} autoComplete="new-password" maxLength={100} /></FormField>
          <FormField label={c.newPasswordConfirm} required htmlFor="pc-pw2"><Input id="pc-pw2" type="password" value={form.pw2} onChange={(e) => setForm((f) => ({ ...f, pw2: e.target.value }))} autoComplete="new-password" maxLength={100} /></FormField>
          <FormMessage>{error}</FormMessage>
          <Button type="submit" square loading={change.isPending}>{c.submit}</Button>
          {user?.flags.mustChangePassword ? <><Button variant="secondary" square onClick={() => void later()}>{c.later}</Button><p className={styles.help}>{c.laterNote}</p></> : null}
          <div className={styles.note}>{c.note}</div>
        </form>
      </section>
    </div>
  );
}
