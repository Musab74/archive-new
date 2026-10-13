import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { FindShell } from './FindShell';
import { membersApi } from '../../shared/api/endpoints/members';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input } from '../../shared/ui/Form';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

/** AR-20 07 아이디 찾기 → POST /members/find-id {name, email} (masked ids in the response). */
export default function FindIdPage() {
  const f = copy.find;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const find = useMutation({ mutationFn: () => membersApi.findId({ name: name.trim(), email: email.trim() }), onError: (e) => setError(isAppError(e) ? (e.status === 404 ? f.notFound : e.message) : errorCopy.network) });
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (!name.trim() || !email.trim()) { setError(copy.validation.required); return; } setError(''); find.mutate(); };
  return (
    <FindShell>
      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <h3>{f.idTitle}</h3>
        <FormField label={f.name} required htmlFor="fi-name"><Input id="fi-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={50} /></FormField>
        <FormField label={f.email} required htmlFor="fi-email"><Input id="fi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={100} /></FormField>
        <FormMessage>{error}</FormMessage>
        <Button type="submit" square loading={find.isPending}>{f.submit}</Button>
        <div className={styles.note}>{f.idNoteEmail}</div>
        {find.data ? (
          <div className={styles.sub} role="status">
            <b>{f.idResult}</b>
            {find.data.ids.length === 0 ? <p>{f.notFound}</p> : find.data.ids.map((row) => (
              <p key={row.id} className={styles.resultId}>{row.id}{row.regDate ? <small> · {f.joined} {row.regDate}</small> : null}</p>
            ))}
            <Button square to="/auth/login">{f.toLogin}</Button>
          </div>
        ) : null}
        <div className={styles.links}><a href="/auth/find-password">{copy.login.findPassword}</a><a href="/auth/login">{copy.login.submit}</a></div>
      </form>
    </FindShell>
  );
}
