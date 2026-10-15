import { z } from 'zod';
import { api } from '../client';
import { pageOf } from '../schemas';
import { downloadAdminFile } from './admin';

/**
 * "ruby-ops" section endpoints: Ruby 관리 (/admin/ruby/*, F2), IP 모니터링 (/admin/monitoring/ip/*, B1) and
 * 엑셀 일괄 수강등록 (/admin/enrollments/import, A3). Response schemas live here (parsed in dev to catch contract drift).
 */
type Q = Record<string, string | number | boolean | null | undefined>;
const Int = z.number().int();
const Str = z.string().nullable();

// ---------------------------------------------------------------- Ruby FAQ
export const RubyFaqRowSchema = z.object({ idx: Int, question: z.string(), intent: Str, keywords: Str, status: z.string(), priority: z.number(), version: z.number(), locale: Str, createdAt: Str, updatedAt: Str });
export const RubyFaqDetailSchema = RubyFaqRowSchema.extend({ answer: z.string(), createdBy: Str, updatedBy: Str });
export type RubyFaqRow = z.infer<typeof RubyFaqRowSchema>;
export type RubyFaqDetail = z.infer<typeof RubyFaqDetailSchema>;
const WriteResult = z.object({ ok: z.boolean(), idx: Int.optional(), id: Int.optional(), updated: z.number().optional(), deleted: z.number().optional(), embedding: z.string().optional() });
export type RubyWriteResult = z.infer<typeof WriteResult>;

// ---------------------------------------------------------------- Ruby 지식베이스
export const RubyKbRowSchema = z.object({ id: Int, type: z.string(), title: z.string(), status: z.string(), priority: z.number(), locale: Str, sourceUrl: Str, embeddingModel: Str, embeddingUpdatedAt: Str, createdAt: Str, updatedAt: Str });
export const RubyKbDetailSchema = RubyKbRowSchema.extend({ content: z.string(), createdBy: Str, updatedBy: Str });
export type RubyKbRow = z.infer<typeof RubyKbRowSchema>;
export type RubyKbDetail = z.infer<typeof RubyKbDetailSchema>;

// ---------------------------------------------------------------- Ruby 프롬프트 / 런타임
export const RubyPromptRowSchema = z.object({ id: Int, promptKey: z.string(), title: Str, version: z.number(), isActive: z.boolean(), note: Str, updatedBy: Str, createdAt: Str, updatedAt: Str });
export const RubyPromptDetailSchema = RubyPromptRowSchema.extend({ content: z.string() });
export type RubyPromptRow = z.infer<typeof RubyPromptRowSchema>;
export type RubyPromptDetail = z.infer<typeof RubyPromptDetailSchema>;
export const RubyRuntimeRowSchema = z.object({ id: Int, configKey: z.string(), configValue: z.string(), valueType: z.string(), isActive: z.boolean(), note: Str, updatedBy: Str, updatedAt: Str });
export type RubyRuntimeRow = z.infer<typeof RubyRuntimeRowSchema>;
export const RubyRuntimePutResultSchema = z.object({ ok: z.boolean(), updated: z.number(), missing: z.array(z.string()) });

// ---------------------------------------------------------------- Ruby 지원티켓
export const RubyTicketRowSchema = z.object({ id: Int, sessionId: Str, userId: Str, userName: Str, contactName: z.string(), contactPhone: z.string(), userMessage: z.string(), botContext: z.string().nullable().optional(), similarityScore: z.number().nullable(), modelConfidence: z.number().nullable(), status: z.string(), assignedTo: Str, resolvedNote: Str, createdAt: Str, updatedAt: Str });
export const RubyTicketPageSchema = pageOf(RubyTicketRowSchema).extend({ byStatus: z.array(z.object({ status: z.string(), count: z.number() })).default([]) });
export type RubyTicketRow = z.infer<typeof RubyTicketRowSchema>;
export type RubyTicketPage = z.infer<typeof RubyTicketPageSchema>;

