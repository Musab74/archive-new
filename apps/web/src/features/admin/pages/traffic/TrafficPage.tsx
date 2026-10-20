import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminTrafficApi, type TrafficLearner, type TrafficLive } from '../../../../shared/api/endpoints/admin-traffic';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, Callout, Card, DataTable, FilterBar, FilterField, Kpi, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';

const POLL_MS = 2_000;
const MAX_PINS = 6;
type FocusInfo = TrafficLive['focus'][number];
const DEFAULTS = { pin: '', q: '' };

/** Decimal units, like network speeds: 1 MB = 1,000,000 bytes. */
export const fmtRate = (bps: number) => `${(bps / 1e6).toFixed(2)} MB/s`;
export const fmtMbps = (bps: number) => `${((bps * 8) / 1e6).toFixed(1)} Mbps`;
export function fmtMB(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}
const hhmmss = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour12: false, timeZone: 'Asia/Seoul' }) : '—');
const sinceText = (iso: string | null) => {
  if (!iso) return '—';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? tr(`${m}분`, `${m} min`) : tr(`${Math.floor(m / 60)}시간 ${m % 60}분`, `${Math.floor(m / 60)} h ${m % 60} min`);
};
/** Rounded axis top (MB/s) so shared scales stay readable. */
function niceMax(bps: number): number {
  const mb = Math.max(bps / 1e6, 0.1);
  const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].find((s) => mb <= s * 4) ?? 200;
  return Math.ceil(mb / step) * step * 1e6;
}

/** Bytes per second for the last N seconds (oldest first, last point = now): line + light area, crosshair tooltip, table fallback. */
export function LiveRateChart({ series, at, max, label, height = 200 }: { series: number[]; at: string; max: number; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  // draw at the real pixel width so text and line weight stay the same size in narrow and wide cards
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e?.contentRect.width ?? 0); if (w > 0) setW(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height; const L = 48; const R = 12; const T = 20; const B = 26;
  const n = series.length;
  const end = new Date(at).getTime();
  const x = (i: number) => L + (n <= 1 ? 0 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - Math.min(v, max) / max);
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = n ? `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const minutes = Math.round(n / 60);
  const xTicks = Array.from({ length: minutes + 1 }, (_, k) => n - 1 - k * 60).filter((i) => i >= 0);
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * (W - L - R);
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / (W - L - R)) * (n - 1)))));
  };
  const tenSec = useMemo(() => {
    const rows: { t: string; v: number }[] = [];
    for (let i = n; i - 10 >= 0; i -= 10) rows.push({ t: hhmmss(new Date(end - (n - i) * 1000).toISOString()), v: series.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10 });
    return rows;
  }, [series, n, end]);
  return (
    <figure style={{ margin: 0 }}>
      <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={label} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--c-line, #e5e7eb)" strokeWidth={1} /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--c-muted, #6b7280)">{(t / 1e6).toFixed(t / 1e6 < 1 ? 2 : 1)}</text></g>)}
        <text x={0} y={10} fontSize={11} fill="var(--c-muted, #6b7280)">MB/s</text>
        {xTicks.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === n - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--c-muted, #6b7280)">{i === n - 1 ? tr('지금', 'now') : tr(`-${Math.round((n - 1 - i) / 60)}분`, `-${Math.round((n - 1 - i) / 60)} min`)}</text>)}
        <path d={area} fill="var(--c-primary, #2563eb)" opacity={0.1} />
        <path d={line} fill="none" stroke="var(--c-primary, #2563eb)" strokeWidth={2} strokeLinejoin="round" />
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={onMove} />
        {hover !== null && n ? (() => {
          const v = series[hover] ?? 0; const tx = Math.min(W - R - 132, Math.max(L, x(hover) - 66));
          return <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--c-muted, #9ca3af)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(v)} r={4} fill="var(--c-paper, #fff)" stroke="var(--c-primary, #2563eb)" strokeWidth={2} />
            <rect x={tx} y={T} width={132} height={36} rx={6} fill="var(--c-ink, #111827)" opacity={0.92} />
            <text x={tx + 8} y={T + 15} fontSize={11} fill="#fff">{hhmmss(new Date(end - (n - 1 - hover) * 1000).toISOString())}</text>
            <text x={tx + 8} y={T + 29} fontSize={12} fill="#fff" fontWeight={600}>{fmtRate(v)} · {fmtMbps(v)}</text>
          </g>;
        })() : null}
      </svg>
      </div>
      <details style={{ fontSize: 12 }}><summary>{tr('표로 보기 (10초 평균)', 'Show table (10 s averages)')}</summary>
        <table className="mono" style={{ borderCollapse: 'collapse' }}><tbody>{tenSec.map((r) => <tr key={r.t}><td style={{ padding: '2px 8px' }}>{r.t}</td><td style={{ padding: '2px 8px', textAlign: 'right' }}>{fmtRate(r.v)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}

/** Last 60 s in 2 s steps; the number next to it carries the value. */
function Spark({ points, max }: { points: number[]; max: number }) {
  if (!points.length) return <span className="muted">—</span>;
  const W = 84; const H = 22; const top = Math.max(max, 1);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${((i * W) / Math.max(points.length - 1, 1)).toFixed(1)},${(H - 1 - (Math.min(v, top) / top) * (H - 2)).toFixed(1)}`).join(' ');
  return <svg width={W} height={H} aria-hidden="true" style={{ verticalAlign: 'middle' }}><path d={d} fill="none" stroke="var(--c-primary, #2563eb)" strokeWidth={1.5} strokeLinejoin="round" /></svg>;
}

