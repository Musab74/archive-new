import { useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { MANAGER_FILE, managerApi, openManagerPdf, type CohortCard } from '../../../shared/api/endpoints/manager';
import { useManager } from '../ManagerContext';
import { useSearchState } from '../../../shared/utils/useSearchState';
import { useToast } from '../../../app/providers/ToastProvider';
import { AButton, StatusBadge } from '../../../shared/ui/admin';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { ManagerError, Panel, YearSelect } from '../managerUi';
import { mgr } from '../strings';

const DEFAULTS = { year: '' };
const c = mgr.completion;

/** /manager/reports/education-results link for one cohort (education_results_report.php query). */
export const educationReportHref = (r: Pick<CohortCard, 'companyCode' | 'lectureCode' | 'period'>) =>
  `/manager/reports/education-results?${new URLSearchParams({ companyCode: r.companyCode, lectureCode: r.lectureCode, lectureStart: r.period.start, lectureEnd: r.period.end })}`;

/** CertificatePrintMulti(): passes the cohort ServiceType so the PDF filters A vs W vs Z. */
export const certificateQuery = (r: CohortCard) => ({ companyCode: r.companyCode, lectureStart: r.period.start, lectureEnd: r.period.end, lectureCode: r.lectureCode, serviceType: r.serviceType, serviceTypeYN: r.serviceType });

function CohortCardView({ r }: { r: CohortCard }) {
  const { toast } = useToast();
  const refund = r.mode === 'refund';
  const printCert = async () => {
    const win = window.open('about:blank', 'certi');
    try { await openManagerPdf(MANAGER_FILE.certificatesPdf, certificateQuery(r), win); }
    catch (e) { toast(e instanceof Error && e.message ? e.message : '수료증을 생성할 수 없습니다.', { tone: 'danger' }); }
  };
  return (
    <article className={styles.cohort}>
      <div className={styles.badges}>
        <StatusBadge tone={r.state === 'running' ? 'info' : r.state === 'ended' ? 'neutral' : 'warn'}>{c.state[r.state]}</StatusBadge>
        <StatusBadge tone={refund ? 'ink' : 'neutral'}>{c.mode[r.mode]}</StatusBadge>
        <StatusBadge tone={r.confirmed ? 'ok' : 'neutral'}>{r.confirmed ? c.confirmed : c.unconfirmed}</StatusBadge>
      </div>
      <h3>{r.title}</h3>
      <span className={styles.period}>{r.period.label}</span>
      <ul className={styles.stats}>
        <li><span>{c.total}</span><b>{r.totalCount.toLocaleString('ko-KR')}명</b></li>
        <li><span>{c.completed}</span><b>{r.completedCount.toLocaleString('ko-KR')}명</b></li>
        <li><span>{c.avgProgress}</span><b>{r.avgProgressRate}%</b></li>
      </ul>
      <p className={styles.note} style={{ margin: 0 }}>
        {c.comp.withRecord} {r.composition.withRecord} · {c.comp.noRecord} {r.composition.noRecord}
        {refund ? <> · {c.comp.over15h} {r.composition.over15h} · {c.comp.passed} {r.composition.passed} · {r.confirmed ? `${c.comp.notPassed} ${r.composition.notPassed}` : `${c.comp.pending} ${r.composition.pending}`}</> : null}
      </p>
      <p className={styles.note} style={{ margin: 0 }}>{c.deadline(r.reportDeadline)}</p>
      <div className={styles.actions}>
        <AButton size="sm" icon="file" onClick={() => void printCert()}>{c.certificate}</AButton>
        {r.reportAllowed ? <AButton size="sm" variant="primary" to={educationReportHref(r)}>{c.report}</AButton> : <AButton size="sm" disabled title={c.reportDenied} aria-disabled="true">{c.report}</AButton>}
      </div>
      {!r.reportAllowed ? <p className={styles.note} style={{ margin: 0 }}>{c.reportDenied}</p> : null}
    </article>
  );
}

/** 수료 관리 (tabs/tab-manager-complete.php). */
export default function CompletionPage() {
  const { companyCode } = useManager();
  const [params, setParams] = useSearchState(DEFAULTS);
  const q = useQuery({ queryKey: ['manager', 'completion', companyCode, params.year], queryFn: ({ signal }) => managerApi.completion({ companyCode: companyCode || undefined, year: params.year || undefined }, signal), retry: false });
  const d = q.data;
  return (
    <div>
      <div className={styles.head}>
        <div><h1>{c.title}</h1><p>{c.lead}</p></div>
        <YearSelect id="cp-year" value={params.year} options={d?.yearOptions ?? []} allLabel={mgr.year.all} onChange={(v) => setParams({ year: v })} />
      </div>
      {q.isError ? <ManagerError error={q.error} onRetry={() => void q.refetch()} /> : q.isPending ? <Skeleton lines={6} /> : d ? (
        <>
          {d.items.length ? <div className={styles.cards}>{d.items.map((r) => <CohortCardView key={`${r.companyCode}|${r.lectureCode}|${r.serviceType}|${r.period.start}|${r.period.end}`} r={r} />)}</div>
            : <StateBlock code="EMPTY" center title={c.empty} body=" " hideActions />}
          <p className={styles.note}>{c.certWait}</p>
          <div style={{ marginTop: 20 }}>
            <Panel title={c.insight} note={c.insightNote}>
              <ul className={styles.insights}>
                <li><h4>{c.insightTitles.status}</h4>{d.insight.status}</li>
                <li><h4>{c.insightTitles.warning}</h4>{d.insight.warning}</li>
                <li><h4>{c.insightTitles.suggestion}</h4>{d.insight.suggestion}</li>
              </ul>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
