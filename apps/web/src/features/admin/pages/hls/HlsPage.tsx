import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminHlsApi, type HlsChapter, type HlsJob, type HlsPopularItem, type HlsSource } from '../../../../shared/api/endpoints/admin-hls';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, ACheckbox, AdminPage, AInput, Bar, Callout, Card, DataTable, DetailDrawer, FilterBar, FilterField, Kpi, StatusBadge, type BadgeTone, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useAdminMutation } from '../../useAdminMutation';

const DEFAULTS = { code: '' };
const ACTIVE = new Set(['queued', 'running']);

export function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const STATE_LABEL: Record<string, [string, BadgeTone]> = {
  queued: [tr('대기', 'Queued'), 'info'], running: [tr('변환 중', 'Encoding'), 'warn'], done: [tr('완료', 'Done'), 'ok'],
  failed: [tr('실패', 'Failed'), 'danger'], cancelled: [tr('취소', 'Cancelled'), 'neutral'],
};
const stateBadge = (s: string) => { const [l, t] = STATE_LABEL[s] ?? [s, 'neutral' as BadgeTone]; return <StatusBadge tone={t}>{l}</StatusBadge>; };

/** A chapter can be queued when every MP4 it plays exists and at least one is not converted or queued yet. */
const selectable = (c: HlsChapter) => pickableSources(c.sources);

function SourceState({ s }: { s: HlsSource }) {
  if (!s.exists) return <StatusBadge tone="danger">{s.problem ?? tr('원본 없음', 'Source missing')}</StatusBadge>;
  if (s.ready) {
    const saved = s.job?.result && s.bytes ? Math.round((1 - s.job.result.bytes / s.bytes) * 100) : null;
    return <span>{stateBadge('done')} <span className="muted" style={{ fontSize: 12 }}>{s.job?.result ? fmtBytes(s.job.result.bytes) : ''}{saved !== null ? ` (−${saved}%)` : ''}</span></span>;
  }
  if (!s.job) return <span className="muted">{tr('미변환', 'Not converted')}</span>;
  return (
    <div style={{ minWidth: 140 }}>
      {stateBadge(s.job.state)}
      {s.job.state === 'running' ? <div style={{ marginTop: 4 }}><Bar value={Math.round(s.job.progress * 100)} /><span className="muted" style={{ fontSize: 11 }}>{Math.round(s.job.progress * 100)}%{s.job.speed ? ` · ${s.job.speed}×` : ''}</span></div> : null}
      {s.job.state === 'failed' && s.job.error ? <div className="muted" style={{ fontSize: 11, maxWidth: 260, whiteSpace: 'normal' }}>{s.job.error.slice(0, 160)}</div> : null}
    </div>
  );
}

/** hls.js (lazy chunk) on Chrome/Edge/Firefox, native HLS on Safari/iOS; same buffer limits the learner player will use. */
export function HlsPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [info, setInfo] = useState<string>('');
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    if (v.canPlayType('application/vnd.apple.mpegurl')) { v.src = src; setInfo(tr('브라우저 내장 HLS', 'Native HLS')); return () => { v.removeAttribute('src'); v.load(); }; }
    let destroy: (() => void) | null = null; let gone = false;
    void import('hls.js').then(({ default: Hls }) => {
      if (gone) return;
      if (!Hls.isSupported()) { setInfo(tr('이 브라우저는 HLS를 재생할 수 없습니다.', 'This browser cannot play HLS.')); return; }
      const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, capLevelToPlayerSize: true });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => { const l = hls.levels[d.level]; if (l) setInfo(`hls.js · ${l.height}p · ${Math.round(l.bitrate / 1000)} kbps`); });
      hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setInfo(`${tr('재생 오류', 'Playback error')}: ${d.details}`); });
      hls.loadSource(src); hls.attachMedia(v);
      destroy = () => hls.destroy();
    });
    return () => { gone = true; destroy?.(); };
  }, [src]);
  return (
    <div>
      <video ref={ref} controls playsInline preload="metadata" style={{ width: '100%', background: '#000', borderRadius: 6 }} aria-label={tr('HLS 미리보기', 'HLS preview')} />
      <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>{info} · <span className="mono">{src}</span></p>
    </div>
  );
}

