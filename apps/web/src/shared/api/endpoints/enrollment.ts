import { api } from '../client';
import { CurrentEnrollmentSchema, EnrollmentSchema, listOf, type CurrentEnrollment, type Enrollment } from '../schemas';

/** GET /enrollments/resolve — which Study row a content plays under (include/enrollment_resolver.php); only `ok` may play. */
export interface EnrollmentResolution {
  status: 'ok' | 'blocked' | 'auto_enroll_allowed' | 'not_found';
  studySeq: number | null;
  studyLectureCode: string | null;
  serviceType: string | null;
  lectureStart: string | null;
  lectureEnd: string | null;
  message: string;
  meta?: Record<string, unknown>;
}

export const enrollmentApi = {
  /** 이용건 목록 (환급/비환급, 기간, 상태). */
  list: (signal?: AbortSignal) => api.get<{ items: Enrollment[] }>('/enrollments/me', { schema: listOf(EnrollmentSchema), signal }),
  /** Current active enrollment + pre-assessment status; studySeq null when none. */
  current: (signal?: AbortSignal) => api.get<CurrentEnrollment>('/enrollments/me/current', { schema: CurrentEnrollmentSchema, signal }),
  /** Enrollment that covers a content code (package children resolve through the package Study row). */
  resolve: (lectureCode: string, signal?: AbortSignal) => api.get<EnrollmentResolution>('/enrollments/resolve', { query: { lectureCode }, signal }),
};