// ---------------------------------------------------------------- Ruby 임베딩
export const RubyEmbeddingStatusSchema = z.object({
  faq: z.object({ byStatus: z.record(z.number()), candidates: z.number(), embeddingColumns: z.boolean(), embedded: z.number().default(0), lastUpdatedAt: Str.default(null), models: z.array(z.object({ model: Str, count: z.number() })).default([]) }),
  kb: z.object({ byStatus: z.record(z.number()), candidates: z.number(), embedded: z.number(), lastUpdatedAt: Str, models: z.array(z.object({ model: Str, count: z.number() })) }),
  vectorTables: z.object({ chunks: z.number(), chunksUpdatedAt: Str, embeddings: z.number(), embeddingsUpdatedAt: Str }),
  recentKb: z.array(z.object({ id: Int, type: z.string(), title: z.string(), status: z.string(), embeddingModel: Str, embeddingUpdatedAt: Str, updatedAt: Str })),
  regenerateAvailable: z.boolean(),
  openAiConfigured: z.boolean().optional(),
});
export type RubyEmbeddingStatus = z.infer<typeof RubyEmbeddingStatusSchema>;
export const RubyRegenerateResultSchema = z.object({ ok: z.boolean(), code: z.string().optional(), target: z.string(), candidates: z.object({ faq: z.number(), kb: z.number() }), updated: z.object({ faq: z.number(), kb: z.number() }).optional(), message: z.string().optional() });
export type RubyRegenerateResult = z.infer<typeof RubyRegenerateResultSchema>;

// ---------------------------------------------------------------- IP 모니터링
export const IpSummarySchema = z.object({
  from: z.string(), to: z.string(), days: z.number(),
  counts: z.object({ CRIT: z.number(), HIGH: z.number(), MED: z.number(), LOW: z.number() }),
  severityLabels: z.record(z.string()),
  companies: z.array(z.object({ code: z.string(), name: z.string(), count: z.number() })),
  issueTypes: z.array(z.object({ code: z.string(), label: z.string(), severity: z.string(), severityLabel: z.string(), explain: z.string() })),
});
export type IpSummary = z.infer<typeof IpSummarySchema>;
export const IpQueueRowSchema = z.object({
  idx: Int, detectDate: z.string(), detectedAt: Str, severity: z.string(), severityLabel: z.string(), issueCode: z.string(), issueLabel: z.string(), ip: z.string(),
  company: z.object({ code: z.string(), name: z.string(), label: z.string() }), id: z.string(), studySeq: z.number(), lectureCode: Str, chapterSeq: z.number().optional(), contentsIdx: z.number().optional(),
  sample: Str, clarificationKey: Str, status: z.string(), statusNote: Str, statusBy: Str, statusAt: Str, source: Str, metric: z.record(z.unknown()).nullable(),
});
export const IpScanResultSchema = z.object({
  ok: z.boolean(), code: z.string().optional(), message: z.string(), detectDate: z.string().optional(), insertedTotal: z.number().optional(), retryAfterSec: z.number().optional(),
  result: z.object({ parts: z.record(z.object({ ok: z.boolean(), inserted: z.number(), skipped: z.string().optional(), error: z.string().optional() })) }).passthrough().optional(),
});
export type IpScanResult = z.infer<typeof IpScanResultSchema>;
export const IpQueueSchema = z.object({ from: z.string(), to: z.string(), days: z.number(), sort: z.string(), limit: z.number(), items: z.array(IpQueueRowSchema) });
export type IpQueueRow = z.infer<typeof IpQueueRowSchema>;
export type IpQueue = z.infer<typeof IpQueueSchema>;

