import { useQuery, type QueryClient } from '@tanstack/react-query';
import { assessmentApi, reviewsApi } from '../../shared/api/endpoints/assessment';

export const aqk = {
  all: ['assessment'] as const,
  panels: ['assessment', 'panels'] as const,
  preForm: (seq: number | null, grant: boolean) => ['assessment', 'pre-form', seq ?? 'current', grant] as const,
  postForm: (seq: number | null, grant: boolean) => ['assessment', 'post-form', seq ?? 'current', grant] as const,
  result: (seq: number | null) => ['assessment', 'result', seq ?? 'current'] as const,
  satisfaction: ['assessment', 'satisfaction'] as const,
  myReviews: (page: number) => ['reviews', 'mine', page] as const,
  myReview: (idx: number) => ['reviews', 'mine', 'one', idx] as const,
  board: (page: number, sw: string, lectureCode: string) => ['reviews', 'board', page, sw, lectureCode] as const,
  boardOne: (idx: number) => ['reviews', 'board', 'one', idx] as const,
};

/**
 * After a save: refresh every assessment view except the open 사전/사후 forms. The form of a granted enrollment answers 403 once the last
 * save consumed the grant (assessment_access_grant.php consume → no grant scope any more), so refetching it would replace the done screen
 * with the gate; the open form keeps its own state instead.
 */
export const invalidateAfterSave = (qc: QueryClient) =>
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assessment' && q.queryKey[1] !== 'pre-form' && q.queryKey[1] !== 'post-form' });

const noRetry = (n: number, e: unknown) => n < 1 && !(e && typeof e === 'object' && 'status' in e && Number((e as { status: number }).status) >= 400 && Number((e as { status: number }).status) < 500);

export const usePanels = () => useQuery({ queryKey: aqk.panels, queryFn: ({ signal }) => assessmentApi.panels(signal) });
export const usePreForm = (seq: number | null, grant: boolean) => useQuery({ queryKey: aqk.preForm(seq, grant), queryFn: ({ signal }) => assessmentApi.preForm(seq, grant, signal), retry: noRetry, refetchOnWindowFocus: false });
export const usePostForm = (seq: number | null, grant: boolean) => useQuery({ queryKey: aqk.postForm(seq, grant), queryFn: ({ signal }) => assessmentApi.postForm(seq, grant, signal), retry: noRetry, refetchOnWindowFocus: false });
export const useResult = (seq: number | null) => useQuery({ queryKey: aqk.result(seq), queryFn: ({ signal }) => assessmentApi.result(seq ?? undefined, signal), retry: noRetry });
export const useSatisfactionList = () => useQuery({ queryKey: aqk.satisfaction, queryFn: ({ signal }) => assessmentApi.satisfaction(signal) });
export const useMyReviews = (page: number) => useQuery({ queryKey: aqk.myReviews(page), queryFn: ({ signal }) => reviewsApi.mine(page, signal) });
export const useMyReview = (idx: number) => useQuery({ queryKey: aqk.myReview(idx), queryFn: ({ signal }) => reviewsApi.mineOne(idx, signal), retry: noRetry, enabled: idx > 0 });
export const useReviewBoard = (page: number, sw: string, lectureCode: string) => useQuery({ queryKey: aqk.board(page, sw, lectureCode), queryFn: ({ signal }) => reviewsApi.board({ page, sw, lectureCode }, signal) });
export const useReviewBoardOne = (idx: number) => useQuery({ queryKey: aqk.boardOne(idx), queryFn: ({ signal }) => reviewsApi.boardOne(idx, signal), retry: noRetry, enabled: idx > 0, refetchOnWindowFocus: false, staleTime: Infinity });

/** `?studySeq=…&grant=1` from the hub links (PHP grant_use=1&grant_study_seq / retro_study_seq). */
export function scopeFromSearch(params: URLSearchParams): { studySeq: number | null; grant: boolean } {
  const n = Number(params.get('studySeq'));
  return { studySeq: Number.isInteger(n) && n > 0 ? n : null, grant: params.get('grant') === '1' };
}

export const scopeSearch = (studySeq: number | null | undefined, grant?: boolean) => {
  const q = new URLSearchParams();
  if (studySeq) q.set('studySeq', String(studySeq));
  if (grant) q.set('grant', '1');
  const s = q.toString();
  return s ? `?${s}` : '';
};
