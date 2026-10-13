import type { ReactNode } from 'react';
import styles from './Auth.module.css';
import { Stepper } from '../../shared/ui/Stepper';
import { auth as copy } from '../../shared/strings/ko';

export function SignupShell({ step, children }: { step: number; children: ReactNode }) {
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
