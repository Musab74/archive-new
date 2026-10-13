import { sanitizeLegacyHtml, looksLikeHtml } from '../utils/legacyHtml';
import styles from './LegacyHtml.module.css';

/** Renders editor HTML from the legacy CMS (notices, FAQ answers, course intros) safely and in the light theme. */
export function LegacyHtml({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html) return null;
  if (!looksLikeHtml(html)) return <p className={`${styles.body} ${className ?? ''}`} style={{ whiteSpace: 'pre-line' }}>{html}</p>;
  return <div className={`${styles.body} ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: sanitizeLegacyHtml(html) }} />;
}
