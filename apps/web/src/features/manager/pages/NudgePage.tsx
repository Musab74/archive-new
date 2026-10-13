import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi, type TraineeStatus } from '../../../shared/api/endpoints/manager';
import type { TraineeRow } from '../../../shared/api/schemas';
import { useManager } from '../ManagerContext';
import { useToast } from '../../../app/providers/ToastProvider';
import { AButton, ACheckbox, ASelect, ATextarea, Bar, Callout, DataTable, type Column } from '../../../shared/ui/admin';
import { mgr } from '../strings';

/** Replaces {이름} {아이디} {과정} {학습시간} {달성률} {종료일} with the trainee's values. */
export function renderNudge(template: string, t: TraineeRow): string {
  const map: Record<string, string> = { '이름': t.name ?? t.id, '아이디': t.id, '과정': t.courseName, '학습시간': t.formatted, '달성률': `${t.percent}%`, '종료일': t.period.end };
  return template.replace(/\{([^}]+)\}/g, (m, k: string) => map[k] ?? m);
}

export default function NudgePage() {
  const { companyCode } = useManager();
  const { toast } = useToast();
  const [status, setStatus] = useState<TraineeStatus>('active');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [template, setTemplate] = useState(mgr.nudge.defaultTemplate);
  const query = useMemo(() => ({ companyCode: companyCode || undefined, status, page: 1, size: 100 }), [companyCode, status]);
  const list = useQuery({ queryKey: ['manager', 'trainees', query], queryFn: ({ signal }) => managerApi.trainees(query, signal), placeholderData: keepPreviousData });
  const rows = useMemo(() => (list.data?.items ?? []).filter((r) => !r.passOk), [list.data]);

  // AR-21: selection is cleared whenever the filter / company / scope changes.
  useEffect(() => { setSelected(new Set()); }, [companyCode, status]);

  const toggle = (seq: number) => setSelected((s) => { const n = new Set(s); if (n.has(seq)) n.delete(seq); else n.add(seq); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.studySeq));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.studySeq)));
  const chosen = rows.filter((r) => selected.has(r.studySeq));

  const columns: Column<TraineeRow>[] = [
    { key: '_sel', header: <ACheckbox label={<span className="sr-only">{mgr.nudge.selectAll}</span>} checked={allSelected} onChange={toggleAll} aria-label={mgr.nudge.selectAll} />, width: 40, render: (r) => <ACheckbox label={<span className="sr-only">{r.name ?? r.id}</span>} checked={selected.has(r.studySeq)} onChange={() => toggle(r.studySeq)} /> },
    { key: 'name', header: mgr.trainees.cols.name, sortable: true, render: (r) => <b>{r.name ?? '—'}</b> },
    { key: 'id', header: mgr.trainees.cols.id, sortable: true },
    { key: 'courseName', header: mgr.trainees.cols.course },
    { key: 'seconds', header: mgr.trainees.cols.time, align: 'right', sortable: true, render: (r) => r.formatted },
    { key: 'percent', header: mgr.trainees.cols.percent, sortable: true, width: 120, render: (r) => <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Bar value={r.percent} tone={r.percent < 50 ? 'warn' : undefined} /><span style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>{r.percent}%</span></div> },
    { key: 'period', header: '종료일', nowrap: true, render: (r) => r.period.end },
    { key: 'lastLearning', header: mgr.trainees.cols.last, nowrap: true, render: (r) => r.lastLearning ?? '미학습' },
  ];

  const copy = async () => {
    try { await navigator.clipboard.writeText(chosen.map((t) => renderNudge(template, t)).join('\n\n')); toast(mgr.nudge.copied, { tone: 'ok' }); } catch { /* ignore */ }
  };

  return (
    <div>
      <div className={styles.head}><div><h1>{mgr.nudge.title}</h1><p>{mgr.nudge.lead}</p></div></div>
      <div className={styles.steps}>
        <section className={styles.step}>
          <h2><span>1</span>{mgr.nudge.step1} <small className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>{mgr.nudge.selected(chosen.length)}</small></h2>
          <div className="u-flex u-gap-12 u-mb-8" style={{ alignItems: 'center' }}>
            <label htmlFor="nd-status" style={{ fontSize: 12, fontWeight: 600 }}>{mgr.trainees.status}</label>
            <ASelect id="nd-status" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value as TraineeStatus)} options={mgr.trainees.statuses.filter((s) => s.value !== 'passed')} />
          </div>
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.studySeq} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} dense size={20} onRowClick={(r) => toggle(r.studySeq)} emptyTitle={mgr.trainees.empty.title} emptyBody={mgr.trainees.empty.body} />
        </section>
        <section className={styles.step}>
          <h2><span>2</span>{mgr.nudge.step2}</h2>
          <label htmlFor="nd-template" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{mgr.nudge.template}</label>
          <ATextarea id="nd-template" value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} maxLength={300} />
          <p className="muted" style={{ fontSize: 12, margin: '6px 0 12px' }}>{mgr.nudge.placeholders} · {template.length}/300</p>
          <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{mgr.nudge.preview}</h3>
          <div className={styles.previewBox} aria-live="polite">{chosen.length ? chosen.slice(0, 3).map((t) => renderNudge(template, t)).join('\n\n') + (chosen.length > 3 ? `\n\n… 외 ${chosen.length - 3}명` : '') : mgr.nudge.noSelection}</div>
        </section>
        <section className={styles.step}>
          <h2><span>3</span>{mgr.nudge.step3}</h2>
          <Callout tone="warn">{mgr.nudge.sendNote}</Callout>
          <div className="u-flex u-gap-8 u-mt-16">
            <AButton onClick={() => void copy()} disabled={!chosen.length}>{mgr.nudge.copy}</AButton>
            <AButton variant="primary" disabled title={mgr.nudge.sendNote} aria-disabled="true">{mgr.nudge.send}</AButton>
          </div>
        </section>
      </div>
    </div>
  );
}
