import type { AssessmentQuestion } from '../../shared/api/schemas';

export type AnswerMap = Record<number, number>;
export interface StepValidation { ok: boolean; answered: number; required: number; firstUnansweredIdx: number | null; message: string | null }

export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;

export function isLikert(v: unknown): v is number { return typeof v === 'number' && Number.isInteger(v) && v >= LIKERT_MIN && v <= LIKERT_MAX; }

/** step01: the job track (col1) must be chosen; col2–col4 are optional. */
export function validateProfile(col1: string, message: string): StepValidation {
  const ok = col1.trim().length > 0;
  return { ok, answered: ok ? 1 : 0, required: 1, firstUnansweredIdx: null, message: ok ? null : message };
}

/** step02/step03: every listed question needs a 1–5 answer; reports the first unanswered idx for focus/scroll. */
export function validateAnswers(questions: AssessmentQuestion[], answers: AnswerMap, message: string): StepValidation {
  let answered = 0;
  let first: number | null = null;
  for (const q of questions) {
    if (isLikert(answers[q.idx])) answered += 1;
    else if (first === null) first = q.idx;
  }
  const ok = questions.length > 0 && answered === questions.length;
  return { ok, answered, required: questions.length, firstUnansweredIdx: first, message: ok ? null : message };
}

/** Body for POST /assessment/{pre|post}/answers limited to the questions on screen. */
export function answersFor(questions: AssessmentQuestion[], answers: AnswerMap): { questionIdx: number; value: number }[] {
  return questions.filter((q) => isLikert(answers[q.idx])).map((q) => ({ questionIdx: q.idx, value: answers[q.idx] }));
}

/** Groups questions by their group code preserving first-seen order (C → L in the seed). */
export function groupQuestions(questions: AssessmentQuestion[]): { group: string; items: AssessmentQuestion[] }[] {
  const out: { group: string; items: AssessmentQuestion[] }[] = [];
  for (const q of questions) {
    let g = out.find((o) => o.group === q.group);
    if (!g) { g = { group: q.group, items: [] }; out.push(g); }
    g.items.push(q);
  }
  return out;
}
