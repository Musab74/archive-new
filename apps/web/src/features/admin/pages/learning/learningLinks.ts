/**
 * Deep links into the 수강 관리 pages, in the URL shapes the PHP callers used, plus the 이상데이터 상세 "관련 화면" links of
 * hrd_manager/abnormal_data_view.php (lines 120-150) that point at these pages:
 *   - category 'ip' or issue AUTH_IP_BURST / AUTH_IP_MISMATCH → "IP 모니터링에서 검색" (study_ip.php?ID=<id>&ip_addr=<ip>)
 *   - category 'auth' → "본인인증 목록에서 검색" (certification_list.php?col=a.ID&sw=<id>)
 * The IP comes from the metric JSON (StudyIP, UserIP, CertIP, ip — first non-empty) or the first IPv4 in the sample text.
 * Pure functions; the 이상데이터 page (features/admin/pages/studies/MonitoringPages.tsx) renders them.
 */

/** IdentityChecksPage accepts the PHP names (col=a.ID&sw=) and searches at once. */
export const identityChecksHref = (id: string) => `/admin/learning/identity-checks?${new URLSearchParams({ col: 'a.ID', sw: id }).toString()}`;
/** IpMonitorPage accepts ?ID= / ?ip_addr= (detail view, 월=전체, auto-search). */
export const studyIpHref = (id: string, ip?: string | null) => `/admin/learning/ip-monitor?${new URLSearchParams({ ID: id, ...(ip ? { ip_addr: ip } : {}) }).toString()}`;

export interface AbnormalLinkRow { category?: string | null; issueCode?: string | null; id?: string | null; metric?: unknown; sample?: string | null }
export interface LearningRelatedLink { label: string; to: string }

function metricObject(metric: unknown): Record<string, unknown> {
  if (metric && typeof metric === 'object' && !Array.isArray(metric)) return metric as Record<string, unknown>;
  if (typeof metric === 'string' && metric.trim().startsWith('{')) { try { const o = JSON.parse(metric); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
  return {};
}

/** abnormal_data_view.php $ipVal. */
export function abnormalIp(row: AbnormalLinkRow): string {
  const m = metricObject(row.metric);
  for (const k of ['StudyIP', 'UserIP', 'CertIP', 'ip']) { const v = m[k]; if (v !== undefined && v !== null && String(v) !== '') return String(v); }
  return /\b(\d{1,3}(?:\.\d{1,3}){3})\b/.exec(String(row.sample ?? ''))?.[1] ?? '';
}

/** The 수강 관리 entries of abnormal_data_view.php $relatedLinks for one 이상데이터 row (empty when the row has no member ID). */
export function abnormalLearningLinks(row: AbnormalLinkRow): LearningRelatedLink[] {
  const id = String(row.id ?? '').trim(); if (!id) return [];
  const cat = String(row.category ?? ''); const code = String(row.issueCode ?? '');
  const out: LearningRelatedLink[] = [];
  if (cat === 'ip' || code === 'AUTH_IP_BURST' || code === 'AUTH_IP_MISMATCH') out.push({ label: 'IP 모니터링에서 검색', to: studyIpHref(id, abnormalIp(row)) });
  if (cat === 'auth') out.push({ label: '본인인증 목록에서 검색', to: identityChecksHref(id) });
  return out;
}
