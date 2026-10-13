import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { authApi } from '../../shared/api/endpoints/auth';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { safeNext } from '../../shared/auth/roles';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

/** First-login / forced password change → POST /auth/password/change. */
export default function PasswordChangePage() {
  const { isAuthed, phase, patchUser, user } = useSession();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [form, setForm] = useState({ current: '', pw: '', pw2: '' });
  const [error, setError] = useState('');
  const change = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: form.current, newPassword: form.pw }),
    onSuccess: () => { patchUser({ flags: { termsPending: user?.flags.termsPending ?? false, mustChangePassword: false } }); toast(copy.find.done, { tone: 'ok' }); navigate(next ?? '/home', { replace: true }); },
    onError: (e) => setError(isAppError(e) ? (e.code === 'INVALID_CREDENTIALS' ? '현재 비밀번호를 확인해 주세요.' : e.message) : errorCopy.network),
  });
  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" page />;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.current) { setError(copy.validation.required); return; }
    if (form.pw.length < 8) { setError(copy.validation.passwordRule); return; }
    if (form.pw !== form.pw2) { setError(copy.signup.info.passwordMismatch); return; }
    if (form.pw === form.current) { setError('현재 비밀번호와 다른 비밀번호를 입력해 주세요.'); return; }
    setError(''); change.mutate();
  };
  const c = copy.passwordChange;
  return (
    <div>
      <div className="page-heading"><div className="crumb">{c.crumb}</div><h1>{c.title}</h1><p>{c.lead}</p></div>
      <section className={styles.section}>
        <form className={`${styles.card} ${styles.single}`} onSubmit={onSubmit} noValidate>
          <FormField label={c.current} required htmlFor="pc-cur"><Input id="pc-cur" type="password" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} autoComplete="current-password" maxLength={200} /></FormField>
          <FormField label={copy.find.newPassword} required htmlFor="pc-pw" help={c.rule}><Input id="pc-pw" type="password" value={form.pw} onChange={(e) => setForm((f) => ({ ...f, pw: e.target.value }))} autoComplete="new-password" maxLength={100} /></FormField>
          <FormField label={copy.find.newPasswordConfirm} required htmlFor="pc-pw2"><Input id="pc-pw2" type="password" value={form.pw2} onChange={(e) => setForm((f) => ({ ...f, pw2: e.target.value }))} autoComplete="new-password" maxLength={100} /></FormField>
          <FormMessage>{error}</FormMessage>
          <Button type="submit" square loading={change.isPending}>{c.submit}</Button>
          <div className={styles.note}>{c.note}</div>
        </form>
      </section>
    </div>
  );
}
