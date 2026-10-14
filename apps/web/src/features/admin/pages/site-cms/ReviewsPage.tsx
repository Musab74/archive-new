import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import type { ReviewRow } from '../../../../shared/api/endpoints/admin-site-cms';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { rowNumber } from './siteCms.helpers';

const DEFAULTS = { col: 'ContentsName', q: '', page: 1 };
const SIZE = 20;

/** survey.php / survey_read.php / survey_excel.php — 커뮤니티관리 > 수강후기 (F4). */
export default function ReviewsPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const { toast } = useToast();
  const { canWrite } = useWriteGate();
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'reviews', query], queryFn: ({ signal }) => adminSiteCmsApi.reviews(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const [sel, setSel] = useState<ReviewRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'review', sel?.idx], queryFn: ({ signal }) => adminSiteCmsApi.review(sel!.idx, signal), enabled: !!sel });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminSiteCmsApi.deleteReview(sel!.idx), invalidate: [['admin', 'reviews']], success: adm.common.deleted, onSuccess: () => { setDelOpen(false); setSel(null); } });
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try { await adminSiteCmsApi.downloadReviewsCsv({ col: query.col, q: query.q }); }
    catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
    finally { setExporting(false); }
  };

  const columns: Column<ReviewRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => rowNumber(total, p.page, SIZE, i) },
    { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => <b>{r.courseName ?? r.lectureCode ?? ''}</b> },
    { key: 'stars', header: tr('별점', 'Rating'), nowrap: true, render: (r) => <span title={String(r.starPoint ?? '')} style={{ color: 'var(--c-warn, #d98b00)', letterSpacing: 1 }}>{r.stars}</span> },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <span className="mono">{r.id ?? ''}</span> },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => r.title ?? '' },
    { key: 'ip', header: tr('등록 IP', 'IP'), nowrap: true, render: (r) => <span className="mono">{r.ip ?? ''}</span> },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'viewCount', header: tr('조회수', 'Views'), align: 'right', render: (r) => r.viewCount.toLocaleString('ko-KR') },
  ];
  const d = detail.data;
  return (
    <AdminPage title={tr('수강후기', 'Course reviews')} lead={tr('학습자가 남긴 수강후기 목록입니다. 행을 누르면 내용을 확인하고 삭제할 수 있습니다.', 'Reviews written by learners. Click a row to read or delete one.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'ContentsName', q: '' }); reset(); }}
        extra={<AButton onClick={() => void exportCsv()} loading={exporting} disabled={!list.data || total === 0}>{tr('검색항목 엑셀 출력', 'Export CSV')}</AButton>}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="rv-col" width={130}><ASelect id="rv-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ContentsName', label: tr('과정명', 'Course') }, { value: 'ID', label: tr('아이디', 'User ID') }, { value: 'Title', label: tr('제목', 'Title') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="rv-q" width={260}><AInput id="rv-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 수강후기가 없습니다.', 'No reviews.')} dense />

      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={sel?.title ?? ''} subtitle={sel?.courseName ?? ''} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="danger" disabled={!canWrite} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={tr('수강후기', 'Review')}>
              <DescList cols={2} items={[[tr('과정명', 'Course'), d.courseName ?? d.lectureCode], [tr('별점', 'Rating'), <span key="s">{d.stars} ({d.starPoint ?? 0})</span>], [tr('아이디', 'User ID'), d.id], [tr('등록IP', 'IP'), d.ip], [tr('등록일', 'Registered'), d.regDate], [tr('조회수', 'Views'), d.viewCount], [tr('제목', 'Title'), d.title]]} />
            </Card>
            <Card title={tr('내용', 'Content')}><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{d.contents ?? ''}</div></Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>
      <ConfirmDialog open={delOpen} title={tr('수강후기 삭제', 'Delete review')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} body={<p>{tr('현재 수강후기를 삭제하시겠습니까? (Del=Y 처리, 행은 남습니다)', 'Delete this review? (soft delete, Del=Y)')}</p>} />
    </AdminPage>
  );
}
