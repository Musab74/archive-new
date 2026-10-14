import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './VideoStage.module.css';
import { Icon } from '../../shared/ui/Icon';
import { AppSelect } from '../../shared/ui/AppSelect';
import { player as copy } from '../../shared/strings/ko';
import { clock, spoken } from '../../shared/player/time';
import { cx } from '../../shared/utils/format';

const SPEEDS = [1, 1.25, 1.5];

export interface VideoStageProps {
  src: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playing: boolean;
  /** When false the play button and shortcuts do nothing (blocked / loading). */
  canPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onEnded: () => void;
  onError?: () => void;
  /** Rendered above the video (start overlay, blocked notices). */
  overlay?: ReactNode;
}

/**
 * <video> with custom controls: play/pause, −10/+10 s, progress slider (role=slider, Korean aria-valuetext),
 * volume + mute, speed 1/1.25/1.5, fullscreen. Keyboard: Space/K, ←/→, ↑/↓, F, M on the stage.
 * The native controls are hidden; download / PiP are disabled.
 */
export function VideoStage({ src, videoRef, playing, canPlay, onPlay, onPause, onTimeUpdate, onLoadedMetadata, onEnded, onError, overlay }: VideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [seeking, setSeeking] = useState<number | null>(null);

  const video = () => videoRef.current;

  const toggle = useCallback(() => { if (!canPlay && !playing) return; if (playing) onPause(); else onPlay(); }, [canPlay, playing, onPlay, onPause]);
  const seekBy = useCallback((d: number) => { const v = video(); if (!v) return; v.currentTime = Math.min(Math.max(0, v.currentTime + d), Number.isFinite(v.duration) ? v.duration : v.currentTime + d); setCurrent(v.currentTime); }, []);
  const seekTo = useCallback((t: number) => { const v = video(); if (!v) return; v.currentTime = t; setCurrent(t); }, []);
  const setVol = useCallback((n: number) => { const v = video(); const vol = Math.min(1, Math.max(0, n)); setVolume(vol); if (v) { v.volume = vol; v.muted = vol === 0; } setMuted(vol === 0); }, []);
  const toggleMute = useCallback(() => { const v = video(); const m = !muted; setMuted(m); if (v) v.muted = m; }, [muted]);
  const changeSpeed = useCallback((s: number) => { setSpeed(s); const v = video(); if (v) v.playbackRate = s; }, []);
  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el || typeof document === 'undefined') return;
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) void document.exitFullscreen?.(); else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') { if (e.key !== ' ' && e.key !== 'k' && e.key !== 'K') return; }
    switch (e.key) {
      case ' ': case 'k': case 'K': e.preventDefault(); toggle(); break;
      case 'ArrowLeft': e.preventDefault(); seekBy(-10); break;
      case 'ArrowRight': e.preventDefault(); seekBy(10); break;
      case 'ArrowUp': e.preventDefault(); setVol(volume + 0.1); break;
      case 'ArrowDown': e.preventDefault(); setVol(volume - 0.1); break;
      case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
      case 'm': case 'M': e.preventDefault(); toggleMute(); break;
      default: break;
    }
  };

  const shown = seeking ?? current;
  const fsSupported = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  return (
    <div ref={stageRef} className={cx(styles.stage, fullscreen && styles.fs)} tabIndex={0} onKeyDown={onKey} aria-label={copy.controls.group} aria-describedby="player-shortcuts">
      <div className={styles.frame}>
        <video
          ref={videoRef}
          className={styles.video}
          src={src ?? undefined}
          playsInline
          preload="metadata"
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          onTimeUpdate={() => { const v = video(); if (v) setCurrent(v.currentTime); onTimeUpdate(); }}
          onLoadedMetadata={() => { const v = video(); if (v) { setDuration(Number.isFinite(v.duration) ? v.duration : 0); v.playbackRate = speed; } onLoadedMetadata(); }}
          onDurationChange={() => { const v = video(); if (v && Number.isFinite(v.duration)) setDuration(v.duration); }}
          onEnded={onEnded}
          onError={onError}
          onPause={() => { /* reducer-driven; native pause (e.g. OS media keys) is mirrored by the page */ }}
        />
        {overlay ? <div className={styles.overlay}>{overlay}</div> : null}
        {!overlay && !playing && canPlay ? (
          <button type="button" className={styles.bigPlay} onClick={onPlay} aria-label={copy.controls.play}><Icon name="play" size={34} /></button>
        ) : null}
      </div>
      <div className={styles.controls} role="group" aria-label={copy.controls.group}>
        <button type="button" className={styles.btn} onClick={toggle} aria-label={playing ? copy.controls.pause : copy.controls.play} disabled={!canPlay && !playing}>
          {playing ? <span className={styles.pauseGlyph} aria-hidden="true"><i /><i /></span> : <Icon name="play" size={20} />}
        </button>
        <button type="button" className={styles.btn} onClick={() => seekBy(-10)} aria-label={copy.controls.back10}><span className={styles.skip}>−10</span></button>
        <button type="button" className={styles.btn} onClick={() => seekBy(10)} aria-label={copy.controls.fwd10}><span className={styles.skip}>+10</span></button>
        <span className={styles.time} aria-hidden="true">{copy.controls.seekText(clock(shown), clock(duration))}</span>
        <input
          type="range" className={styles.seek} min={0} max={Math.max(1, Math.floor(duration))} step={1} value={Math.floor(shown)}
          role="slider" aria-label={copy.controls.seek} aria-valuemin={0} aria-valuemax={Math.floor(duration)} aria-valuenow={Math.floor(shown)} aria-valuetext={`${spoken(shown)} / ${spoken(duration)}`}
          onChange={(e) => setSeeking(Number(e.target.value))}
          onPointerUp={(e) => { seekTo(Number((e.target as HTMLInputElement).value)); setSeeking(null); }}
          onKeyUp={(e) => { seekTo(Number((e.target as HTMLInputElement).value)); setSeeking(null); }}
          onBlur={() => { if (seeking !== null) { seekTo(seeking); setSeeking(null); } }}
        />
        <button type="button" className={styles.btn} onClick={toggleMute} aria-label={muted ? copy.controls.unmute : copy.controls.mute} aria-pressed={muted}><span className={styles.skip}>{muted ? '🔇' : '🔊'}</span></button>
        <input type="range" className={styles.volume} min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label={copy.controls.volume} onChange={(e) => setVol(Number(e.target.value))} />
        {/* in-place panel (portal={false}): a <body> portal would be invisible while the stage is fullscreen */}
        <AppSelect className={styles.speed} tone="dark" size="sm" portal={false} align="end" aria-label={copy.controls.speed} value={String(speed)} onValueChange={(v) => changeSpeed(Number(v))} options={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))} />
        <button type="button" className={styles.btn} onClick={toggleFullscreen} aria-label={fullscreen ? copy.controls.exitFullscreen : copy.controls.fullscreen} disabled={!fsSupported} title={fsSupported ? undefined : copy.controls.noFullscreen}><span className={styles.skip}>⛶</span></button>
      </div>
      <p id="player-shortcuts" className="sr-only">{copy.controls.shortcuts}</p>
    </div>
  );
}
