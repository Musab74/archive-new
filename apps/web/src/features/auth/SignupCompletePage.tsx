import styles from './Auth.module.css';
import { SignupShell } from './SignupShell';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { auth as copy } from '../../shared/strings/ko';

export default function SignupCompletePage() {
  const c = copy.signup.complete;
  return (
    <SignupShell step={2}>
      <div className={styles.card}>
        <div className={`${styles.symbol} ${styles.mint}`} aria-hidden="true"><Icon name="check" size={27} /></div>
        <h3>{c.title}</h3>
        <p>{c.body}</p>
        <div className={styles.note}>{c.note}</div>
        <Button square block to="/auth/login">{c.cta}</Button>
      </div>
    </SignupShell>
  );
}
