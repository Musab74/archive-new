import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import styles from './Auth.module.css';
import { ConsentList, consentError } from './ConsentList';
import { emptyConsents } from './signupState';
import { membersApi, marketingCode } from '../../shared/api/endpoints/members';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { routeForNext, safeNext } from '../../shared/auth/roles';
import { hasPasswordSkip } from '../../shared/auth/accountRules';
import { Button } from '../../shared/ui/Button';
import { FormMessage } from '../../shared/ui/Form';
import { StateBlock } from '../../shared/ui/StateBlock';
import { auth as copy, errors as errorCopy } from '../../shared/strings/ko';

/** Where to go after a login step: GET /members/me/routing (login_ok.php order), keeping a safe `next` for home. */
export async function continueAfterStep(navigate: (to: string, opts?: { replace?: boolean }) => void, userId: string | undefined, next: string | null) {
  try {
    const r = await membersApi.routing({ skipPassword: !!userId && hasPasswordSkip(userId) });
    const target = r.next === 'home' || r.next === 'classroom' ? (next ?? routeForNext(r.next)) : routeForNext(r.next);
    navigate(r.next === 'home' || r.next === 'classroom' ? target : `${target}${next ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true });
  } catch {
    navigate(next ?? '/home', { replace: true });
  }
}

/**
 * Forced consent after login (Member.Mandatory='N', next='terms') = public/member/after_join_terms.html →
 * POST /members/me/terms (term_state_update.php), then the rest of the login routing (password change, 진단, home).
 */
export default function FirstTermsPage() {
  const { isAuthed, phase, patchUser, user } = useSession();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [state, setState] = useState(emptyConsents);
  const [error, setError] = useState('');
  const accept = useMutation({
    mutationFn: () => membersApi.acceptTerms({ sending: state.sending, marketing: marketingCode(state.marketingEmail, state.marketingSms) }),
    onSuccess: async () => {
      patchUser({ flags: { termsPending: false, mustChangePassword: user?.flags.mustChangePassword ?? false } });
      await continueAfterStep(navigate, user?.id, next);
    },
    onError: (e) => setError(isAppError(e) ? e.message : errorCopy.network),
  });
  if (phase !== 'booting' && !isAuthed) return <StateBlock code="LOGIN" page />;
  return (
    <div>
      <div className="page-heading"><div className="crumb">{copy.firstTerms.crumb}</div><h1>{copy.firstTerms.title}</h1><p>{copy.firstTerms.lead}</p></div>
      <section className={styles.section}>
        <div className={`${styles.card} ${styles.single}`}>
          <ConsentList value={state} onChange={(c) => { setState(c); setError(''); }} />
          <FormMessage>{error}</FormMessage>
          <Button square block loading={accept.isPending} onClick={() => { const err = consentError(state); if (err) { setError(err); return; } setError(''); accept.mutate(); }}>{copy.firstTerms.submit}</Button>
          <div className={styles.note}>{copy.passwordChange.note}</div>
        </div>
      </section>
    </div>
  );
}
