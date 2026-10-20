import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './PackageStage.module.css';
import { Icon } from '../../shared/ui/Icon';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { player as copy } from '../../shared/strings/ko';
import { clock } from '../../shared/player/time';
import type { PackageSource } from '../../shared/player/packageSource';
import { cx } from '../../shared/utils/format';
import { attachPackageHls, primePackageFrame } from '../../shared/player/packageHls';

export const PACKAGE_LOAD_TIMEOUT_MS = 20_000;

export interface PackageStageProps {
  /** Same-origin packaged content URL (`/contents/.../index.html`); null while unresolved. */
  src: string | null;
  title: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Fired once per (re)load when the iframe finished loading. */
  onLoaded: () => void;
  /** `/contents/<mp4>` → HLS master for this lesson's section videos (API chapter.hlsMap); swapped in on every frame load. */
  hlsMap?: Record<string, string> | null;
  /** How the engine currently derives the position; null before load. */
  source: PackageSource | null;
  /** Elapsed seconds credited in this window (elapsed mode) and the detected playhead (playhead mode). */
  elapsedSec: number;
  playheadSec: number | null;
  /** True while the elapsed counter is paused (tab hidden or 120 s without input). */
  counting: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  /** Rendered above the frame (identity gate, ended, exiting notices). */
  overlay?: ReactNode;
}

/**
 * Packaged-HTML stage: a sandboxed same-origin iframe filling the stage (16:9 desktop, full-width / 60vh mobile)
 * with a loading skeleton, an UNAVAILABLE state after onerror or a 20 s load timeout (retry reloads the frame),
 * a fullscreen button on the wrapper, and a control bar with the source status line and 이전/다음 차시.
 */
export function PackageStage({ src, title, iframeRef, onLoaded, hlsMap, source, elapsedSec, playheadSec, counting, onPrev, onNext, overlay }: PackageStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [fullscreen, setFullscreen] = useState(false);
  const fsSupported = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  // Load timeout: a frame that never fires load/error within 20 s is reported as unavailable.
  useEffect(() => {
    if (!src) return;
    setStatus('loading');
    const id = setTimeout(() => setStatus((s) => (s === 'loading' ? 'error' : s)), PACKAGE_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [src, attempt]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Swap section videos to HLS before the package's own script can start the MP4 (each section page is a new document).
  useEffect(() => primePackageFrame(iframeRef.current, hlsMap), [iframeRef, hlsMap, src, attempt]);

  const handleLoad = useCallback(() => { setStatus('loaded'); attachPackageHls(iframeRef.current, hlsMap); onLoaded(); }, [onLoaded, iframeRef, hlsMap]);
  const handleError = useCallback(() => setStatus('error'), []);
  const retry = useCallback(() => { setStatus('loading'); setAttempt((n) => n + 1); }, []);
  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el || !fsSupported) return;
    if (document.fullscreenElement) void document.exitFullscreen?.(); else void el.requestFullscreen?.();
  }, [fsSupported]);

  const pkg = copy.package;
  const statusLabel = source === 'playhead' ? pkg.statusPlayhead : source === 'elapsed' ? pkg.statusElapsed : pkg.statusWaiting;
  const statusHint = source === 'playhead' ? pkg.statusHintPlayhead : source === 'elapsed' ? pkg.statusHintElapsed : undefined;
  const statusMeta = source === 'playhead' && playheadSec !== null ? pkg.position(clock(playheadSec)) : source === 'elapsed' ? pkg.elapsed(clock(elapsedSec)) : null;

  return (
    <div ref={stageRef} className={cx(styles.stage, fullscreen && styles.fs)} tabIndex={-1} aria-label={copy.controls.group}>
      <div className={styles.frame}>
        {src && status !== 'error' ? (
          <iframe
            key={`${src}#${attempt}`}
            ref={iframeRef}
            className={cx(styles.iframe, status === 'loading' && styles.hidden)}
            title={pkg.frameTitle(title)}
            src={src}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            allow="autoplay; fullscreen"
            allowFullScreen
            onLoad={handleLoad}
            onError={handleError}
          />
        ) : null}
        {status === 'loading' && src ? (
          <div className={styles.skeleton} aria-busy="true" role="status"><Skeleton height={14} /><span>{pkg.loading}</span></div>
        ) : null}
        {status === 'error' || !src ? (
          <div className={styles.errorBox}><StateBlock code="UNAVAILABLE" title={pkg.loadFailed} body={pkg.loadFailedBody} onRetry={retry} hideActions extraActions={<button type="button" className="text-link" onClick={retry}>{pkg.retry}</button>} /></div>
        ) : null}
        {overlay ? <div className={styles.overlay}>{overlay}</div> : null}
      </div>
      <div className={styles.bar} role="group" aria-label={copy.controls.group}>
        <div className={styles.status} role="status" title={statusHint}>
          <span className={cx(styles.dot, source && styles[`dot_${source}`])} aria-hidden="true" />
          <span className={styles.statusLabel}>{statusLabel}</span>
          {statusMeta ? <span className={styles.statusMeta}>{statusMeta}</span> : null}
          {source === 'elapsed' && !counting ? <span className={styles.statusPaused}>{pkg.paused}</span> : null}
        </div>
        <div className={styles.nav}>
          <button type="button" className={styles.btn} onClick={onPrev} disabled={!onPrev} aria-label={pkg.prevChapter}><Icon name="arrow-left" size={16} /><span>{pkg.prevChapter}</span></button>
          <button type="button" className={styles.btn} onClick={onNext} disabled={!onNext} aria-label={pkg.nextChapter}><span>{pkg.nextChapter}</span><Icon name="arrow" size={16} /></button>
        </div>
        <button type="button" className={styles.btn} onClick={toggleFullscreen} aria-label={fullscreen ? pkg.exitFullscreen : pkg.fullscreen} disabled={!fsSupported} title={fsSupported ? undefined : pkg.noFullscreen}><span aria-hidden="true">⛶</span></button>
      </div>
    </div>
  );
}
