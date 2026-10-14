import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AdminCategories } from '../../../../shared/api/schemas';
import { AdminPage, Card, DataTable, YnBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';

type Keyword = AdminCategories['keywords'][number];
const c = adm.courses.categories.cols;
const kwCols: Column<Keyword>[] = [
  { key: 'idx', header: c.idx, align: 'right', sortable: true },
  { key: 'category', header: c.category, sortable: true, render: (r) => r.category ?? '' },
  { key: 'keyword', header: c.keyword, sortable: true, render: (r) => <b>{r.keyword}</b> },
  { key: 'jobCate', header: c.job, render: (r) => r.jobCate ?? '' },
  { key: 'order', header: c.order, align: 'right', render: (r) => (r.order ?? '') as string | number },
  { key: 'useYN', header: c.useYN, align: 'center', render: (r) => <YnBadge value={r.useYN} /> },
];

export default function CategoriesPage() {
  const q = useQuery({ queryKey: ['admin', 'categories'], queryFn: ({ signal }) => adminApi.categories(signal), staleTime: 10 * 60_000 });
  const d = q.data;
  return (
    <AdminPage title={adm.courses.categories.title} lead={adm.courses.categories.lead}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
          <Card title={`${adm.courses.categories.tree} (${d?.categories.length ?? 0})`}>
            {d && d.tree.length === 0 ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>{tr('등록된 분류가 없습니다.', 'No categories.')}</p> : null}
            <ul style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(d?.tree ?? []).map((t) => (
                <li key={t.idx}>
                  <b>{t.name}</b> <span className="muted">#{t.idx}</span> {t.useYN === 'N' ? <YnBadge value="N" /> : null}
                  {t.children.length ? <ul style={{ paddingLeft: 16, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>{t.children.map((ch) => <li key={ch.idx}>{ch.name} <span className="muted">#{ch.idx}</span> {ch.useYN === 'N' ? <YnBadge value="N" /> : null}</li>)}</ul> : null}
                </li>
              ))}
            </ul>
          </Card>
          <Card title={`${adm.courses.categories.keywords} (${d?.keywords.length ?? 0})`}><DataTable columns={kwCols} rows={d?.keywords} rowKey={(r) => r.idx} loading={q.isPending} dense size={30} emptyTitle={tr('등록된 키워드가 없습니다.', 'No keywords.')} emptyBody=" " /></Card>
        </div>
      )}
    </AdminPage>
  );
}
