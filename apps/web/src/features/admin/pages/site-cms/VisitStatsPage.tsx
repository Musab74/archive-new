import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, ASelect, Card, DataTable, FilterBar, FilterField, Kpi, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { HOURS, STA_YEARS } from './siteCms.helpers';

const now = new Date();
const DEFAULTS = { year: now.getFullYear(), month: now.getMonth() + 1 };
interface Row { key: string; day: string; total: number; hours: number[]; isTotal?: boolean }

/** sta.php — 사이트관리 > 접속통계 관리 (G3): 일 × 시간대(0~23) 접속 카운터와 합계. */
export default function VisitStatsPage() {
  const [p, setP] = useSearchState(DEFAULTS);
  const query = useMemo(() => ({ year: p.year, month: p.month }), [p]);
  const stats = useQuery({ queryKey: ['admin', 'visit-stats', query], queryFn: ({ signal }) => adminSiteCmsApi.visitStats(query, signal), placeholderData: keepPreviousData });
  const rows: Row[] | undefined = useMemo(() => {
    const d = stats.data; if (!d) return undefined;
    return [...d.days.map((x) => ({ key: `d${x.day}`, day: String(x.day), total: x.total, hours: x.hours })), { key: 'total', day: tr('합계', 'Total'), total: d.totals.total, hours: d.totals.hours, isTotal: true }];
  }, [stats.data]);
  const columns: Column<Row>[] = [
    { key: 'day', header: tr('일', 'Day'), align: 'center', width: 60, render: (r) => r.isTotal ? <b>{r.day}</b> : r.day },
    { key: 'total', header: tr('총카운터', 'Total'), align: 'right', width: 90, render: (r) => <b>{r.total.toLocaleString('ko-KR')}</b> },
    ...HOURS.map((h): Column<Row> => ({ key: `h${h}`, header: String(h), align: 'right', width: 44, render: (r) => (r.isTotal ? <b>{r.hours[h] ?? 0}</b> : r.hours[h] ?? 0) })),
  ];
  const peak = useMemo(() => { const hs = stats.data?.totals.hours ?? []; let best = -1; hs.forEach((v, h) => { if (best < 0 || v > (hs[best] ?? 0)) best = h; }); return best; }, [stats.data]);
  return (
    <AdminPage title={tr('접속 통계', 'Visit statistics')} lead={tr('월별 일 × 시간대 접속 카운터(Sta 테이블)입니다. 저장된 값을 그대로 합산해 보여 줍니다.', 'Daily × hourly visit counters (Sta table) for one month, summed as stored.')}>
      <FilterBar>
        <FilterField label={tr('년', 'Year')} htmlFor="st-year" width={120}><ASelect id="st-year" value={String(p.year)} onChange={(e) => setP({ year: Number(e.target.value) })} options={STA_YEARS.map((y) => ({ value: String(y), label: String(y) }))} /></FilterField>
        <FilterField label={tr('월', 'Month')} htmlFor="st-mon" width={100}><ASelect id="st-mon" value={String(p.month)} onChange={(e) => setP({ month: Number(e.target.value) })} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} /></FilterField>
      </FilterBar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Kpi label={tr('월 합계', 'Month total')} value={stats.data?.totals.total} unit={tr('회', '')} />
        <Kpi label={tr('기록된 일수', 'Days recorded')} value={stats.data?.days.length} />
        <Kpi label={tr('최다 접속 시간대', 'Peak hour')} value={peak >= 0 && stats.data?.totals.total ? `${peak}시` : null} />
      </div>
      <Card title={`${p.year}년 ${p.month}월 ${tr('접속통계입니다.', 'visit statistics')}`}>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} loading={stats.isPending || stats.isFetching} error={stats.error} onRetry={() => void stats.refetch()} emptyTitle={tr('해당 월의 접속 기록이 없습니다.', 'No records for this month.')} dense />
      </Card>
    </AdminPage>
  );
}
