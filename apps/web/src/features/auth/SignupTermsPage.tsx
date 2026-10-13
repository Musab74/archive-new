import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';
import { SignupShell } from './SignupShell';
import { readConsent, writeConsent } from './signupState';
import { Button } from '../../shared/ui/Button';
import { Checkbox, FormMessage } from '../../shared/ui/Form';
import { auth as copy, legal } from '../../shared/strings/ko';

/** AR-20 06-1 약관 동의: items start unchecked; only required ones gate the next step. */
export default function SignupTermsPage() {
  const navigate = useNavigate();
  const t = copy.signup.terms;
  const [state, setState] = useState(() => readConsent() ?? { terms: false, privacy: false, marketing: false });
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const all = state.terms && state.privacy && state.marketing;
  const next = () => {
    if (!state.terms || !state.privacy) { setError(t.error); return; }
    writeConsent(state);
    navigate('/auth/signup/info');
  };
  const docFor = (key: string) => (key === 'terms' ? legal.terms.sections : legal.privacy.sections);
  return (
    <SignupShell step={0}>
      <div className={styles.card}>
        <h3>{t.title}</h3>
        <p>{t.lead}</p>
        <div className={styles.consentAll}><Checkbox label={t.all} checked={all} onChange={(e) => setState({ terms: e.target.checked, privacy: e.target.checked, marketing: e.target.checked })} /></div>
        {t.items.map((it) => (
          <div key={it.key}>
            <div className={styles.consentRow}>
              <Checkbox label={<>{it.label} <b>({it.required ? '필수' : '선택'})</b></>} checked={state[it.key as keyof typeof state]} onChange={(e) => setState((s) => ({ ...s, [it.key]: e.target.checked }))} />
              <Button variant="text" size="xs" onClick={() => setOpen(open === it.key ? null : it.key)} aria-expanded={open === it.key}>{t.view}</Button>
            </div>
            {open === it.key ? <div className={styles.docBox}>{docFor(it.key).map((s) => <div key={s.id}><h4>{s.title}</h4><p>{s.body}</p></div>)}</div> : null}
          </div>
        ))}
        <FormMessage>{error}</FormMessage>
        <Button square block onClick={next}>{t.next}</Button>
      </div>
    </SignupShell>
  );
}
