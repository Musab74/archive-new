import styles from './Assessment.module.css';
import type { Question } from '../../shared/api/endpoints/assessment';
import { assessment as copy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';
import type { AnswerMap } from './validation';

export interface QuestionTableProps {
  title: string;
  questions: Question[];
  answers: AnswerMap;
  onAnswer: (idx: number, value: number) => void;
  /** agree = 사전 (그렇지 않다 … 그렇다), improve = 사후 (비향상 ★★★★★ 향상). */
  variant: 'agree' | 'improve';
  /** Number shown before each question (PHP prints aOrder; 사후 리더십 adds 5). */
  numberOf?: (q: Question) => number | string;
  invalidIdx?: number | null;
  showMissing?: boolean;
}

const VALUES = [1, 2, 3, 4, 5];

/** The 5-point question table of prev_test01/02 and the star rows of post_test01/02/03. */
export function QuestionTable({ title, questions, answers, onAnswer, variant, numberOf, invalidIdx, showMissing }: QuestionTableProps) {
  const num = numberOf ?? ((q: Question) => q.order ?? '');
  if (variant === 'improve') {
    return (
      <section className={styles.group} aria-label={title}>
        <h2>{title}</h2>
        <ol className={styles.starList}>
          {questions.map((q) => {
            const missing = invalidIdx === q.idx || (showMissing && answers[q.idx] === undefined);
            return (
              <li key={q.idx} id={`q-${q.idx}`} className={cx(styles.starItem, missing && styles.invalidRow)}>
                <p className={styles.starQuestion}><b>{num(q)}. {q.text}</b>{q.detail ? <small>{q.detail}</small> : null}</p>
                <div className={styles.starRow} role="radiogroup" aria-label={q.text ?? ''}>
                  <span className={styles.starEnd}>{copy.improve.low}</span>
                  <span className={styles.stars}>
                    {VALUES.map((v) => (
                      <label key={v} className={cx(styles.star, (answers[q.idx] ?? 0) >= v && styles.starOn)}>
                        <input type="radio" name={`q-${q.idx}`} value={v} checked={answers[q.idx] === v} onChange={() => onAnswer(q.idx, v)} aria-label={`${q.text ?? ''} · ${copy.improve.star(v)}`} />
                        <span aria-hidden="true">★</span>
                      </label>
                    ))}
                  </span>
                  <span className={styles.starEnd}>{copy.improve.high}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }
  return (
    <section className={styles.group} aria-label={title}>
      <h2>{title}</h2>
      <table className={styles.likert}>
        <thead>
          <tr>
            <th scope="col">{copy.questionCol}</th>
            {copy.likert.map((l, i) => <th key={l} scope="col"><span className={styles.likertNum}>{copy.likertShort[i]}</span><span className={styles.likertLabel}>{l}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => {
            const missing = invalidIdx === q.idx || (showMissing && answers[q.idx] === undefined);
            return (
              <tr key={q.idx} id={`q-${q.idx}`} className={cx(missing && styles.invalidRow)} aria-invalid={missing || undefined}>
                <th scope="row"><b><span className={styles.qNum}>Q{num(q)}.</span>{q.text}</b>{q.detail ? <small>{q.detail}</small> : null}</th>
                {VALUES.map((v) => (
                  <td key={v}>
                    <label className={styles.radio}>
                      <input type="radio" name={`q-${q.idx}`} value={v} checked={answers[q.idx] === v} onChange={() => onAnswer(q.idx, v)} aria-label={`${q.text ?? ''} · ${copy.likert[v - 1]}`} />
                      <span aria-hidden="true">{v}</span>
                    </label>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
