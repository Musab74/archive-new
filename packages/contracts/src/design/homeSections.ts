import { HOME_SECTION_KEYS, type HomeSectionKey } from './schema';

export type HomeSection = { key: HomeSectionKey; visible: boolean };

/** Admin-facing labels for the home sections (Design Studio → 레이아웃). */
export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: '메인 상단(히어로)',
  intro: '소개 띠(네이비)',
  contentTabs: '콘텐츠 탭',
  ctaBand: '수강신청 CTA',
  aiZone: 'AI ZONE 띠',
  operatingTypes: '운영 유형',
  featured: '추천 콘텐츠',
  competencyBrowse: '역량별 탐색',
  journey: '학습 여정',
  axis: 'AXIS 배너',
  consulting: '기업교육 상담',
  faq: '자주 묻는 질문',
};

/**
 * Restricts a stored list to HOME_SECTION_KEYS: drops unknown keys, de-duplicates, and appends keys the stored
 * config does not know yet. `missingVisible` (default true) sets the visibility of those appended keys; the public
 * site and the Design Studio pass `false` so a design published before a section existed never gains it silently —
 * the admin toggles it on. A fresh DEFAULT_DESIGN always lists every key, so this only affects older published files.
 */
export function normalizeHomeSections(sections: readonly { key: string; visible: boolean }[], opts: { missingVisible?: boolean } = {}): HomeSection[] {
  const missingVisible = opts.missingVisible ?? true;
  const seen = new Set<string>();
  const out: HomeSection[] = [];
  for (const s of sections) {
    if (!(HOME_SECTION_KEYS as readonly string[]).includes(s.key) || seen.has(s.key)) continue;
    seen.add(s.key);
    out.push({ key: s.key as HomeSectionKey, visible: !!s.visible });
  }
  for (const k of HOME_SECTION_KEYS) {
    if (seen.has(k)) continue;
    out.push({ key: k, visible: missingVisible });
  }
  return out;
}