const pickableSources = (sources: HlsSource[]) => sources.length > 0 && sources.every((s) => s.exists) && sources.some((s) => !s.ready && !ACTIVE.has(s.job?.state ?? ''));

/** 인기 차시: most learners in the last 30 days, with a one-click "top 5" selection and conversion. */
function PopularCard({ enabled, onOpenCourse }: { enabled: boolean; onOpenCourse: (code: string) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const q = useQuery({
    queryKey: ['admin', 'hls', 'popular'], queryFn: ({ signal }) => adminHlsApi.popular({ days: 30, limit: 20 }, signal),
    refetchInterval: (qq) => (qq.state.data?.items.some((i) => i.sources.some((s) => ACTIVE.has(s.job?.state ?? ''))) ? 5_000 : false),
  });
  const enqueue = useAdminMutation({
    fn: adminHlsApi.enqueueContents, invalidate: [['admin', 'hls']], onSuccess: () => setPicked([]),
    success: (r) => tr(`${r.queued.length}개 파일을 대기열에 넣었습니다.${r.skipped.length + r.skippedContents.length ? ` (제외 ${r.skipped.length + r.skippedContents.length})` : ''}`, `Queued ${r.queued.length} file(s).`),
  });
  const items = Array.isArray(q.data?.items) ? q.data.items : [];
  const canPick = new Set(items.filter((i) => pickableSources(i.sources)).map((i) => i.contentsIdx));
  const toggle = (idx: number, on: boolean) => setPicked((cur) => (on ? [...new Set([...cur, idx])] : cur.filter((x) => x !== idx)));
  const cols: Column<HlsPopularItem>[] = [
    { key: '_pick', header: '', render: (r) => <input type="checkbox" aria-label={tr(`${r.title} 선택`, `Select ${r.title}`)} checked={picked.includes(r.contentsIdx)} disabled={!canPick.has(r.contentsIdx)} onChange={(e) => toggle(r.contentsIdx, e.target.checked)} /> },
    { key: 'rank', header: tr('순위', 'Rank'), align: 'center', render: (r) => items.indexOf(r) + 1 },
    { key: 'title', header: tr('차시', 'Lesson'), render: (r) => <span><b>{r.title || '—'}</b><br /><span className="muted" style={{ fontSize: 11 }}>{tr('유형', 'Type')} {r.contentsType} · {r.minutes}{tr('분', ' min')} · idx {r.contentsIdx}</span></span> },
    { key: 'learners', header: tr('최근 30일 학습자', 'Learners (30 d)'), align: 'right', render: (r) => <b>{r.learners.toLocaleString('ko-KR')}</b> },
    { key: 'course', header: tr('과정', 'Course'), render: (r) => (r.lectureCode ? <AButton size="sm" variant="link" onClick={() => onOpenCourse(r.lectureCode!)}>{r.lectureCode}{r.courses > 1 ? tr(` 외 ${r.courses - 1}`, ` +${r.courses - 1}`) : ''}</AButton> : '—') },
    { key: 'source', header: tr('원본 MP4', 'Source MP4'), render: (r) => (r.sources.length ? r.sources.map((s) => <div key={s.rel} className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{s.rel} <span className="muted">{fmtBytes(s.bytes)}</span></div>) : <StatusBadge tone="neutral">{r.problem ?? tr('MP4 없음', 'No MP4')}</StatusBadge>) },
    { key: 'hls', header: tr('HLS 상태', 'HLS'), render: (r) => r.sources.map((s) => <div key={s.rel}><SourceState s={s} /></div>) },
  ];
  return (
    <Card title={tr('인기 차시 · 최근 30일 학습자 순', 'Most-watched lessons · last 30 days')} aside={q.data?.cachedAt ? <span className="muted" style={{ fontSize: 12 }}>{tr(`순위 기준 ${q.data.cachedAt.slice(0, 16).replace('T', ' ')}`, `Ranked at ${q.data.cachedAt.slice(0, 16).replace('T', ' ')}`)}</span> : null}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '0 0 10px' }}>
        <AButton size="sm" onClick={() => setPicked(items.filter((i) => canPick.has(i.contentsIdx)).slice(0, 5).map((i) => i.contentsIdx))} disabled={!canPick.size}>{tr('상위 5개 선택', 'Select top 5')}</AButton>
        <AButton size="sm" variant="ghost" onClick={() => setPicked([])} disabled={!picked.length}>{tr('선택 해제', 'Clear')}</AButton>
        <AButton size="sm" variant="ghost" onClick={() => { void adminHlsApi.popular({ days: 30, limit: 20, refresh: 'Y' }).then(() => q.refetch()); }}>{tr('순위 다시 계산', 'Re-rank')}</AButton>
        <span style={{ flex: 1 }} />
        <AButton variant="primary" icon="play" disabled={!picked.length || !enabled} loading={enqueue.isPending} onClick={() => enqueue.mutate({ contentsIdx: picked, include1080: false })}>{tr(`선택 차시 HLS 변환 (${picked.length})`, `Convert selected (${picked.length})`)}</AButton>
      </div>
      <DataTable columns={cols} rows={items} rowKey={(r) => r.contentsIdx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={tr('최근 30일 학습 기록이 없습니다.', 'No study in the last 30 days.')} emptyBody=" " />
    </Card>
  );
}

