import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import styles from './Auth.module.css';
import { Stepper } from '../../shared/ui/Stepper';
import { useSession } from '../../shared/auth/useSession';
import { auth as copy } from '../../shared/strings/ko';

/** Signup frame (AR-20 06). A signed-in learner is sent home like include/login_not_check.php on join_info.html / join_ok.php. */
export function SignupShell({ step, children }: { step: number; children: ReactNode }) {
  const { phase, isAuthed } = useSession();
  if (phase === 'authed' && isAuthed && step < 2) return <Navigate to="/home" replace />;
  return (
    <div>
      <div className="page-heading">
        <div className="crumb">{copy.signup.crumb}</div>
        <h1>{copy.signup.title}</h1>
        <p>{copy.signup.lead}</p>
      </div>
      <section className={styles.section}>
        <Stepper steps={copy.signup.steps.map((label) => ({ label }))} current={step} label={copy.signup.crumb} />
        <div className={styles.single}>{children}</div>
      </section>
    </div>
  );
}