function LearnerName({ l }: { l: Pick<TrafficLearner, 'id' | 'name'> }) {
  return <span><strong>{l.name ?? '—'}</strong> <span className="muted mono" style={{ fontSize: 12 }}>{l.id}</span></span>;
}

function IpCell({ l }: { l: TrafficLearner }) {
  if (!l.ip) return <span className="muted">{tr('IP 없음', 'No IP')}</span>;
  return <span className="mono">{l.ip}{l.sharedIp > 1 ? <> <StatusBadge tone="warn">{tr(`공유 ${l.sharedIp}명`, `shared ×${l.sharedIp}`)}</StatusBadge></> : null}</span>;
}

/** One learner side by side with the others: big current speed, totals, last 5 minutes on the shared scale. */
function ComparePanel({ l, id, info, series, at, max, auto, onUnpin }: { l: TrafficLearner | null; id: string; info: FocusInfo | undefined; series: number[]; at: string; max: number; auto: boolean; onUnpin: () => void }) {
  return (
    <Card
      title={l ? <LearnerName l={l} /> : <LearnerName l={{ id, name: info?.name ?? null }} />}
      aside={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{auto ? <StatusBadge tone="info">{tr('자동 선택', 'Auto')}</StatusBadge> : null}<AButton size="xs" variant="ghost" onClick={onUnpin}>{auto ? tr('숨기기', 'Hide') : tr('빼기', 'Remove')}</AButton></span>}
    >
      {l ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {l.companyName ?? '—'} · {l.courseName ?? l.lectureCode}<br />
            {l.lessonTitle ?? `#${l.contentsIdx}`} · <IpCell l={l} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'baseline' }}>
            <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtRate(l.rateBps)}</span>
            <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMbps(l.rateBps)}</span>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, margin: 0, fontSize: 13 }}>
            <div><dt className="muted" style={{ fontSize: 11 }}>{tr('이번 학습 사용량', 'This session')}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{fmtMB(l.sessionBytes)}</dd></div>
            <div><dt className="muted" style={{ fontSize: 11 }}>{tr('오늘 사용량', 'Today')}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{fmtMB(l.todayBytes)}</dd></div>
            <div><dt className="muted" style={{ fontSize: 11 }}>{tr('최고 (1분)', 'Peak (1 min)')}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{fmtRate(l.peakBps)}</dd></div>
            <div><dt className="muted" style={{ fontSize: 11 }}>{tr('학습 시간 · 연결', 'Watching · conns')}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{sinceText(l.sessionStart)} · {l.connections}</dd></div>
          </dl>
          <LiveRateChart series={series} at={at} max={max} height={170} label={tr(`${l.name ?? l.id} 최근 5분 전송 속도`, `${l.name ?? l.id}, speed over the last 5 minutes`)} />
        </div>
      ) : info?.exists === false ? (
        <Callout tone="warn">{tr(`'${id}' 아이디의 회원이 없습니다. 아이디를 확인해 주세요.`, `No member with the ID '${id}'. Check the ID.`)}</Callout>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{info?.companyName ?? '—'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center' }}>
            <StatusBadge tone="neutral">{tr('지금 학습 중 아님', 'Not studying now')}</StatusBadge>
            <span className="muted" style={{ fontSize: 12 }}>{tr('학습을 시작하면 첫 플레이어 신호 뒤(보통 몇 초~1분) 숫자가 움직입니다.', 'Numbers start after the first player tick once a lesson is opened (a few seconds to a minute).')}</span>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, margin: 0, fontSize: 13 }}>
            <div><dt className="muted" style={{ fontSize: 11 }}>{tr('현재 속도', 'Now')}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{fmtRate(0)}</dd></div>
            <div><dt className="muted" style={{ fontSize: 11 }}>{tr('오늘 사용량', 'Today')}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{fmtMB(info?.todayBytes ?? 0)}</dd></div>
          </dl>
          <LiveRateChart series={series} at={at} max={max} height={170} label={tr(`${info?.name ?? id} 최근 5분 전송 속도`, `${info?.name ?? id}, speed over the last 5 minutes`)} />
        </div>
      )}
    </Card>
  );
}