export function HlsPage() {
  const [p, setP] = useSearchState(DEFAULTS);
  const [draft, setDraft] = useState(p.code);
  const [picked, setPicked] = useState<number[]>([]);
  const [with1080, setWith1080] = useState(false);
  const [preview, setPreview] = useState<{ title: string; src: string; s: HlsSource } | null>(null);
  useEffect(() => { setDraft(p.code); setPicked([]); }, [p.code]);

  const status = useQuery({ queryKey: ['admin', 'hls', 'status'], queryFn: ({ signal }) => adminHlsApi.status(signal), refetchInterval: 15_000 });
  const course = useQuery({
    queryKey: ['admin', 'hls', 'course', p.code], queryFn: ({ signal }) => adminHlsApi.course(p.code, signal), enabled: !!p.code, retry: false,
    refetchInterval: (q) => (q.state.data?.chapters.some((c) => c.sources.some((s) => ACTIVE.has(s.job?.state ?? ''))) ? 5_000 : false),
  });
  const jobs = useQuery({
    queryKey: ['admin', 'hls', 'jobs', p.code], queryFn: ({ signal }) => adminHlsApi.jobs({ lectureCode: p.code || undefined, limit: 50 }, signal),
    refetchInterval: (q) => (q.state.data?.items.some((j) => ACTIVE.has(j.state)) ? 5_000 : 30_000),
  });
  const invalidate = [['admin', 'hls']];
  const enqueue = useAdminMutation({
    fn: adminHlsApi.enqueue, invalidate,
    success: (r) => tr(`${r.queued.length}개 파일을 대기열에 넣었습니다.${r.skipped.length ? ` (제외 ${r.skipped.length})` : ''}`, `Queued ${r.queued.length} file(s).${r.skipped.length ? ` (${r.skipped.length} skipped)` : ''}`),
    onSuccess: () => setPicked([]),
  });
  const cancel = useAdminMutation({ fn: adminHlsApi.cancel, invalidate, success: tr('취소를 요청했습니다.', 'Cancel requested.') });

  const d = course.data;
  const st = status.data;
  const canPick = useMemo(() => new Set((d?.chapters ?? []).filter(selectable).map((c) => c.chapterSeq)), [d]);
  const toggle = (seq: number, on: boolean) => setPicked((cur) => (on ? [...new Set([...cur, seq])] : cur.filter((x) => x !== seq)));
  const pickIdle = () => setPicked((d?.chapters ?? []).filter((c) => c.idle && canPick.has(c.chapterSeq)).map((c) => c.chapterSeq));

  const cols: Column<HlsChapter>[] = [
    { key: '_pick', header: '', render: (c) => <input type="checkbox" aria-label={tr(`${c.number}차시 선택`, `Select lesson ${c.number}`)} checked={picked.includes(c.chapterSeq)} disabled={!canPick.has(c.chapterSeq)} onChange={(e) => toggle(c.chapterSeq, e.target.checked)} /> },
    { key: 'number', header: tr('차시', 'No.'), align: 'center', render: (c) => c.number },
    { key: 'title', header: tr('제목', 'Title'), render: (c) => <span><b>{c.title || '—'}</b><br /><span className="muted" style={{ fontSize: 11 }}>{tr('유형', 'Type')} {c.contentsType} · {c.minutes}{tr('분', ' min')}</span></span> },
    { key: 'learners30', header: tr(`최근 ${d?.activeDays ?? 30}일 학습자`, `Learners (${d?.activeDays ?? 30} d)`), align: 'right', render: (c) => (c.idle ? <StatusBadge tone="ok">{tr('미사용', 'Idle')}</StatusBadge> : <b>{c.learners30.toLocaleString('ko-KR')}</b>) },
    { key: 'lastStudy', header: tr('최근 학습', 'Last study'), nowrap: true, render: (c) => <span className="muted">{c.lastStudy ?? '—'}</span> },
    { key: 'source', header: tr('원본 MP4', 'Source MP4'), render: (c) => (c.sources.length ? c.sources.map((s) => <div key={s.rel} className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{s.rel} <span className="muted">{fmtBytes(s.bytes)}</span></div>) : <StatusBadge tone="neutral">{c.problem ?? tr('MP4 없음', 'No MP4')}</StatusBadge>) },
    { key: 'hls', header: tr('HLS 상태', 'HLS'), render: (c) => c.sources.map((s) => <div key={s.rel}><SourceState s={s} /></div>) },
    { key: '_play', header: '', render: (c) => c.sources.filter((s) => s.ready && s.publicUrl).map((s) => <AButton key={s.rel} size="sm" icon="play" onClick={() => setPreview({ title: `${c.number}${tr('차시', '')} ${c.title}`, src: s.publicUrl!, s })}>{tr('미리보기', 'Preview')}</AButton>) },
  ];

  const jobCols: Column<HlsJob>[] = [
    { key: 'state', header: tr('상태', 'State'), render: (j) => stateBadge(j.state) },
    { key: 'title', header: tr('차시', 'Lesson'), render: (j) => <span>{j.title}<br /><span className="mono muted" style={{ fontSize: 11 }}>{j.lectureCode} · {j.sourceRel}</span></span> },
    { key: 'progress', header: tr('진행', 'Progress'), render: (j) => (j.state === 'running' ? `${Math.round(j.progress * 100)}%${j.speed ? ` · ${j.speed}×` : ''}` : j.state === 'done' && j.result ? tr(`${j.result.encodeSeconds}초 · ${j.speed ?? '—'}×`, `${j.result.encodeSeconds} s · ${j.speed ?? '—'}×`) : '') },
    { key: 'size', header: tr('원본 → HLS', 'Source → HLS'), nowrap: true, render: (j) => `${fmtBytes(j.sourceBytes)}${j.result ? ` → ${fmtBytes(j.result.bytes)}` : ''}` },
    { key: 'createdAt', header: tr('요청', 'Requested'), nowrap: true, render: (j) => <span className="muted">{j.createdAt.slice(0, 16).replace('T', ' ')} · {j.requestedBy}</span> },
    { key: 'error', header: tr('사유', 'Reason'), render: (j) => (j.error ? <span style={{ fontSize: 11, whiteSpace: 'normal' }}>{j.error.slice(0, 200)}</span> : '') },
    { key: '_x', header: '', render: (j) => (ACTIVE.has(j.state) ? <AButton size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === j.id} onClick={() => cancel.mutate(j.id)}>{tr('취소', 'Cancel')}</AButton> : '') },
  ];

  return (
    <AdminPage
      title={tr('HLS 변환 (영상 경량화)', 'HLS conversion')}
      lead={tr('과정코드를 넣으면 차시별 원본 MP4를 찾아 720p(1.6 Mbps)·480p(0.8 Mbps) HLS로 변환합니다. 원본 MP4와 학습시간 계산은 바뀌지 않습니다.', 'Enter a course code to convert each lesson MP4 into a 720p (1.6 Mbps) / 480p (0.8 Mbps) HLS ladder. The source MP4 and study-time rules stay unchanged.')}
      actions={<AButton onClick={() => { void status.refetch(); void course.refetch(); void jobs.refetch(); }}>{tr('새로고침', 'Refresh')}</AButton>}
    >
      {st && !st.featureEnabled ? <Callout tone="warn">{tr('FEATURE_HLS가 꺼져 있어 변환 요청을 받을 수 없습니다. 서버에서 ops/hls/setup-hls.sh를 실행하세요.', 'FEATURE_HLS is off, so conversions cannot be queued. Run ops/hls/setup-hls.sh on the server.')}</Callout> : null}
      {st && st.featureEnabled && !st.worker.alive ? <Callout tone="warn">{tr('변환 작업기(ainex-hls-worker)가 응답하지 않습니다. 요청은 대기열에 쌓이고 작업기가 켜지면 처리됩니다.', 'The encode worker (ainex-hls-worker) is not running. Requests wait in the queue until it starts.')}</Callout> : null}
      {st ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, margin: '12px 0' }}>
          <Kpi label={tr('작업기', 'Worker')} value={st.worker.alive ? tr('실행 중', 'Running') : tr('중지', 'Stopped')} tone={st.worker.alive ? 'ok' : 'warn'} hint={st.worker.hours ? tr(`변환 시간대 ${st.worker.hours}시`, `Window ${st.worker.hours} h`) : st.worker.ffmpeg?.split(' ').slice(0, 3).join(' ') ?? undefined} />
          <Kpi label={tr('대기', 'Queued')} value={st.queue.queued} />
          <Kpi label={tr('변환 중', 'Encoding')} value={st.queue.running} />
          <Kpi label={tr('완료', 'Done')} value={st.queue.done} tone="ok" />
          <Kpi label={tr('실패', 'Failed')} value={st.queue.failed} tone={st.queue.failed ? 'warn' : undefined} />
          {st.delivery ? <Kpi label={tr('송출 경로', 'Delivery')} value={st.delivery.mode === 'off' ? tr('VOD만', 'VOD only') : st.delivery.pathway === 'CDN' ? 'CDN' : 'VOD'} tone={st.delivery.pathway === 'CDN' ? 'warn' : 'ok'} hint={st.delivery.mbps !== null ? tr(`현재 ${st.delivery.mbps} Mbps · 기준 ${st.delivery.ceilingMbps} / 복귀 ${st.delivery.returnMbps} Mbps`, `${st.delivery.mbps} Mbps now · ceiling ${st.delivery.ceilingMbps} / return ${st.delivery.returnMbps}`) : tr(`모드 ${st.delivery.mode}`, `mode ${st.delivery.mode}`)} /> : null}
        </div>
      ) : null}

      <PopularCard enabled={!!st?.featureEnabled} onOpenCourse={(code) => setP({ code })} />

      <div className="u-mt-8" />
      <FilterBar onSubmit={() => setP({ code: draft.trim() })} submitLabel={tr('조회', 'Look up')}>
        <FilterField label={tr('과정코드', 'Course code')} htmlFor="hls-code" width={240}><AInput id="hls-code" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="ARC2026" autoComplete="off" /></FilterField>
      </FilterBar>

      {p.code ? (
        <Card
          title={d ? `${d.title || d.lectureCode} · ${d.lectureCode}` : p.code}
          aside={d ? <span className="muted" style={{ fontSize: 12 }}>{tr(`차시 ${d.totals.chapters} · 파일 ${d.totals.sources} · 변환 완료 ${d.totals.ready} · 원본 ${fmtBytes(d.totals.sourceBytes)}`, `${d.totals.chapters} lessons · ${d.totals.sources} files · ${d.totals.ready} converted · ${fmtBytes(d.totals.sourceBytes)} source`)}</span> : null}
        >
          {d?.packageYN ? <Callout tone="info">{tr('패키지 과정입니다. 포함된 각 과정코드로 조회하세요.', 'This is a package course: look up each included course code.')}</Callout> : null}
          {d ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '0 0 10px' }}>
              <AButton size="sm" onClick={pickIdle} disabled={!canPick.size}>{tr(`최근 ${d.activeDays}일 미사용 차시 선택`, `Select idle lessons (${d.activeDays} d)`)}</AButton>
              <AButton size="sm" onClick={() => setPicked([...canPick])} disabled={!canPick.size}>{tr('전체 선택', 'Select all')}</AButton>
              <AButton size="sm" variant="ghost" onClick={() => setPicked([])} disabled={!picked.length}>{tr('선택 해제', 'Clear')}</AButton>
              <ACheckbox id="hls-1080" label={tr('1080p도 만들기 (코드·엑셀 화면 강의)', 'Also build 1080p (code / spreadsheet screens)')} checked={with1080} onChange={(e) => setWith1080(e.target.checked)} />
              <span style={{ flex: 1 }} />
              <AButton variant="primary" icon="play" disabled={!picked.length || !st?.featureEnabled} loading={enqueue.isPending} onClick={() => enqueue.mutate({ lectureCode: d.lectureCode, chapterSeqs: picked, include1080: with1080 })}>
                {tr(`선택 차시 HLS 변환 (${picked.length})`, `Convert selected (${picked.length})`)}
              </AButton>
            </div>
          ) : null}
          <DataTable columns={cols} rows={d?.chapters} rowKey={(c) => c.chapterSeq} loading={course.isPending} error={course.error} onRetry={() => void course.refetch()} dense emptyTitle={tr('차시가 없습니다.', 'No lessons.')} emptyBody=" " />
        </Card>
      ) : <Callout tone="info">{tr('과정코드를 입력하세요. "미사용" 표시는 최근 30일 동안 그 차시를 학습한 사람이 없다는 뜻이라, 시험 변환에 먼저 쓰기 좋습니다.', 'Enter a course code. "Idle" means nobody studied that lesson in the last 30 days, which makes it a safe first test.')}</Callout>}

      <div className="u-mt-8">
        <Card title={p.code ? tr(`변환 작업 · ${p.code}`, `Jobs · ${p.code}`) : tr('최근 변환 작업', 'Recent jobs')} aside={jobs.data ? <span className="muted" style={{ fontSize: 12 }}>{tr(`총 ${jobs.data.total}건`, `${jobs.data.total} total`)}</span> : null}>
          <DataTable columns={jobCols} rows={jobs.data?.items} rowKey={(j) => j.id} loading={jobs.isPending} error={jobs.error} onRetry={() => void jobs.refetch()} dense emptyTitle={tr('작업이 없습니다.', 'No jobs yet.')} emptyBody=" " />
        </Card>
      </div>

      <DetailDrawer open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} subtitle={tr('HLS 미리보기', 'HLS preview')} wide>
        {preview ? (
          <>
            <HlsPreview src={preview.src} />
            {preview.s.job?.result ? (
              <table className="u-mt-8" style={{ width: '100%', fontSize: 12 }}>
                <thead><tr><th align="left">{tr('화질', 'Rendition')}</th><th align="right">{tr('해상도', 'Size')}</th><th align="right">{tr('비트레이트', 'Bitrate')}</th><th align="right">{tr('용량', 'Bytes')}</th><th align="right">{tr('길이(초)', 'Seconds')}</th></tr></thead>
                <tbody>
                  {preview.s.job.result.renditions.map((r) => <tr key={r.name}><td>{r.name}</td><td align="right">{r.width}×{r.height}</td><td align="right">{Math.round(r.bandwidth / 1000)} kbps</td><td align="right">{fmtBytes(r.bytes)}</td><td align="right">{r.seconds.toFixed(3)}</td></tr>)}
                  <tr><td className="muted">{tr('원본', 'Source')}</td><td /><td /><td align="right" className="muted">{fmtBytes(preview.s.bytes)}</td><td align="right" className="muted">{preview.s.job.result.sourceSeconds.toFixed(3)}</td></tr>
                </tbody>
              </table>
            ) : null}
          </>
        ) : null}
      </DetailDrawer>
    </AdminPage>
  );
}
