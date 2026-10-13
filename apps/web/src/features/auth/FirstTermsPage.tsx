import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { membersApi } from '../../shared/api/endpoints/members';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { safeNext } from '../../shared/auth/roles';
import { Button } from '../../shared/ui/Button';
import { Checkbox, FormMessage } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { auth as copy, legal } from '../../shared/strings/ko';

/** Forced terms re-acceptance after login (next='terms') → POST /members/me/terms. */
export default function FirstTermsPage() {
  const { isAuthed, phase, patchUser, user } = useSession();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [state, setState] = useState({ terms: false, privacy: false, marketing: false });
  const [error, setError] = useState('');
  const accept = useMutation({
    mutationFn: () => membersApi.acceptTerms({ terms: true, privacy: true, marketing: state.marketing }),
    onSuccess: () => { patchUser({ flags: { termsPending: false, mustChangePassword: user?.flags.mustChangePassword ?? false } }); navigate(user?.flags.mustChangePassword ? `/auth/password-change${next ? `?next=${encodeURIComponent(next)}` : ''}` : (next ?? '/home'), { replace: true }); },
    onError: (e) => setError(isAppError(e) ? e.message : copy.validation.required),
  });
  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" page />;
  const t = copy.signup.terms;
  return (
    <div>
      <div className="page-heading"><div className="crumb">{copy.firstTerms.crumb}</div><h1>{copy.firstTerms.title}</h1><p>{copy.firstTerms.lead}</p></div>
      <section className={styles.section}>
        <div className={`${styles.card} ${styles.single}`}>
          {t.items.map((it) => (
            <div key={it.key}>
              <div className={styles.consentRow}><Checkbox label={<>{it.label} <b>({it.required ? '필수' : '선택'})</b></>} checked={state[it.key as keyof typeof state]} onChange={(e) => setState((s) => ({ ...s, [it.key]: e.target.checked }))} /></div>
              <div className={styles.docBox}>{(it.key === 'terms' ? legal.terms.sections : legal.privacy.sections).map((s) => <div key={s.id}><h4>{s.title}</h4><p>{s.body}</p></div>)}</div>
            </div>
          ))}
          <FormMessage>{error}</FormMessage>
          <Button square block loading={accept.isPending} onClick={() => { if (!state.terms || !state.privacy) { setError(t.error); return; } setError(''); accept.mutate(); }}>{copy.firstTerms.submit}</Button>
          <div className={styles.note}>{copy.passwordChange.note}</div>
        </div>
      </section>
    </div>
  );
}
