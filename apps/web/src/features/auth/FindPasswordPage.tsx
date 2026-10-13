import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { FindShell } from './FindShell';
import { membersApi } from '../../shared/api/endpoints/members';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { FormField, FormMessage, Input } from '../../shared/ui/Form';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

/** AR-20 07 비밀번호 찾기: id + name + email → POST /members/password-reset issues a temporary password (PassChange=N forces a change at next login). */
export default function FindPasswordPage() {
  const f = copy.find;
  const [form, setForm] = useState({ id: '', name: '', email: '' });
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }));
  const reset = useMutation({ mutationFn: () => membersApi.passwordReset({ id: form.id.trim(), name: form.name.trim(), email: form.email.trim() }), onError: (e) => setError(isAppError(e) ? (e.status === 404 ? f.notFound : e.message) : errorCopy.network) });
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (!form.id.trim() || !form.name.trim() || !form.email.trim()) { setError(copy.validation.required); return; } setError(''); reset.mutate(); };

  if (reset.isSuccess) {
    return (
      <FindShell>
        <div className={styles.card} role="status">
          <div className={`${styles.symbol} ${styles.mint}`} aria-hidden="true"><Icon name="check" size={27} /></div>
          <h3>{f.done}</h3>
          {reset.data.tempPassword ? (<><p>{f.tempPassword}</p><p className={styles.resultId}>{reset.data.tempPassword}</p><p>{f.doneBody}</p></>) : <p>{f.sentBody}</p>}
          <Button square to="/auth/login">{f.toLogin}</Button>
        </div>
      </FindShell>
    );
  }
  return (
    <FindShell>
      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <h3>{f.pwTitle}</h3>
        <FormField label={f.id} required htmlFor="fp-id"><Input id="fp-id" value={form.id} onChange={set('id')} autoComplete="username" maxLength={50} /></FormField>
        <FormField label={f.name} required htmlFor="fp-name"><Input id="fp-name" value={form.name} onChange={set('name')} autoComplete="name" maxLength={50} /></FormField>
        <FormField label={f.email} required htmlFor="fp-email"><Input id="fp-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={100} /></FormField>
        <FormMessage>{error}</FormMessage>
        <Button type="submit" square loading={reset.isPending}>{f.submit}</Button>
        <div className={styles.note}>{f.pwNote}</div>
        <div className={styles.links}><a href="/auth/find-id">{copy.login.findId}</a><a href="/auth/login">{copy.login.submit}</a></div>
      </form>
    </FindShell>
  );
}
