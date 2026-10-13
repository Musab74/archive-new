import type { AnswerMap } from './validation';

export interface Draft { col1: string; col2: string; col3: string; col4: string; answers: AnswerMap; step: string; savedAt: string }
export const emptyDraft = (): Draft => ({ col1: '', col2: '', col3: '', col4: '', answers: {}, step: 'step01', savedAt: '' });

export const draftKey = (phase: 'pre' | 'post', studySeq: number) => `assessment.draft.${phase}.${studySeq}`;

/** Autosaved per-step draft in localStorage. Browser storage may be blocked (private mode): every access is guarded. */
export function readDraft(phase: 'pre' | 'post', studySeq: number): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(phase, studySeq));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    return { ...emptyDraft(), ...d, answers: typeof d.answers === 'object' && d.answers ? d.answers : {} };
  } catch { return null; }
}
export function writeDraft(phase: 'pre' | 'post', studySeq: number, draft: Draft): boolean {
  try { localStorage.setItem(draftKey(phase, studySeq), JSON.stringify({ ...draft, savedAt: new Date().toISOString() })); return true; } catch { return false; }
}
export function clearDraft(phase: 'pre' | 'post', studySeq: number): void {
  try { localStorage.removeItem(draftKey(phase, studySeq)); } catch { /* ignore */ }
}
