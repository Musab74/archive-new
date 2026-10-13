import { api } from '../client';
import { CurrentEnrollmentSchema, EnrollmentSchema, listOf, type CurrentEnrollment, type Enrollment } from '../schemas';

export const enrollmentApi = {
  /** 이용건 목록 (환급/비환급, 기간, 상태). */
  list: (signal?: AbortSignal) => api.get<{ items: Enrollment[] }>('/enrollments/me', { schema: listOf(EnrollmentSchema), signal }),
  /** Current active enrollment + pre-assessment status; studySeq null when none. */
  current: (signal?: AbortSignal) => api.get<CurrentEnrollment>('/enrollments/me/current', { schema: CurrentEnrollmentSchema, signal }),
};
