import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';
import { SignupShell } from './SignupShell';
import { ConsentList, consentError } from './ConsentList';
import { emptyConsents, readConsent, writeConsent } from './signupState';
import { Button } from '../../shared/ui/Button';
import { FormMessage } from '../../shared/ui/Form';
import { auth as copy } from '../../shared/strings/ko';

/** AR-20 06-1 약관 동의 = public/member/join_terms.html: items start unchecked; only the three required ones gate the next step. */
export default function SignupTermsPage() {
  const navigate = useNavigate();
  const t = copy.signup.terms;
  const [state, setState] = useState(() => readConsent() ?? emptyConsents());
  const [error, setError] = useState('');
  const next = () => {
    const err = consentError(state);
    if (err) { setError(err); return; }
    writeConsent(state);
    navigate('/auth/signup/info');
  };
  return (
    <SignupShell step={0}>
      <div className={styles.card}>
        <h3>{t.title}</h3>
        <p>{t.lead}</p>
        <ConsentList value={state} onChange={(c) => { setState(c); setError(''); }} />
        <FormMessage>{error}</FormMessage>
        <Button square block onClick={next}>{t.next}</Button>
      </div>
    </SignupShell>
  );
}
