export type AnswerMap = Record<number, number>;
export interface StepValidation { ok: boolean; answered: number; required: number; firstUnansweredIdx: number | null; message: string | null }
type Q = { idx: number; text?: string | null; group?: string | null };

export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;
export const MAX_PICKS = 3; // prev_test03.html: 관심분야 / 필요역량 최대 3개

export function isLikert(v: unknown): v is number { return typeof v === 'number' && Number.isInteger(v) && v >= LIKERT_MIN && v <= LIKERT_MAX; }

/** prev_test01.html: the 직급 (Q0) must be chosen before the step can be sent. */
export function validateProfile(col1: string, message: string): StepValidation {
  const ok = col1.trim().length > 0;
  return { ok, answered: ok ? 1 : 0, required: 1, firstUnansweredIdx: null, message: ok ? null : message };
}

/** Every listed question needs a 1–5 answer; reports the first unanswered idx for focus/scroll. */
export function validateAnswers(questions: Q[], answers: AnswerMap, message: string): StepValidation {
  let answered = 0;
  let first: number | null = null;
  for (const q of questions) {
    if (isLikert(answers[q.idx])) answered += 1;
    else if (first === null) first = q.idx;
  }
  const ok = questions.length > 0 && answered === questions.length;
  return { ok, answered, required: questions.length, firstUnansweredIdx: first, message: ok ? null : message };
}

/** Body for the answers endpoints limited to the questions on screen. */
export function answersFor(questions: Q[], answers: AnswerMap): { questionIdx: number; value: number }[] {
  return questions.filter((q) => isLikert(answers[q.idx])).map((q) => ({ questionIdx: q.idx, value: answers[q.idx] }));
}

/** Groups questions by their group code preserving first-seen order (C → L in the seed). */
export function groupQuestions<T extends Q>(questions: T[]): { group: string; items: T[] }[] {
  const out: { group: string; items: T[] }[] = [];
  for (const q of questions) {
    const key = q.group ?? '';
    let g = out.find((o) => o.group === key);
    if (!g) { g = { group: key, items: [] }; out.push(g); }
    g.items.push(q);
  }
  return out;
}

/** prev_test03.html interestBtns/skillBtns: toggle a choice, refusing a 4th one ("최대 3개까지 선택 가능합니다."). */
export function togglePick(list: number[], idx: number, max = MAX_PICKS): { next: number[]; overflow: boolean } {
  if (list.includes(idx)) return { next: list.filter((v) => v !== idx), overflow: false };
  if (list.length >= max) return { next: list, overflow: true };
  return { next: [...list, idx], overflow: false };
}

/** prev_test03.html getPrevTest03MissingItem order: 직무 → 관심분야 → 필요역량. */
export function profileMissing(job: number | null, interests: number[], skills: number[]): ('job' | 'interests' | 'skills')[] {
  const out: ('job' | 'interests' | 'skills')[] = [];
  if (!job) out.push('job');
  if (!interests.length) out.push('interests');
  if (!skills.length) out.push('skills');
  return out;
}

/** Server answers win; a local draft only fills questions the server has not stored yet. */
export function mergeAnswers(server: Record<string, number>, draft: AnswerMap | null | undefined): AnswerMap {
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(draft ?? {})) if (isLikert(v)) out[Number(k)] = v;
  for (const [k, v] of Object.entries(server)) if (isLikert(v)) out[Number(k)] = v;
  return out;
}
