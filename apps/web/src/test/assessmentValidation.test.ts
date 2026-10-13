import { describe, expect, it } from 'vitest';
import { answersFor, groupQuestions, validateAnswers, validateProfile } from '../features/assessment/validation';
import { clearDraft, readDraft, writeDraft, emptyDraft } from '../features/assessment/draft';
import type { AssessmentQuestion } from '../shared/api/schemas';

const qs: AssessmentQuestion[] = [
  { idx: 1, group: 'C', order: 1, bind: 'A', text: '의사소통', detail: '나는 고객의 니즈를 파악한다' },
  { idx: 2, group: 'C', order: 2, bind: 'B', text: '자기계발', detail: '나는 학습한다' },
  { idx: 3, group: 'L', order: 1, bind: 'F', text: '리더십1', detail: '나는 팀을 이끈다' },
];
const MSG = '직급을 선택한 뒤 모든 문항에 응답해 주세요.';

describe('assessment validation', () => {
  it('requires the job track for step01', () => {
    expect(validateProfile('', MSG)).toMatchObject({ ok: false, message: MSG });
    expect(validateProfile('W', MSG)).toMatchObject({ ok: true, message: null });
  });

  it('counts answers and points at the first unanswered question', () => {
    const v = validateAnswers(qs, { 1: 4, 3: 2 }, MSG);
    expect(v).toMatchObject({ ok: false, answered: 2, required: 3, firstUnansweredIdx: 2, message: MSG });
    expect(validateAnswers(qs, { 1: 4, 2: 6, 3: 2 }, MSG).firstUnansweredIdx).toBe(2); // 6 is outside the 1–5 scale
    expect(validateAnswers(qs, { 1: 5, 2: 1, 3: 3 }, MSG)).toMatchObject({ ok: true, answered: 3, firstUnansweredIdx: null });
    expect(validateAnswers([], {}, MSG).ok).toBe(false);
  });

  it('builds the answers body only for the questions on screen and groups C/L in order', () => {
    expect(answersFor(qs, { 1: 5, 3: 3, 99: 4 })).toEqual([{ questionIdx: 1, value: 5 }, { questionIdx: 3, value: 3 }]);
    expect(groupQuestions(qs).map((g) => [g.group, g.items.length])).toEqual([['C', 2], ['L', 1]]);
  });

  it('round-trips the localStorage draft per phase/enrollment and tolerates a blocked storage', () => {
    localStorage.clear();
    const d = { ...emptyDraft(), col1: 'W', answers: { 1: 4 }, step: 'step02' };
    expect(writeDraft('pre', 7, d)).toBe(true);
    expect(readDraft('pre', 7)).toMatchObject({ col1: 'W', answers: { 1: 4 }, step: 'step02' });
    expect(readDraft('post', 7)).toBeNull();
    clearDraft('pre', 7);
    expect(readDraft('pre', 7)).toBeNull();
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try { expect(writeDraft('pre', 7, d)).toBe(false); } finally { Storage.prototype.setItem = orig; }
  });
});
