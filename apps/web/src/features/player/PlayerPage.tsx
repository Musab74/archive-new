import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import styles from './PlayerPage.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { playerApi } from '../../shared/api/endpoints/player';
import { catalogApi } from '../../shared/api/endpoints/catalog';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Modal } from '../../shared/ui/Modal';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';
import { MetricCard } from '../../shared/ui/MetricCard';
import { Checkbox, Textarea } from '../../shared/ui/Form';
import { TypeLabel } from '../../shared/ui/Pill';
import { player as copy, common, content as contentCopy } from '../../shared/strings/ko';
import { canPlay as canPlayPhase, exitRatingDue, type BlockReason } from '../../shared/player/playerReducer';
import { clock, hm } from '../../shared/player/time';
import { cx } from '../../shared/utils/format';
import { VideoStage } from './VideoStage';
import { PackageStage } from './PackageStage';
import { usePlayerEngine, type EngineTarget } from './usePlayerEngine';
import { IDENTITY_POPUP_FEATURES, identityPopupUrl, isMobileViewport, resolveMediaUrl, resolvePackageUrl } from './media';
import { PackageBridgeDialogs, usePackageBridge } from './PackageBridge';
import { fmtDateTime } from '../my/queries';

const COMPLETION_SEC = 54_000; // 15 h (HRDE_COMPLETION_CRITERIA_SECONDS)

/** Route `/learn/:studySeq/:chapterSeq?lectureCode=`: resolves the chapter → (lectureCode, chapterNumber) then mounts the engine. */
export default function PlayerPage() {
  const { studySeq = '', chapterSeq = '' } = useParams();
  const [sp] = useSearchParams();
  const seq = Number(studySeq);
  const chapter = Number(chapterSeq);
  const lectureParam = sp.get('lectureCode') ?? '';

  const records = useQuery({ queryKey: ['my', 'records', seq, 'chapters'], queryFn: ({ signal }) => myRoomApi.recordChapters(seq, signal), enabled: Number.isFinite(seq) && seq > 0 });
  const fromRecords = useMemo(() => {
    const row = records.data?.chapters.find((c) => c.chapterSeq === chapter);
    return row ? { lectureCode: row.lectureCode, chapterNumber: String(row.order) } : null;
  }, [records.data, chapter]);
  // Fallback when the chapter is not in the enrollment's record list but a lectureCode was given.
  const fallback = useQuery({ queryKey: ['player', 'chapters', seq, lectureParam], queryFn: ({ signal }) => playerApi.chapters(seq, lectureParam, signal), enabled: !!lectureParam && records.isSuccess && !fromRecords });
  const target = useMemo<EngineTarget | null>(() => {
    if (!Number.isFinite(seq) || seq <= 0) return null;
    if (fromRecords) return { studySeq: seq, ...fromRecords };
    const row = fallback.data?.chapters.find((c) => c.chapterSeq === chapter) ?? (lectureParam && chapter > 0 && chapter <= (fallback.data?.chapters.length ?? 0) ? fallback.data?.chapters[chapter - 1] : undefined);
    if (row && lectureParam) return { studySeq: seq, lectureCode: lectureParam, chapterNumber: String(row.order ?? row.number) };
    return null;
  }, [seq, chapter, fromRecords, fallback.data, lectureParam]);

  if (!Number.isFinite(seq) || seq <= 0 || !Number.isFinite(chapter)) return <div className={styles.state}><StateBlock code="NOT_FOUND" /></div>;
  if (records.isPending || (fallback.isPending && fallback.fetchStatus !== 'idle')) return <div className={styles.loading} aria-busy="true"><Skeleton height={420} /><p>{copy.loading}</p></div>;
  if (records.isError && isAppError(records.error) && records.error.isAuth) return <div className={styles.state}><StateBlock code="SESSION_EXPIRED" /></div>;
  if (!target) {
    const code = records.isError && isAppError(records.error) && records.error.status === 404 ? 'NO_ACCESS' : records.isError ? 'ACCESS_ERROR' : 'UNAVAILABLE';
    return <div className={styles.state}><StateBlock code={code} onRetry={() => void records.refetch()} /></div>;
  }
  return <PlayerWindow key={`${seq}-${chapter}`} target={target} chapterSeq={chapter} />;
}

