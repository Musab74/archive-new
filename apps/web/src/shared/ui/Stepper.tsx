import styles from './Stepper.module.css';
import { cx } from '../utils/format';

export interface StepperProps { steps: { label: string; desc?: string }[]; current: number; label?: string; vertical?: boolean; className?: string }

/** Progress path (storyboard `.lpath`): dots joined by a line, completed/current states exposed to AT. */
export function Stepper({ steps, current, label = '진행 단계', vertical, className }: StepperProps) {
  return (
    <ol className={cx(styles.lpath, vertical && styles.vertical, className)} aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.label} className={cx(styles.step, i < current && styles.done, i === current && styles.current)} aria-current={i === current ? 'step' : undefined}>
          {s.label}
          {s.desc ? <span className={styles.desc}>{s.desc}</span> : null}
        </li>
      ))}
    </ol>
  );
}