// ---------------------------------------------------------------- 엑셀 일괄 수강등록
export const EnrollImportPlanRowSchema = z.object({
  line: z.number(), action: z.enum(['enroll', 'error', 'skip']), userId: z.string(), name: z.string(), memberAction: z.enum(['create', 'update', 'blocked']).nullable(), generatedId: z.boolean(),
  lectureCode: z.string(), courseName: Str, companyCode: z.string(), companyName: Str, lectureStart: z.string(), lectureEnd: z.string(), serviceType: z.string(), openChapter: z.number(), salesId: z.string(),
  termAction: z.enum(['existing', 'create']).nullable(), termeIdx: z.number().nullable(), errors: z.array(z.string()),
  // lecture_reg_list.php columns / states (added; older API builds omit them)
  status: z.enum(['pending', 'registered', 'error', 'skipped']).optional(), typedUserId: z.string().default(''), idConflict: z.boolean().default(false), rowLabel: z.string().default(''),
  tutor: z.string().default(''), mobile: z.string().default(''), email: z.string().default(''), depart: z.string().default(''), lectureReStudy: z.string().default(''),
  pwdDefault: z.boolean().default(true), nwIno: z.string().default(''), trneeSe: z.string().default(''), irglbrSe: z.string().default(''), eduManager: z.string().default('N'),
  overlapStudy: z.object({ seq: z.number(), lectureStart: z.string(), lectureEnd: z.string(), companyCode: z.string(), companyName: z.string() }).nullable().default(null),
  errorCells: z.array(z.string()).default([]), resultCodes: z.array(z.string()).default([]),
  /** Non-blocking notes the PHP list never raised (end < start, unusual 아이디, StudyKey that registration will refuse with [중복]). */
  warnings: z.array(z.string()).default([]),
});
export const EnrollImportResultSchema = z.object({
  mode: z.enum(['dryRun', 'commit']),
  summary: z.object({ total: z.number(), enroll: z.number(), newMembers: z.number(), updateMembers: z.number(), newTerms: z.number(), error: z.number(), skip: z.number(), errorCount: z.number().optional() }),
  rows: z.array(EnrollImportPlanRowSchema),
  applied: z.object({ enrolled: z.number(), membersCreated: z.number(), membersUpdated: z.number(), termsCreated: z.number(), skipped: z.number(), failed: z.number().default(0), studySeqs: z.array(z.number()) }).nullable(),
});
export const EnrollSheetSchema = z.object({ format: z.enum(['xlsx', 'xls', 'csv']), fileName: z.string(), rows: z.number(), table: z.array(z.array(z.string())) });
export type EnrollSheet = z.infer<typeof EnrollSheetSchema>;
export const EnrollStageResultSchema = z.object({ ok: z.boolean(), staged: z.number(), skipped: z.number(), idxs: z.array(z.number()) });
export const EnrollCourseOptionSchema = z.object({ lectureCode: z.string(), contentsName: z.string(), packageYN: z.string(), serviceType: Str, label: z.string() });
export type EnrollCourseOption = z.infer<typeof EnrollCourseOptionSchema>;
/** A JSON body as the "payload" file part of a multipart request (past the API's 100 kB JSON body limit). */
const payloadForm = (body: unknown) => { const fd = new FormData(); fd.append('payload', new Blob([JSON.stringify(body)], { type: 'application/json' }), 'payload.json'); return fd; };
export type EnrollImportPlanRow = z.infer<typeof EnrollImportPlanRowSchema>;
export type EnrollImportResult = z.infer<typeof EnrollImportResultSchema>;