/**
 * 실시간 트래픽 (학습자별): every learner whose player is ticking, with the bytes their IP is receiving right now, refreshed every
 * 2 seconds. Pin learners to compare them side by side; with nothing pinned the two busiest are shown.
 */
export function TrafficPage() {
  const [p, setP] = useSearchState(DEFAULTS);
  const pins = useMemo(() => p.pin.split(',').filter(Boolean).slice(0, MAX_PINS), [p.pin]);
  const [auto, setAuto] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const shown = pins.length ? pins : auto;

  const q = useQuery({
    queryKey: ['admin', 'traffic', 'live', shown.join(',')],
    queryFn: ({ signal }) => adminTrafficApi.live(shown, signal),
    refetchInterval: paused ? false : POLL_MS, refetchIntervalInBackground: false, placeholderData: keepPreviousData, retry: 1,
  });
  const d: TrafficLive | undefined = q.data;

  // with nothing pinned, keep showing the same two busy learners until they stop studying (no reshuffle every poll)
  useEffect(() => {
    if (!d || pins.length) return;
    const active = new Set(d.items.map((i) => i.id));
    if (auto.length >= 2 && auto.every((id) => active.has(id))) return;
    const keep = auto.filter((id) => active.has(id));
    const next = [...keep, ...d.items.filter((i) => i.rateBps > 0 && !keep.includes(i.id) && !hidden.includes(i.id)).map((i) => i.id)].slice(0, 2);
    if (next.join(',') !== auto.join(',')) setAuto(next);
  }, [d, pins.length, auto, hidden]);

  const [idText, setIdText] = useState('');
  const addIds = () => {
    const typed = idText.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    if (!typed.length) return;
    const next = [...pins, ...typed.filter((x) => !pins.includes(x))].slice(0, MAX_PINS);
    setP({ pin: next.join(',') });
    setIdText('');
  };
  const togglePin = (id: string) => {
    const next = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id].slice(0, MAX_PINS);
    setP({ pin: next.join(',') });
  };
  const unpin = (id: string) => (pins.length ? togglePin(id) : (setHidden((h) => [...h, id]), setAuto((a) => a.filter((x) => x !== id))));

  const byId = useMemo(() => new Map((d?.items ?? []).map((i) => [i.id, i])), [d]);
  const sharedMax = useMemo(() => niceMax(Math.max(0, ...(d?.focus ?? []).filter((f) => shown.includes(f.id)).flatMap((f) => f.series))), [d, shown]);
  const tableMax = useMemo(() => Math.max(1, ...(d?.items ?? []).flatMap((i) => i.spark)), [d]);
  const rows = useMemo(() => {
    const term = p.q.trim().toLowerCase();
    const items = d?.items ?? [];
    return term ? items.filter((i) => [i.id, i.name, i.companyName, i.ip, i.courseName, i.lessonTitle].some((v) => v?.toLowerCase().includes(term))) : items;
  }, [d, p.q]);

  const columns: Column<TrafficLearner>[] = [
    { key: 'pin', header: tr('비교', 'Compare'), width: 70, render: (r) => <AButton size="xs" variant={pins.includes(r.id) ? 'primary' : 'default'} onClick={() => togglePin(r.id)} aria-pressed={pins.includes(r.id)} disabled={!pins.includes(r.id) && pins.length >= MAX_PINS}>{pins.includes(r.id) ? tr('고정됨', 'Pinned') : tr('고정', 'Pin')}</AButton> },
    { key: 'name', header: tr('학습자', 'Learner'), render: (r) => <><LearnerName l={r} /><div className="muted" style={{ fontSize: 12 }}>{r.companyName ?? '—'}</div></> },
    { key: 'lesson', header: tr('과정 · 차시', 'Course · lesson'), render: (r) => <div style={{ maxWidth: 280, whiteSpace: 'normal', fontSize: 13 }}>{r.courseName ?? r.lectureCode}<div className="muted" style={{ fontSize: 12 }}>{r.lessonTitle ?? `#${r.contentsIdx}`}</div></div> },
    { key: 'ip', header: 'IP', nowrap: true, render: (r) => <IpCell l={r} /> },
    { key: 'rate', header: tr('현재 속도', 'Now'), align: 'right', nowrap: true, sortable: true, sortValue: (r) => r.rateBps, render: (r) => <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}><Spark points={r.spark} max={tableMax} /><span><strong>{fmtRate(r.rateBps)}</strong><div className="muted" style={{ fontSize: 11 }}>{fmtMbps(r.rateBps)}</div></span></span> },
    { key: 'peak', header: tr('최고 (1분)', 'Peak (1 min)'), align: 'right', nowrap: true, sortable: true, sortValue: (r) => r.peakBps, render: (r) => fmtRate(r.peakBps) },
    { key: 'session', header: tr('이번 학습', 'This session'), align: 'right', nowrap: true, sortable: true, sortValue: (r) => r.sessionBytes, render: (r) => <>{fmtMB(r.sessionBytes)}<div className="muted" style={{ fontSize: 11 }}>{sinceText(r.sessionStart)}</div></> },
    { key: 'today', header: tr('오늘', 'Today'), align: 'right', nowrap: true, sortable: true, sortValue: (r) => r.todayBytes, render: (r) => fmtMB(r.todayBytes) },
    { key: 'tick', header: tr('마지막 신호', 'Last tick'), nowrap: true, render: (r) => <span className="mono" style={{ fontSize: 12 }}>{r.lastTick.slice(11, 19)}</span> },
  ];

  const m = d?.monitor;
  return (
    <AdminPage
      title={tr('실시간 트래픽 (학습자별)', 'Live traffic by learner')}
      icon="activity"
      lead={tr('지금 학습 중인 사람마다 받고 있는 데이터 속도(MB/s)와 사용량을 2초마다 보여 줍니다. 학습자 ID를 입력하면 최대 6명을 나란히 비교할 수 있습니다.', 'Speed (MB/s) and data used by each learner who is studying now, refreshed every 2 seconds. Enter learner IDs to compare up to 6 side by side.')}
      actions={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 12 }}>{q.isFetching && !paused ? '●' : '○'} {tr('갱신', 'Updated')} {hhmmss(d?.at ?? null)}</span>
        <AButton size="sm" onClick={() => setPaused((x) => !x)} icon={paused ? 'play' : undefined}>{paused ? tr('다시 시작', 'Resume') : tr('일시정지', 'Pause')}</AButton>
      </span>}
    >
      {q.isError && !d ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : null}
      {m && (!m.enabled || !m.running) ? <Callout tone="warn">{tr('측정기가 꺼져 있습니다 (API 환경 TRAFFIC_MONITOR). 숫자가 쌓이지 않습니다.', 'The meter is off (API env TRAFFIC_MONITOR); nothing is being counted.')}</Callout> : null}
      {m?.error ? <Callout tone="warn">{tr('네트워크 측정 오류', 'Network sampling error')}: <span className="mono">{m.error}</span></Callout> : null}
      {m?.learnerError ? <Callout tone="warn">{tr('학습자 조회 오류', 'Learner lookup error')}: <span className="mono">{m.learnerError}</span></Callout> : null}

      {d ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <Kpi label={tr('웹 서버 전체 속도', 'Whole web server')} value={(d.site.rateBps / 1e6).toFixed(2)} unit="MB/s" hint={`${fmtMbps(d.site.rateBps)} · ${tr('5분 최고', '5-min peak')} ${fmtRate(d.site.peakBps)}`} icon="activity" />
            <Kpi label={tr('학습자 합계 속도', 'Learners combined')} value={(d.learners.rateBps / 1e6).toFixed(2)} unit="MB/s" hint={d.site.rateBps ? tr(`전체의 ${Math.round((d.learners.rateBps / d.site.rateBps) * 100)}%`, `${Math.round((d.learners.rateBps / d.site.rateBps) * 100)}% of total`) : '—'} />
            <Kpi label={tr('학습 중 / 받는 중', 'Studying / receiving')} value={`${d.learners.active} / ${d.learners.receiving}`} unit={tr('명', '')} hint={d.learners.sharedIps ? tr(`공유 IP ${d.learners.sharedIps}개`, `${d.learners.sharedIps} shared IPs`) : tr(`연결 ${d.site.connections}개`, `${d.site.connections} connections`)} icon="user" />
            <Kpi label={tr('오늘 전체 전송량', 'Sent today (all)')} value={fmtMB(d.site.todayBytes)} hint={tr(`${d.day} 00:00 KST부터`, `since ${d.day} 00:00 KST`)} />
          </div>

          <section aria-label={tr('학습자 비교', 'Learner comparison')}>
            <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>{tr('학습자 비교', 'Compare learners')} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{pins.length ? tr(`${pins.length}/${MAX_PINS}명 · 같은 눈금`, `${pins.length}/${MAX_PINS} · same scale`) : tr('아이디를 입력하지 않으면 지금 가장 많이 받는 2명을 보여 줍니다', 'With no IDs entered, the two busiest learners are shown')}</span></h2>
            <form onSubmit={(e) => { e.preventDefault(); addIds(); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <label htmlFor="traffic-ids" className="muted" style={{ fontSize: 13 }}>{tr('비교할 학습자 ID', 'Learner IDs to compare')}</label>
              <AInput id="traffic-ids" value={idText} onChange={(e) => setIdText(e.target.value)} placeholder={tr('예: kim01, lee002 (쉼표로 여러 명)', 'e.g. kim01, lee002 (comma separated)')} style={{ width: 'min(100%, 320px)' }} disabled={pins.length >= MAX_PINS} autoComplete="off" />
              <AButton type="submit" size="sm" variant="primary" disabled={!idText.trim() || pins.length >= MAX_PINS}>{tr('비교에 추가', 'Add')}</AButton>
              {pins.length ? <AButton type="button" size="sm" variant="ghost" onClick={() => setP({ pin: '' })}>{tr('모두 지우기', 'Clear all')}</AButton> : null}
              {pins.map((id) => (
                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 10px', border: '1px solid var(--c-line, #e5e7eb)', borderRadius: 999, fontSize: 12 }}>
                  <span className="mono">{id}</span>
                  <button type="button" onClick={() => togglePin(id)} aria-label={tr(`${id} 비교에서 빼기`, `Remove ${id}`)} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '0 6px', fontSize: 14, lineHeight: 1, color: 'var(--c-muted, #6b7280)' }}>×</button>
                </span>
              ))}
            </form>
            {shown.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 12 }}>
                {shown.map((id) => { const f = d.focus.find((x) => x.id === id); return <ComparePanel key={id} id={id} l={byId.get(id) ?? null} info={f} series={f?.series ?? []} at={d.at} max={sharedMax} auto={!pins.length} onUnpin={() => unpin(id)} />; })}
              </div>
            ) : <Card><p className="muted" style={{ margin: 0 }}>{tr('지금 영상을 받고 있는 학습자가 없습니다.', 'No learner is receiving video right now.')}</p></Card>}
          </section>

          <Card title={tr('웹 서버 전체 — 최근 5분', 'Whole web server — last 5 minutes')}>
            <LiveRateChart series={d.site.series} at={d.at} max={niceMax(Math.max(0, ...d.site.series))} label={tr('웹 서버 전체 전송 속도 최근 5분', 'Whole web server speed, last 5 minutes')} />
          </Card>

          <Card title={tr(`학습 중인 학습자 ${d.items.length}명`, `${d.items.length} learners studying`)} aside={<span className="muted" style={{ fontSize: 12 }}>{tr('빠른 순', 'Fastest first')}</span>}>
            <FilterBar>
              <FilterField label={tr('검색', 'Search')}><AInput value={p.q} onChange={(e) => setP({ q: e.target.value })} placeholder={tr('이름, ID, 회사, IP, 과정', 'Name, ID, company, IP, course')} /></FilterField>
            </FilterBar>
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle={tr('지금 학습 중인 학습자가 없습니다', 'Nobody is studying right now')} emptyBody={tr(`최근 ${m?.activeWindowSec ?? 180}초 안에 플레이어 신호가 있는 학습자를 보여 줍니다.`, `Shows learners with a player tick in the last ${m?.activeWindowSec ?? 180} s.`)} />
          </Card>

          <Card title={tr('학습자가 아닌 접속 (상위 30)', 'Other visitors (top 30)')}>
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 13 }}>{tr(`${d.unidentified.length}개 IP — 페이지 방문, 관리자, 아직 신호가 없는 학습자 등`, `${d.unidentified.length} IPs — page visits, staff, learners before their first tick`)}</summary>
              <table className="mono" style={{ borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
                <thead><tr><th style={{ textAlign: 'left', padding: '2px 10px' }}>IP</th><th style={{ textAlign: 'right', padding: '2px 10px' }}>{tr('현재', 'Now')}</th><th style={{ textAlign: 'right', padding: '2px 10px' }}>{tr('오늘', 'Today')}</th><th style={{ textAlign: 'right', padding: '2px 10px' }}>{tr('연결', 'Conns')}</th></tr></thead>
                <tbody>{d.unidentified.map((u) => <tr key={u.ip}><td style={{ padding: '2px 10px' }}>{u.ip}</td><td style={{ padding: '2px 10px', textAlign: 'right' }}>{fmtRate(u.rateBps)}</td><td style={{ padding: '2px 10px', textAlign: 'right' }}>{fmtMB(u.todayBytes)}</td><td style={{ padding: '2px 10px', textAlign: 'right' }}>{u.connections}</td></tr>)}</tbody>
              </table>
            </details>
          </Card>

          <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            {tr(
              `측정 방법: 웹 서버(포트 ${m?.ports.join('/')})의 연결마다 학습자가 실제로 받은 바이트(커널 TCP 카운터)를 ${(m?.sampleMs ?? 1000) / 1000}초마다 읽어 접속 IP별로 더하고, 그 IP에서 플레이어 신호를 보낸 학습자에게 나눕니다. 현재 속도 = 최근 ${m?.rateWindowSec ?? 5}초 평균. 같은 IP(회사 공유망)의 학습자는 똑같이 나눈 추정치입니다. 끊긴 연결의 마지막 1초 미만은 빠질 수 있어 실제보다 약간 적게 나옵니다. 1 MB = 1,000,000 바이트. 측정 시작 ${hhmmss(m?.startedAt ?? null)}.`,
              `How it is measured: for every connection on the web ports (${m?.ports.join('/')}) the bytes the learner really received (kernel TCP counter) are read every ${(m?.sampleMs ?? 1000) / 1000} s, summed per IP and given to the learners whose player ticks come from that IP. Now = ${m?.rateWindowSec ?? 5}-second average. Learners sharing one IP (company network) get an even split (estimate). The last fraction of a second of a closed connection can be missed, so figures read slightly low. 1 MB = 1,000,000 bytes. Meter started ${hhmmss(m?.startedAt ?? null)}.`,
            )}
          </p>
        </div>
      ) : !q.isError ? <p className="muted">{tr('불러오는 중…', 'Loading…')}</p> : null}
    </AdminPage>
  );
}
