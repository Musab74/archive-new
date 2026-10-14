import { useMemo, useState, type ChangeEvent } from 'react';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { CompanyImportPlanRow, CompanyImportResult } from '../../../../shared/api/schemas';
import { AButton, ACheckbox, AdminPage, ATextarea, Callout, Card, DataTable, Kpi, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { buildTemplateCsv, downloadText, mapImportRows, parseDelimited, type ImportRow, type MappedImport } from './companyImport';

const MAX_ROWS = 500;
const tone = (a: string) => (a === 'create' ? 'ok' : a === 'update' ? 'info' : 'danger') as 'ok' | 'info' | 'danger';

export default function CompanyImportPage() {
  const s = adm.companies.import;
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapped, setMapped] = useState<MappedImport | null>(null);
  const [plan, setPlan] = useState<CompanyImportResult | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);

  const run = useAdminMutation({
    fn: (body: { rows: ImportRow[]; mode: 'dryRun' | 'commit'; skipInvalid: boolean }) => adminApi.importCompanies(body), invalidate: [['admin', 'companies']],
    onSuccess: (r) => { setPlan(r); if (r.mode === 'commit' && r.applied) toast(s.done(r.applied.created, r.applied.updated, r.applied.skipped), { tone: 'ok' }); },
    onError: (err) => {
      const det = isAppError(err) ? (err.details as { summary?: CompanyImportResult['summary']; rows?: CompanyImportPlanRow[] } | undefined) : undefined;
      if (det?.rows && plan) setPlan({ ...plan, rows: plan.rows.map((r) => det.rows!.find((x) => x.line === r.line) ?? r) });
      toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
    },
  });

  const parse = () => {
    const m = mapImportRows(parseDelimited(text));
    setPlan(null);
    if (!m.rows.length) { setMapped(null); toast(s.empty, { tone: 'danger' }); return; }
    if (m.rows.length > MAX_ROWS) { setMapped(null); toast(s.tooMany, { tone: 'danger' }); return; }
    setMapped(m);
    run.mutate({ rows: m.rows, mode: 'dryRun', skipInvalid: false });
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result ?? '')); setMapped(null); setPlan(null); };
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  };
  const commit = () => { if (!mapped) return; run.mutate({ rows: mapped.rows, mode: 'commit', skipInvalid }); };

  const cols: Column<CompanyImportPlanRow>[] = useMemo(() => [
    { key: 'line', header: s.cols.line, align: 'right', width: 56 },
    { key: 'action', header: s.cols.action, align: 'center', render: (r) => <StatusBadge tone={tone(r.action)}>{s.actions[r.action] ?? r.action}</StatusBadge> },
    { key: 'companyCode', header: s.cols.code, nowrap: true, render: (r) => <span className="mono">{r.companyCode}</span> },
    { key: 'companyName', header: s.cols.name, render: (r) => <b>{r.companyName}</b> },
    { key: 'companyId', header: s.cols.id, nowrap: true, render: (r) => <span className="mono">{r.companyId}</span> },
    { key: 'homePage', header: s.cols.manage, nowrap: true, render: (r) => <span className="mono">{r.homePage}</span> },
    { key: 'errors', header: s.cols.errors, render: (r) => r.errors.length ? <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--c-danger)', fontSize: 12 }}>{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : <span className="muted">OK</span> },
  ], [s]);

  const committed = plan?.mode === 'commit';
  const canCommit = !!mapped && !!plan && plan.mode === 'dryRun' && (plan.summary.error === 0 || skipInvalid) && plan.summary.create + plan.summary.update > 0;
  return (
    <AdminPage title={s.title} lead={s.lead} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.companies.title, to: '/admin/companies' }, { label: s.title }]}
      actions={<><AButton onClick={() => downloadText('사업주정보_양식.csv', buildTemplateCsv(false))}>{s.template}</AButton><AButton onClick={() => downloadText('사업주정보_샘플.csv', buildTemplateCsv(true))}>{s.sample}</AButton><AButton to="/admin/companies">{adm.common.back}</AButton></>}>
      {!canWrite ? <Callout tone="warn" className="u-mb-8">{adm.readOnly}</Callout> : null}
      <Card title={s.paste}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ATextarea aria-label={s.paste} rows={8} value={text} onChange={(e) => { setText(e.target.value); setMapped(null); setPlan(null); setFileName(null); }} placeholder={tr('회사명\t사업주아이디\t회사규모\t사업자등록번호\t…  (엑셀에서 머리글 포함 복사 → 붙여넣기)', 'Company\tCompany ID\tSize\tBusiness no.\t…  (copy from Excel including the header row, then paste)')} spellCheck={false} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} disabled={!canWrite} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13 }}>{s.file}: <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" onChange={onFile} disabled={!canWrite} /></label>
            {fileName ? <span className="muted" style={{ fontSize: 12 }}>{fileName}</span> : null}
            <span style={{ flex: 1 }} />
            <AButton onClick={() => { setText(''); setMapped(null); setPlan(null); setFileName(null); }} disabled={!text}>{s.clear}</AButton>
            <AButton variant="primary" onClick={parse} loading={run.isPending && !plan} disabled={!canWrite || !text.trim()} title={readOnlyTitle}>{s.parse}</AButton>
          </div>
        </div>
      </Card>

      {mapped && plan ? (
        <Card className="u-mt-16" title={`${committed ? tr('등록 결과', 'Import result') : tr('검증 결과', 'Validation result')} · ${s.rows(plan.summary.total)}`}
          aside={<span className="muted" style={{ fontSize: 12 }}>{mapped.headerDetected ? s.headerDetected : s.headerAssumed}{mapped.unknownHeaders.length ? ` · ${tr('무시된 열', 'ignored columns')}: ${mapped.unknownHeaders.join(', ')}` : ''}</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
            <Kpi label={s.summary.total} value={plan.summary.total} />
            <Kpi label={s.summary.create} value={plan.summary.create} tone="ok" />
            <Kpi label={s.summary.update} value={plan.summary.update} tone="navy" />
            <Kpi label={s.summary.error} value={plan.summary.error} tone={plan.summary.error ? 'warn' : undefined} />
          </div>
          {committed && plan.applied ? <Callout tone="ok" className="u-mb-8">{s.done(plan.applied.created, plan.applied.updated, plan.applied.skipped)}</Callout> : plan.summary.error ? <Callout tone="warn" className="u-mb-8">{s.needFix}</Callout> : null}
          <DataTable columns={cols} rows={plan.rows} rowKey={(r) => r.line} size={50} dense />
          {!committed ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', marginTop: 12 }}>
              <ACheckbox label={s.skipInvalid} checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} disabled={!plan.summary.error} />
              <AButton variant="primary" onClick={commit} loading={run.isPending} disabled={!canWrite || !canCommit} title={readOnlyTitle}>{s.commit}</AButton>
            </div>
          ) : null}
        </Card>
      ) : null}
    </AdminPage>
  );
}
