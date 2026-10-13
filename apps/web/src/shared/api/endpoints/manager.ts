import { z } from 'zod';
import { api, request } from '../client';
import {
  CompletionRowSchema, ManagerCompanySchema, ManagerOverviewSchema, PaymentRowSchema, TraineePageSchema, TraineeProgressSchema,
  type CompletionRow, type ManagerCompany, type ManagerOverview, type PaymentRow, type TraineeProgress, type TraineeRow,
} from '../schemas';

export type TraineeStatus = 'all' | 'active' | 'ended' | 'passed' | 'failed' | 'over15h';
export interface TraineeQuery { companyCode?: string; q?: string; status?: TraineeStatus; page?: number; size?: number }
export interface TraineePage { items: TraineeRow[]; page: number; size: number; total: number }

/** 교육담당자 (Member.EduManager='Y') read models — learner Bearer token, scoped to the manager's companies. */
export const managerApi = {
  companies: (signal?: AbortSignal) => api.get<ManagerCompany[]>('/manager/companies', { schema: z.array(ManagerCompanySchema), signal }),
  overview: (companyCode?: string, signal?: AbortSignal) => api.get<ManagerOverview>('/manager/overview', { query: { companyCode }, schema: ManagerOverviewSchema, signal }),
  trainees: (query: TraineeQuery, signal?: AbortSignal) => api.get<TraineePage>('/manager/trainees', { query: { ...query }, schema: TraineePageSchema, signal }),
  traineeProgress: (id: string, studySeq?: number, signal?: AbortSignal) => api.get<TraineeProgress>(`/manager/trainees/${encodeURIComponent(id)}/progress`, { query: { studySeq }, schema: TraineeProgressSchema, signal }),
  completion: (companyCode?: string, signal?: AbortSignal) => api.get<CompletionRow[]>('/manager/completion', { query: { companyCode }, schema: z.array(CompletionRowSchema), signal }),
  payments: (companyCode?: string, signal?: AbortSignal) => api.get<PaymentRow[]>('/manager/payments', { query: { companyCode }, schema: z.array(PaymentRowSchema), signal }),
  /** CSV text (UTF-8 BOM) fetched with the Bearer token; the caller turns it into a Blob download. */
  exportTraineesCsv: (query: { companyCode?: string; q?: string }) => request<string>('/manager/export/trainees.csv', { query, headers: { Accept: 'text/csv' } }),
};

/** Triggers a browser download for text content (used for the CSV export). */
export function downloadText(content: string, fileName: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
