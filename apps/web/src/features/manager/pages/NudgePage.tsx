import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi, type NudgeResult, type TraineeRow } from '../../../shared/api/endpoints/manager';
import { useManager } from '../ManagerContext';
import { useToast } from '../../../app/providers/ToastProvider';
import { AButton, ACheckbox, AInput, ATextarea, Callout, DataTable, StatusBadge, type Column } from '../../../shared/ui/admin';
import { ManagerError } from '../managerUi';
import { mgr } from '../strings';

const n = mgr.nudge;

/** Replaces {이름} {아이디} {과정} {학습시간} {달성률} {종료일} (the server renders the same tokens on send). */
export function renderNudge(template: string, t: Pick<TraineeRow, 'name' | 'id' | 'courseName' | 'timeLabel' | 'percent' | 'period'>): string {
  const map: Record<string, string> = { '이름': t.name ?? t.id, '아이디': t.id, '과정': t.courseName, '학습시간': t.timeLabel, '달성률': `${t.percent}%`, '종료일': t.period.end };
  return template.replace(/\{([^}]+)\}/g, (m, k: string) => map[k] ?? m);
}

/** AR-21 확인·독려: 학습 안내 대상 → 문구 확인 → 서버 재확인 후 발송 요청 (no provider → SEND_NOT_CONFIGURED). */
export default function NudgePage() {
  const { companyCode } = useManager();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [template, setTemplate] = useState(n.defaultTemplate);
  const [result, setResult] = useState<NudgeResult | null>(null);
  const query = useMemo(() => ({ companyCode: companyCode || undefined, q: applied || undefined, status: 'guide' as const, page, size: 100 }), [companyCode, applied, page]);
  const list = useQuery({ queryKey: ['manager', 'trainees', query], queryFn: ({ signal }) => managerApi.trainees(query, signal), placeholderData: keepPreviousData, retry: false });
  const rows = useMemo(() => (list.data?.items ?? []).filter((r) => r.nudge.eligible), [list.data]);

  // AR-21: the selection is cleared whenever the filter / company / page changes.
  useEffect(() => { setSelected(new Set()); setResult(null); }, [companyCode, applied, page]);

  const toggle = (seq: number) => setSelected((s) => { const x = new Set(s); if (x.has(seq)) x.delete(seq); else x.add(seq); return x; });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.studySeq));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.studySeq)));
  const chosen = rows.filter((r) => selected.has(r.studySeq));

  const send = useMutation({
    mutationFn: () => managerApi.sendNudge({ studySeqs: chosen.map((r) => r.studySeq), message: template.trim() }),
    onSuccess: (r) => { setResult(r); toast(r.message, { tone: 'warn' }); },
    onError: (e) => toast(e instanceof Error && e.message ? e.message : '요청하지 못했습니다.', { tone: 'danger' }),
  });

  const columns: Column<TraineeRow>[] = [
    { key: '_sel', header: <ACheckbox label={<span className="sr-only">{n.selectAll}</span>} checked={allSelected} onChange={toggleAll} aria-label={n.selectAll} />, width: 40, render: (r) => <span onClick={(e) => e.stopPropagation()}><ACheckbox label={<span className="sr-only">{r.name ?? r.id}</span>} checked={selected.has(r.studySeq)} onChange={() => toggle(r.studySeq)} /></span> },
    { key: 'name', header: n.cols.name, render: (r) => <b>{r.name ?? '—'}</b> },
    { key: 'id', header: n.cols.id, nowrap: true },
    { key: 'courseName', header: n.cols.course },
    { key: 'timeLabel', header: n.cols.time, align: 'right', nowrap: true },
    { key: 'percent', header: n.cols.percent, align: 'right', render: (r) => `${r.percent}%` },
    { key: 'period', header: n.cols.end, nowrap: true, render: (r) => r.period.end },
    { key: 'reason', header: n.cols.reason, render: (r) => r.nudge.reason },
  ];

  const copy = async () => { try { await navigator.clipboard.writeText(chosen.map((t) => renderNudge(template, t)).join('\n\n')); toast(n.copied, { tone: 'ok' }); } catch { /* ignore */ } };
  const canSend = chosen.length > 0 && template.trim().length > 0;

  return (
    <div>
      <div className={styles.head}><div><h1>{n.title}</h1><p>{n.lead}</p></div></div>
      {list.isError ? <ManagerError error={list.error} onRetry={() => void list.refetch()} /> : (
        <div className={styles.steps}>
          <section className={styles.step}>
            <h2><span>1</span>{n.step1} <small className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>{n.selected(chosen.length)}</small></h2>
            <form className="u-flex u-gap-8 u-mb-8" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(q.trim()); }}>
              <AInput aria-label={mgr.trainees.search} placeholder={mgr.trainees.search} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} />
              <AButton type="submit">조회</AButton>
            </form>
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.studySeq} loading={list.isPending} dense onRowClick={(r) => toggle(r.studySeq)}
              page={list.data?.page ?? 1} size={100} total={list.data?.total} onPageChange={setPage} emptyTitle={n.empty} emptyBody=" " />
          </section>
          <section className={styles.step}>
            <h2><span>2</span>{n.step2}</h2>
            <label htmlFor="nd-template" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{n.template}</label>
            <ATextarea id="nd-template" value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} maxLength={300} invalid={!template.trim()} />
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 12px' }}>{n.placeholders} · {template.length}/300</p>
            {!template.trim() ? <Callout tone="warn">{n.emptyTemplate}</Callout> : null}
            <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{n.preview}</h3>
            <div className={styles.previewBox} aria-live="polite">{chosen.length ? chosen.slice(0, 3).map((t) => renderNudge(template, t)).join('\n\n') + (chosen.length > 3 ? `\n\n… 외 ${chosen.length - 3}명` : '') : n.noSelection}</div>
          </section>
          <section className={styles.step}>
            <h2><span>3</span>{n.step3}</h2>
            <Callout tone="warn">{n.sendNote}</Callout>
            <div className="u-flex u-gap-8 u-mt-16">
              <AButton icon="copy" onClick={() => void copy()} disabled={!chosen.length}>{n.copy}</AButton>
              <AButton variant="primary" icon="send" onClick={() => send.mutate()} disabled={!canSend} loading={send.isPending}>{n.send}</AButton>
            </div>
            {send.isPending ? <p className={styles.note}>{n.sending}</p> : null}
            {result ? (
              <div style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{n.result} · {n.resultSummary(result.requested, result.eligible)}</h3>
                <ul className={styles.insights}>
                  {result.items.map((i) => <li key={i.studySeq}><StatusBadge tone={i.status === 'NOT_SENT' ? 'warn' : 'neutral'}>{n.status[i.status]}</StatusBadge> {i.name ?? i.id ?? i.studySeq} — {i.reason}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