export const adminRubyOpsApi = {
  // Ruby FAQ (F2)
  faqs: (query: Q, signal?: AbortSignal) => api.get('/admin/ruby/faq', { query, schema: pageOf(RubyFaqRowSchema), signal }),
  faq: (idx: number, signal?: AbortSignal) => api.get('/admin/ruby/faq/' + idx, { schema: RubyFaqDetailSchema, signal }),
  createFaq: (body: Record<string, unknown>) => api.post('/admin/ruby/faq', body, { schema: WriteResult }),
  patchFaq: (idx: number, body: Record<string, unknown>) => api.patch('/admin/ruby/faq/' + idx, body, { schema: WriteResult }),
  deleteFaq: (idx: number) => api.delete('/admin/ruby/faq/' + idx, { schema: WriteResult }),
  // Ruby 지식베이스 (F2)
  kbs: (query: Q, signal?: AbortSignal) => api.get('/admin/ruby/kb', { query, schema: pageOf(RubyKbRowSchema), signal }),
  kb: (id: number, signal?: AbortSignal) => api.get('/admin/ruby/kb/' + id, { schema: RubyKbDetailSchema, signal }),
  createKb: (body: Record<string, unknown>) => api.post('/admin/ruby/kb', body, { schema: WriteResult }),
  patchKb: (id: number, body: Record<string, unknown>) => api.patch('/admin/ruby/kb/' + id, body, { schema: WriteResult }),
  deleteKb: (id: number) => api.delete('/admin/ruby/kb/' + id, { schema: WriteResult }),
  // Ruby 프롬프트 (F2)
  prompts: (signal?: AbortSignal) => api.get('/admin/ruby/prompts', { schema: z.object({ items: z.array(RubyPromptRowSchema) }), signal }),
  prompt: (id: number, signal?: AbortSignal) => api.get('/admin/ruby/prompts/' + id, { schema: RubyPromptDetailSchema, signal }),
  createPrompt: (body: Record<string, unknown>) => api.post('/admin/ruby/prompts', body, { schema: WriteResult }),
  patchPrompt: (id: number, body: Record<string, unknown>) => api.patch('/admin/ruby/prompts/' + id, body, { schema: WriteResult }),
  // Ruby 런타임 (F2)
  runtime: (signal?: AbortSignal) => api.get('/admin/ruby/runtime', { schema: z.object({ items: z.array(RubyRuntimeRowSchema) }), signal }),
  putRuntime: (items: { config_key: string; config_value: string; value_type: string; is_active: boolean; note: string | null }[]) => api.put('/admin/ruby/runtime', { items }, { schema: RubyRuntimePutResultSchema }),
  // Ruby 지원티켓 (F2)
  tickets: (query: Q, signal?: AbortSignal) => api.get<RubyTicketPage>('/admin/ruby/tickets', { query, schema: RubyTicketPageSchema, signal }),
  ticket: (id: number, signal?: AbortSignal) => api.get('/admin/ruby/tickets/' + id, { schema: RubyTicketRowSchema, signal }),
  patchTicket: (id: number, body: { status: string; resolved_note?: string | null; assigned_to?: string | null }) => api.patch('/admin/ruby/tickets/' + id, body, { schema: z.object({ ok: z.boolean(), updated: z.number(), status: z.string() }) }),
  // Ruby 임베딩 (F2)
  embeddingStatus: (signal?: AbortSignal) => api.get('/admin/ruby/embeddings', { schema: RubyEmbeddingStatusSchema, signal }),
  regenerateEmbeddings: (target: 'all' | 'faq' | 'kb') => api.post('/admin/ruby/embeddings/regenerate', { target }, { schema: RubyRegenerateResultSchema }),
  // IP 모니터링 (B1)
  ipSummary: (query: Q, signal?: AbortSignal) => api.get('/admin/monitoring/ip/summary', { query, schema: IpSummarySchema, signal }),
  ipQueue: (query: Q, signal?: AbortSignal) => api.get('/admin/monitoring/ip/queue', { query, schema: IpQueueSchema, signal }),
  downloadIpCsv: (query: Q) => downloadAdminFile('/admin/monitoring/ip/export', query, 'ip_monitoring.csv'),
  /** 보고서 받기 — ip_monitoring_report_FROM_TO.html (abnormal_data_dashboard.php?export=report). */
  downloadIpReport: (query: Q) => downloadAdminFile('/admin/monitoring/ip/report', query, 'ip_monitoring_report.html'),
  /** 다시 집계 (scan=1) */
  ipScan: (body: { date?: string }) => api.post('/admin/monitoring/ip/scan', body, { schema: IpScanResultSchema }),
  // 엑셀 일괄 수강등록 (A3)
  /** JSON (≤ 500 rows). `firstLine` = sheet row number of rows[0] — used for the row-by-row registration (lecture_reg_complete.php per row). */
  importEnrollments: (body: { rows: Record<string, string | null>[]; mode: 'dryRun' | 'commit'; skipInvalid: boolean; firstLine?: number }) => api.post('/admin/enrollments/import', body, { schema: EnrollImportResultSchema }),
  /** Same as importEnrollments for any batch size (≤ 3,000 rows) — multipart, so the 100 kB JSON limit does not apply. */
  importEnrollmentsBatch: (body: { rows: Record<string, string | null>[]; mode: 'dryRun' | 'commit'; skipInvalid: boolean }) => api.post('/admin/enrollments/import/batch', payloadForm(body), { schema: EnrollImportResultSchema }),
  /** 파일 등록 › 업로드 하기: .xlsx / .xls (first sheet) / .csv (UTF-8 or CP949) → table. */
  parseEnrollmentSheet: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/admin/enrollments/import/parse', fd, { schema: EnrollSheetSchema }); },
  /** 임시 저장 → StudyExcelTemp (lecture_reg_excel_upload.php), continued in 수강 등록 › 업로드한 엑셀 목록. */
  stageEnrollments: (rows: Record<string, string | null>[]) => api.post('/admin/enrollments/import/stage', payloadForm({ rows }), { schema: EnrollStageResultSchema }),
  importCourses: (signal?: AbortSignal) => api.get('/admin/enrollments/import/courses', { schema: z.object({ items: z.array(EnrollCourseOptionSchema) }), signal }),
};
