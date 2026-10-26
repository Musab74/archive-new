import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { FindShell } from './FindShell';
import { membersApi } from '../../shared/api/endpoints/members';
import { isAppError } from '../../shared/api/client';
import { isMobile, LEGACY_MEMBER_PAGES } from '../../shared/auth/accountRules';
import { Button } from '../../shared/ui/Button';
import { FormField, FormMessage, Input } from '../../shared/ui/Form';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

/** Shown when the SMS step is not connected in this API: the same screen on the existing site works with the same account. */
export function LegacyNotice({ href, label }: { href: string; label: string }) {
  return (
    <div className={styles.legacyBox} role="note">
      <span>{copy.find.notConfigured}</span>
      <small>{copy.find.identityNote}</small>
      <Button variant="secondary" size="sm" square href={href}>{label}</Button>
    </div>
  );
}

/**
 * AR-20 07 아이디 찾기 = public/member/find_id.html → POST /members/find-id {name, mobile} (search_id_result.php): the id is
 * sent by SMS to the registered mobile, never shown here.
 */
export default function FindIdPage() {
  const f = copy.find;
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const find = useMutation({ mutationFn: () => membersApi.findId({ name: name.trim(), mobile: mobile.trim() }), onError: (e) => setError(isAppError(e) ? e.message : errorCopy.network) });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = !name.trim() ? f.nameRequired : !mobile.trim() ? f.mobileRequired : !isMobile(mobile) ? f.mobileDigits : '';
    setError(err);
    if (!err) find.mutate();
  };
  const r = find.data;
  return (
    <FindShell>
      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <h3>{f.idTitle}</h3>
        <p>{f.idLead}</p>
        <FormField label={f.name} required htmlFor="fi-name"><Input id="fi-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={50} /></FormField>
        <FormField label={f.mobile} required htmlFor="fi-mobile"><Input id="fi-mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder={f.mobilePlaceholder} autoComplete="tel" maxLength={13} /></FormField>
        <FormMessage>{error}</FormMessage>
        <Button type="submit" square loading={find.isPending}>{f.idSubmit}</Button>
        {r ? (
          <div className={styles.sub} role="status">
            <FormMessage tone={r.sent ? 'ok' : 'error'}>{r.message}</FormMessage>
            {r.sent ? <Button square to="/auth/login">{f.toLogin}</Button> : r.code === 'SEND_NOT_CONFIGURED' ? <LegacyNotice href={LEGACY_MEMBER_PAGES.findId} label={f.legacyFindId} /> : null}
          </div>
        ) : null}
        <div className={styles.links}><a href="/auth/find-password">{copy.login.findPassword}</a><a href="/auth/login">{copy.login.submit}</a></div>
      </form>
    </FindShell>
  );
}