const blockState: Record<BlockReason, { code: 'CONCURRENT' | 'ENDED' | 'SESSION_EXPIRED' | 'IDLE_LOGOUT' | 'NO_ACCESS' | 'UNAVAILABLE' | 'ACCESS_ERROR' | 'AUTH' }> = {
  playlock: { code: 'CONCURRENT' }, dailyCap: { code: 'ACCESS_ERROR' }, idleTimeout: { code: 'IDLE_LOGOUT' }, sessionExpired: { code: 'SESSION_EXPIRED' }, periodExpired: { code: 'ENDED' }, preAssessment: { code: 'AUTH' }, noAccess: { code: 'NO_ACCESS' }, notFound: { code: 'UNAVAILABLE' }, unknown: { code: 'ACCESS_ERROR' },
};

function PlayerWindow({ target, chapterSeq }: { target: EngineTarget; chapterSeq: number }) {
  const navigate = useNavigate();
  const engine = usePlayerEngine(target);
  const { state } = engine;
  const d = state.descriptor;
  const [exitOpen, setExitOpen] = useState(false);
  const [identityNote, setIdentityNote] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [star, setStar] = useState(0);
  const [comment, setComment] = useState('');
  const [rateMsg, setRateMsg] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const course = useQuery({ queryKey: ['catalog', 'course', target.lectureCode, true], queryFn: ({ signal }) => catalogApi.course(target.lectureCode, signal), staleTime: 5 * 60_000 });
  // canRate (= a Progress row exists for the content) is read when the window opens; the first acknowledged save creates that row, so a
  // learner who opened the content for the first time is asked for the exit rating like in player2.php:5208-5228 (no own review, ≥ 50 %).
  const savedOnce = state.saveStatus === 'SAVED';
  const canRateRechecked = useRef(false);
  const refetchCourse = course.refetch;
  const canRateFalse = course.data?.canRate === false;
  useEffect(() => {
    if (!savedOnce || !canRateFalse || canRateRechecked.current) return;
    canRateRechecked.current = true;
    void refetchCourse();
  }, [savedOnce, canRateFalse, refetchCourse]);
  // Empty text stores the PHP defaults (player2.php:5637-5638); the star is never pre-filled (AR-06 평점 미선택을 자동 5점으로 채우지 않음).
  const rate = useMutation({ mutationFn: () => catalogApi.review(target.lectureCode, { starPoint: star, title: copy.exitDialog.rateOnlyTitle, contents: comment.trim() || copy.exitDialog.rateOnlyContents }), onSuccess: () => { setRateMsg(copy.exitDialog.rateDone); void course.refetch(); }, onError: () => setRateMsg(copy.exitDialog.rateFail) });

  const detailPath = `/courses/${encodeURIComponent(target.lectureCode)}`;
  const phase = state.phase;
  const playing = phase.kind === 'playing';
  const isPackage = engine.isPackage;
  // Packaged (type A) chapters: mobileUrl on narrow viewports, with the legacy ?resume= hint; real media resolves url/mobileUrl as before.
  // Encoded lessons play their HLS master (HLS_PLAYBACK on the API); if it fails the MP4 takes over when the API still sent one.
  const [hlsFailed, setHlsFailed] = useState<number | null>(null);
  const mp4Src = useMemo(() => (d && isPackage ? resolvePackageUrl(d.chapter, d.resume.positionSec, isMobileViewport()) : resolveMediaUrl(d?.chapter.url ?? d?.chapter.mobileUrl ?? null)), [d, isPackage]);
  const hlsSrc = d && !isPackage && d.chapter.hlsUrl && hlsFailed !== d.chapter.chapterSeq ? resolveMediaUrl(d.chapter.hlsUrl) : null;
  const src = hlsSrc ?? mp4Src;
  const onMediaError = useCallback(() => { if (hlsSrc && mp4Src && d) setHlsFailed(d.chapter.chapterSeq); else setMediaError(true); }, [hlsSrc, mp4Src, d]);
  const refund = d?.study.mode !== 'NON_REFUND';

  useEffect(() => { document.title = d ? `${d.chapter.title} · ${copy.title}` : copy.title; return () => { document.title = 'AINEX Archive'; }; }, [d]);

  // The legacy mOTP page needs its query (player2.php:917) and a window.opener (motp.php:283 skips the cert insert without one).
  const identityEnroll = d?.identity?.evalCd === '00';
  const openIdentityPopup = useCallback(() => {
    if (identityEnroll && !agreed) { setIdentityNote(copy.identity.agreeRequired); return; }
    const w = window.open(identityPopupUrl(d?.identity?.popupQuery), 'popupMotp', IDENTITY_POPUP_FEATURES);
    if (!w) { setIdentityNote(copy.identity.popupBlocked); return; }
    popupRef.current = w;
    setIdentityNote(null);
  }, [d, identityEnroll, agreed]);

  const recheckedRef = useRef(false);
  const recheckIdentity = useCallback(() => { setIdentityNote(null); recheckedRef.current = true; engine.open(); }, [engine]);
  // After a re-check the gate is still 'required' → tell the learner the server has not seen the verification yet.
  useEffect(() => {
    if (!state.descriptor) return;
    if (recheckedRef.current) { recheckedRef.current = false; if (phase.kind === 'identityCheck') setIdentityNote(copy.identity.stillRequired); }
  }, [state.descriptor, phase.kind]);

  const goChapter = useCallback(async (seq: number) => {
    await engine.endForSwitch();
    navigate(`/learn/${target.studySeq}/${seq}?lectureCode=${encodeURIComponent(target.lectureCode)}`);
  }, [engine, navigate, target]);

  const confirmExit = useCallback(async () => {
    await engine.exit();
    navigate(detailPath);
  }, [engine, navigate, detailPath]);

  const requestExit = useCallback(() => setExitOpen(true), []);
  const bridge = usePackageBridge(d ? { lectureCode: target.lectureCode, contentsIdx: d.chapter.contentsIdx } : null, requestExit);

  // ---- blocked (full screen)
  if (phase.kind === 'blocked') {
    const b = copy.blocked[phase.reason];
    const code = blockState[phase.reason].code;
    const lastHb = phase.reason === 'playlock' && phase.details && typeof phase.details === 'object' && 'lastHeartbeat' in phase.details ? String((phase.details as { lastHeartbeat?: string }).lastHeartbeat ?? '') : '';
    return (
      <div className={styles.state}>
        <StateBlock code={code} kicker={b.kicker} title={b.title} body={<>{phase.message ? phase.message.split(/\r?\n/).map((line, i) => <span key={i}>{i > 0 ? <br /> : null}{line}</span>) : b.body}{lastHb ? <><br /><small>{copy.blocked.playlock.lastHeartbeat(fmtDateTime(lastHb) || lastHb)}</small></> : null}{phase.reason === 'playlock' ? <><br /><small>{copy.blocked.playlock.takeoverNote}</small></> : null}</>}
          actions={<>
            <Button variant="secondary" square size="sm" to={detailPath}>{copy.backToDetail}</Button>
            {phase.reason === 'preAssessment' ? <Button square size="sm" to="/assessment/pre">{copy.blocked.preAssessment.cta}</Button> : null}
            {phase.reason === 'sessionExpired' || phase.reason === 'idleTimeout' ? <Button square size="sm" to={`/auth/login?next=${encodeURIComponent(`/learn/${target.studySeq}/${chapterSeq}?lectureCode=${target.lectureCode}`)}`}>{common.goLogin}</Button> : null}
            {phase.reason === 'playlock' ? <Button variant="secondary" square size="sm" onClick={() => engine.open()}>{copy.recheck}</Button> : null}
            {phase.reason === 'playlock' ? <Button square size="sm" onClick={() => engine.open({ takeover: true })}>{copy.blocked.playlock.takeover}</Button> : null}
            {phase.reason === 'unknown' || phase.reason === 'dailyCap' ? <Button square size="sm" onClick={() => engine.open()}>{copy.recheck}</Button> : null}
          </>} />
      </div>
    );
  }

  if (phase.kind === 'idle' || phase.kind === 'loading' || !d) {
    return <div className={styles.loading} aria-busy="true"><Skeleton height={420} /><p>{copy.loading}</p><small>{copy.gatesChecking}</small></div>;
  }

  const saveLabel = copy.save[state.saveStatus];
  const chapterProgress = state.ack.chapterProgress ?? d.chapter.progress;
  const prevChapterSeq = d.chapter.number > 1 ? d.chapters[d.chapter.number - 2]?.chapterSeq ?? null : null;
  const nextChapterSeq = d.chapter.number < d.chapter.total ? d.chapters[d.chapter.number]?.chapterSeq ?? null : null;
  // Enrollment total = the open-time Σ Progress.StudyTime plus what this chapter gained since (server acks only).
  const recognizedNow = d.totals.recognizedSec + Math.max(0, (state.ack.studyTime ?? d.chapter.studyTime) - d.chapter.studyTime);
  const alreadyRated = d.review.mine > 0 || !!course.data?.myRating;
  const watchedForRating = Math.max(state.ack.studyTime ?? 0, d.chapter.studyTime);
  const showRating = exitRatingDue(alreadyRated ? 1 : 0, rateMsg === copy.exitDialog.rateDone, watchedForRating, d.chapter.completeTimeSec) && course.data?.canRate !== false;

  const overlay = (() => {
    if (phase.kind === 'identityCheck') return <div className={styles.overlayBox}><Icon name="lock" size={26} /><b>{copy.identity.title}</b><p>{copy.identity.body}</p></div>;
    if (phase.kind === 'ready' && isPackage) return (
      <div className={styles.overlayBox}>
        {d.gates.alreadyDone ? <p className={styles.replay}>{copy.replayNote}</p> : null}
        <p>{copy.package.startOverlay}</p>
      </div>
    );
    if (phase.kind === 'ready') return (
      <div className={styles.overlayBox}>
        {d.gates.alreadyDone ? <p className={styles.replay}>{copy.replayNote}</p> : null}
        {d.resume.positionSec > 0 ? <p>{copy.resumeOverlay(clock(d.resume.positionSec))}</p> : null}
        <Button size="lg" square onClick={engine.play} icon={<Icon name="play" size={18} />} disabled={!src || mediaError}>{copy.startOverlay}</Button>
        {mediaError ? <p role="alert">{copy.controls.mediaError}</p> : null}
      </div>
    );
    if (phase.kind === 'paused' && (phase.reason === 'overlap' || phase.reason === 'serverError')) return (
      <div className={styles.overlayBox} role="alert"><Icon name="alert" size={26} /><b>{phase.reason === 'overlap' ? copy.notices.overlap : copy.notices.serverPaused}</b>{state.notice ? <p>{state.notice}</p> : null}<Button square size="sm" onClick={engine.play}>{copy.controls.play}</Button></div>
    );
    if (phase.kind === 'ended') return (
      <div className={styles.overlayBox}><b>{copy.notices.endedTitle}</b><p>{copy.notices.endedBody}</p>
        <div className="action-row" style={{ justifyContent: 'center' }}>
          {d.chapter.number < d.chapter.total ? <Button square size="sm" onClick={() => void goChapter(d.chapters[d.chapter.number]?.chapterSeq ?? chapterSeq)}>{copy.notices.nextChapter}</Button> : null}
          <Button variant="white" square size="sm" onClick={engine.play}>{copy.controls.play}</Button>
          <Button variant="secondary" square size="sm" onClick={() => setExitOpen(true)}>{copy.exit}</Button>
        </div>
      </div>
    );
    if (phase.kind === 'exiting') return <div className={styles.overlayBox}><p>{copy.exitDialog.saving}</p></div>;
    return null;
  })();

  return (
    <div className={styles.window}>
      <header className={styles.top}>
        <div className={styles.topTitle}>
          <TypeLabel tone={refund ? 'navy' : 'mint'} small>{refund ? '환급형' : '비환급형'}</TypeLabel>
          <h1>{d.chapter.title}</h1>
          <span className={styles.chapterOf}>{copy.chapterOf(d.chapter.number, d.chapter.total)}</span>
        </div>
        <div className={styles.topRight}>
          <span className={cx(styles.badge, styles[`s_${state.saveStatus}`])} role="status" title={copy.saveHint[state.saveStatus]}>{saveLabel}</span>
          {state.saveStatus === 'SAVE_FAILED' ? <Button variant="white" size="xs" square onClick={engine.retrySave}>{copy.exitDialog.retrySave}</Button> : null}
          <Button variant="white" size="sm" square onClick={() => setExitOpen(true)}>{copy.exit}</Button>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.stageCol}>
          {phase.kind === 'identityCheck' ? (
            <div className={styles.gatedStage}>{overlay}</div>
          ) : isPackage ? (
            <PackageStage src={src} title={d.chapter.title} iframeRef={engine.iframeRef} onLoaded={engine.onPackageLoaded} hlsMap={d.chapter.hlsMap} source={state.packageSource}
              elapsedSec={engine.packageElapsedSec} playheadSec={engine.packagePlayheadSec} counting={engine.packageCounting}
              onPrev={prevChapterSeq !== null ? () => void goChapter(prevChapterSeq) : undefined} onNext={nextChapterSeq !== null ? () => void goChapter(nextChapterSeq) : undefined} overlay={overlay} />
          ) : (
            <VideoStage src={src} videoRef={engine.videoRef} playing={playing} canPlay={canPlayPhase(phase) && !mediaError} onPlay={engine.play} onPause={engine.pause}
              onTimeUpdate={engine.onTimeUpdate} onLoadedMetadata={engine.onLoadedMetadata} onEnded={engine.onMediaEnded} onError={onMediaError} overlay={overlay} />
          )}
          {state.idleWarning ? (
            <div className={styles.idle} role="alert"><Icon name="clock" size={18} /><span>{copy.notices.idleWarn}</span><Button variant="white" size="xs" square onClick={engine.acknowledgeIdle}>{copy.notices.idleContinue}</Button></div>
          ) : null}
          {state.notice && phase.kind !== 'paused' ? <p className={styles.notice} role="status">{state.notice}</p> : null}
        </div>

        <aside className={styles.aside} aria-label={copy.metrics.title}>
          <section className={styles.panel}>
            <h2>{copy.metrics.title}</h2>
            <div className={styles.metrics}>
              <MetricCard compact title={copy.metrics.chapterTime} value={state.ack.studyTime === null ? copy.metrics.pending : hm(state.ack.studyTime)} caption={copy.metrics.chapterProgress + ` ${Math.round(chapterProgress)}%`} progress={chapterProgress} />
              {refund ? (
                <MetricCard compact tone="navy" title={copy.metrics.recognized} value={hm(recognizedNow)} caption={state.ack.totalProgress !== null ? `${copy.metrics.totalProgress} ${state.ack.totalProgress}%` : copy.metrics.serverNote} progress={state.ack.totalProgress} />
              ) : (
                <MetricCard compact tone="mint" title={copy.metrics.today} value={hm(d.totals.todaySec)} caption={copy.metrics.general} />
              )}
            </div>
            <p className={styles.panelNote}>{refund ? copy.metrics.refund : copy.metrics.general}</p>
            {recognizedNow >= COMPLETION_SEC && !d.assessment.postDone ? (
              <div className={styles.postNotice} role="status">
                <b>{copy.notices.postTitle}</b>
                <p>{copy.notices.postBody}</p>
                <Button size="xs" square to="/assessment/post">{copy.notices.postCta}</Button>
              </div>
            ) : null}
          </section>

          <section className={styles.panel} aria-label={copy.toc.title}>
            <h2>{copy.toc.title}</h2>
            <ol className={styles.toc}>
              {d.chapters.map((c, i) => {
                const current = c.chapterSeq === d.chapter.chapterSeq;
                const pct = current ? chapterProgress : c.progress; // the open chapter follows the server acks
                return (
                  <li key={c.chapterSeq} className={cx(styles.tocItem, current && styles.tocCurrent)} aria-current={current ? 'true' : undefined}>
                    <span className={styles.tocNum}>{String(i + 1).padStart(2, '0')}</span>
                    <div className={styles.tocCopy}>
                      <span className={styles.tocTitle}>{c.title}</span>
                      <span className={styles.tocMeta}>{copy.toc.minutes(c.minutes)} · {Math.round(pct)}%{pct >= 100 ? ` · ${copy.toc.done}` : ''}{c.lastStudiedAt ? ` · ${copy.toc.lastStudied(fmtDateTime(c.lastStudiedAt) || c.lastStudiedAt)}` : ''}</span>
                    </div>
                    {current ? <span className={styles.tocState}>{copy.toc.current}</span> : <Button variant="white" size="xs" square onClick={() => void goChapter(c.chapterSeq)}>{c.progress >= 100 ? copy.toc.replay : c.progress > 0 ? copy.toc.continue : copy.toc.go}</Button>}
                  </li>
                );
              })}
            </ol>
          </section>

          {course.data?.objective || course.data?.teacher ? (
            <section className={styles.panel} aria-label={copy.info.title}>
              <h2>{copy.info.title}</h2>
              <dl className={styles.courseInfo}>
                {course.data.objective ? <div><dt>{copy.info.objective}</dt><dd>{course.data.objective}</dd></div> : null}
                {course.data.teacher ? <div><dt>{copy.info.teacher}</dt><dd>{course.data.teacher}</dd></div> : null}
              </dl>
            </section>
          ) : null}

          <section className={cx(styles.panel, styles.help)}>
            <h2>{copy.help.title}</h2>
            <p>{copy.help.body}</p>
            <p>{copy.help.exitNote}</p>
            <Button variant="white" size="xs" square to="/support/faq">{copy.help.support}</Button>
          </section>
        </aside>
      </div>

      <Modal open={phase.kind === 'identityCheck'} onClose={() => undefined} dismissible={false} title={identityEnroll ? copy.identity.enrollTitle : copy.identity.title} symbol="lock"
        actions={<><Button variant="secondary" to={detailPath}>{copy.backToDetail}</Button><Button variant="secondary" onClick={openIdentityPopup} disabled={identityEnroll && !agreed}>{copy.identity.open}</Button><Button onClick={recheckIdentity}>{copy.identity.recheck}</Button></>}>
        {d.identity?.message ? <p><b>{d.identity.message}</b></p> : null}
        <p>{identityEnroll ? copy.identity.enrollBody : copy.identity.body}</p>
        {identityEnroll ? (
          <div className={styles.agree}>
            <Checkbox label={copy.identity.agree} checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setIdentityNote(null); }} />
            {!agreed ? <small>{copy.identity.agreeRequired}</small> : null}
          </div>
        ) : null}
        {identityNote ? <p role="alert" style={{ color: 'var(--c-danger)' }}>{identityNote}</p> : null}
      </Modal>

      <PackageBridgeDialogs layer={bridge.layer} onClose={bridge.close} />

      <Modal open={exitOpen} onClose={() => setExitOpen(false)} title={showRating ? copy.exitDialog.rateTitle : copy.exitDialog.title} symbol={showRating ? 'star' : 'info'} kicker={copy.exit}
        actions={<>
          <Button variant="secondary" onClick={() => setExitOpen(false)}>{copy.exitDialog.stay}</Button>
          {showRating && !rateMsg ? <Button variant="secondary" onClick={() => { if (!star) { setRateMsg(copy.exitDialog.rateSelect); return; } rate.mutate(); }} loading={rate.isPending}>{copy.exitDialog.rateSubmit}</Button> : null}
          <Button onClick={() => void confirmExit()} loading={phase.kind === 'exiting'}>{showRating && !alreadyRated && rateMsg !== copy.exitDialog.rateDone ? copy.exitDialog.rateSkip : copy.exitDialog.confirm}</Button>
        </>}>
        {state.saveStatus === 'SAVE_FAILED' ? <p role="alert" className={styles.dialogWarn}>{copy.exitDialog.failed} <button type="button" className="text-link" onClick={engine.retrySave}>{copy.exitDialog.retrySave}</button></p> : null}
        {showRating ? (
          <div className={styles.rateBox}>
            <p>{copy.exitDialog.rateBody}</p>
            <div className={styles.stars} role="radiogroup" aria-label={contentCopy.rateTitle}>
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={star === n} aria-label={contentCopy.rateStar(n)} className={cx(n <= star && styles.filled)} onClick={() => { setStar(n); setRateMsg(null); }}>★</button>)}
            </div>
            <label><span className="sr-only">{contentCopy.rateComment}</span><Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={contentCopy.rateCommentPlaceholder} maxLength={2000} rows={3} /></label>
            {rateMsg ? <p role="status" className={rateMsg === copy.exitDialog.rateDone ? styles.ok : styles.dialogWarn}>{rateMsg}</p> : null}
          </div>
        ) : <p>{copy.exitDialog.body}</p>}
      </Modal>
    </div>
  );
}
