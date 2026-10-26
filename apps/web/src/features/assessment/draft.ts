import type { AnswerMap } from './validation';

/** 임시저장 (AR-07): unsent answers of the current step, per phase and enrollment. Saved answers live on the server. */
export interface Draft { col1: string; job: number | null; interests: number[]; skills: number[]; answers: AnswerMap; step: string; savedAt: string }
export const emptyDraft = (): Draft => ({ col1: '', job: null, interests: [], skills: [], answers: {}, step: 'step01', savedAt: '' });

export const draftKey = (phase: 'pre' | 'post', studySeq: number) => `assessment.draft.${phase}.${studySeq}`;

/** Browser storage may be blocked (private mode): every access is guarded. */
export function readDraft(phase: 'pre' | 'post', studySeq: number): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(phase, studySeq));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    return {
      ...emptyDraft(), ...d,
      answers: typeof d.answers === 'object' && d.answers ? d.answers : {},
      interests: Array.isArray(d.interests) ? d.interests : [],
      skills: Array.isArray(d.skills) ? d.skills : [],
    };
  } catch { return null; }
}
export function writeDraft(phase: 'pre' | 'post', studySeq: number, draft: Draft): boolean {
  try { localStorage.setItem(draftKey(phase, studySeq), JSON.stringify({ ...draft, savedAt: new Date().toISOString() })); return true; } catch { return false; }
}
export function clearDraft(phase: 'pre' | 'post', studySeq: number): void {
  try { localStorage.removeItem(draftKey(phase, studySeq)); } catch { /* ignore */ }
}
