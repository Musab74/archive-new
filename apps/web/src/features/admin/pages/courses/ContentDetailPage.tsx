import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpContentDetailRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, Callout, Card, ConfirmDialog, DataTable, DescList, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { Multiline, ReadButtons, listHref } from './courses-parity.shared';
import { PlayerView, type Player } from './courses-parity.player';
import { ContentDetailDrawer, ContentsForm } from './courses-parity.contents';
import { AnyGrantGate, G } from './courses-parity.grants';
import ContentsExcelPage from './ContentsExcelPage';

/** contents_read.php: 목록 keeps pg / sw / col — the list's last query string is restored. */
const listTo = () => listHref('contents', '/admin/contents');
const crumbs = (idx: string) => [{ label: adm.top.home, to: '/admin' }, { label: tr('기초차시 관리', 'Base contents'), to: listTo() }, { label: idx === 'new' ? tr('등록', 'New') : `#${idx}` }];
/** Default player of a row (what clicking its first URL opened on the PHP page). */
export function defaultPlayer(r: CpContentDetailRow): Player | null {
  if (r.type === 'A' && r.url) return { kind: 'flash', sel: 'A', url: r.url };
  if (r.type === 'B' && r.url) return { kind: 'movie', sel: 'A', url: r.url };
  if ((r.type === 'A' || r.type === 'B') && r.mobileUrl) return { kind: 'mobile', sel: 'A', url: r.mobileUrl };
  return null;
}

/**
 * /admin/contents/:idx — contents_read.php (+ 기초차시 상세 구성 with the contents_detail.php popup); ?mode=edit = contents_write.php;
 * /admin/contents/new = 등록. /admin/contents/excel (contents_excel.php) is its own route; when only this :idx route matches it,
 * the excel page is rendered here too instead of a never-ending NaN lookup.
 */
export default function ContentDetailPage() {
  const { idx = '' } = useParams();
  if (idx === 'excel') return <ContentsExcelPage />;
  return <AnyGrantGate grants={G.contents}><ContentDetailBody /></AnyGrantGate>;
}

/** HTTP status of a failed query (403 → 권한 없음, 404 → 없음). */
const statusOf = (e: unknown) => (e as { status?: number } | null)?.status;

function ContentDetailBody() {
  const { idx = '' } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useSearchState({ mode: '' });
  const isNew = idx === 'new';
  const n = Number(idx);
  const { canWrite } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'content', n], queryFn: ({ signal }) => cp.content(n, signal), enabled: !isNew && n > 0 });
  const d = q.data;
  const meta = useQuery({ queryKey: ['admin', 'contents', 'meta'], queryFn: ({ signal }) => cp.contentsMeta(signal), staleTime: 10 * 60_000, enabled: !isNew });
  const [selected, setSelected] = useState<CpContentDetailRow | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  useEffect(() => { if (d) { const r = d.details.find((x) => defaultPlayer(x)) ?? d.details[0] ?? null; setSelected(r); setPlayer(r ? defaultPlayer(r) : null); } }, [d]);
  const pick = (r: CpContentDetailRow, p: Player | null) => { setSelected(r); setPlayer(p); };
  const [drawer, setDrawer] = useState<{ row: CpContentDetailRow | null } | null>(null);
  const [delRow, setDelRow] = useState<CpContentDetailRow | null>(null);
  const [delContent, setDelContent] = useState(false);
  const removeRow = useAdminMutation({ fn: (seq: number) => cp.deleteDetail(n, seq), invalidate: [['admin', 'content', n], ['admin', 'contents']], success: adm.common.deleted, onSuccess: () => setDelRow(null) });
  const removeContent = useAdminMutation({ fn: () => cp.deleteContent(n), invalidate: [['admin', 'contents']], success: tr('처리되었습니다.', 'Done.'), onSuccess: () => navigate(listTo()) });

  if (isNew) {
    return <AdminPage title={tr('기초차시 관리 등록', 'New base content')} crumbs={crumbs(idx)}><ContentsForm onDone={(id) => navigate(`/admin/contents/${id}`)} onCancel={() => navigate(listTo())} /></AdminPage>;
  }
  const link = (r: CpContentDetailRow, p: Player, text: string) => <a href="#play" onClick={(e) => { e.preventDefault(); e.stopPropagation(); pick(r, p); }}>{text}</a>;
  const cols: Column<CpContentDetailRow>[] = [
    { key: 'order', header: <>{tr('정렬', 'Sort')}<br />{tr('번호', 'no.')}</>, align: 'center', width: 50 },
    { key: 'typeLabel', header: tr('컨텐츠 유형', 'Type'), align: 'center', render: (r) => `${r.typeLabel}${r.type === 'B' ? r.urlSelectLabel : ''}` },
    { key: 'teacherName', header: tr('강사명', 'Instructor'), align: 'center', render: (r) => r.teacherName ?? '' },
    { key: 'pages', header: <>{tr('차시', 'Chapter')}<br />{tr('페이지', 'pages')}</>, align: 'center', render: (r) => r.pages ?? '' },
    { key: 'mobilePages', header: <>{tr('모바일', 'Mobile')}<br />{tr('페이지', 'pages')}</>, align: 'center', render: (r) => r.mobilePages ?? '' },
    { key: 'url', header: tr('컨텐츠 URL', 'Content URL'), render: (r) => <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{r.type === 'B' ? <>{r.url ? link(r, { kind: 'movie', sel: 'A', url: r.url }, `(주) ${r.url}`) : ''}{r.url2 ? <><br />{link(r, { kind: 'movie', sel: 'B', url: r.url2 }, `(예비) ${r.url2}`)}</> : null}</> : r.type === 'A' && r.url ? link(r, { kind: 'flash', sel: 'A', url: r.url }, r.url) : ''}</span> },
    { key: 'mobileUrl', header: tr('모바일 URL', 'Mobile URL'), render: (r) => <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{r.type === 'B' ? <>{r.mobileUrl ? link(r, { kind: 'mobile', sel: 'A', url: r.mobileUrl }, `(주) ${r.mobileUrl}`) : ''}{r.mobileUrl2 ? <><br />{link(r, { kind: 'mobile', sel: 'B', url: r.mobileUrl2 }, `(예비) ${r.mobileUrl2}`)}</> : null}</> : r.type === 'A' && r.mobileUrl ? link(r, { kind: 'mobile', sel: 'A', url: r.mobileUrl }, r.mobileUrl) : ''}</span> },
    { key: 'question', header: tr('문제풀이 질문', 'Question'), width: 200, render: (r) => (r.question ? `${r.question.slice(0, 30)}${r.question.length > 30 ? '…' : ''}` : '') },
    { key: 'useLabel', header: <>{tr('사용', 'In')}<br />{tr('유무', 'use')}</>, align: 'center', render: (r) => r.useLabel },
    { key: 'edit', header: tr('수정', 'Edit'), align: 'center', render: (r) => <AButton size="xs" disabled={!canWrite} onClick={(e) => { e.stopPropagation(); setDrawer({ row: r }); }}>{tr('수정', 'Edit')}</AButton> },
    { key: 'del', header: tr('삭제', 'Delete'), align: 'center', render: (r) => <AButton size="xs" variant="danger" disabled={!canWrite} onClick={(e) => { e.stopPropagation(); setDelRow(r); }}>{tr('삭제', 'Delete')}</AButton> },
  ];
  return (
    <AdminPage title={`${tr('기초차시 관리', 'Base contents')}${p.mode === 'edit' ? ` ${tr('수정', 'edit')}` : ''} · #${idx}${d ? ` ${d.title ?? ''}` : ''}`} crumbs={crumbs(idx)} actions={<AButton to={listTo()}>{adm.common.back}</AButton>}>
      {q.isError ? <StateBlock code={statusOf(q.error) === 404 ? 'NOT_FOUND' : statusOf(q.error) === 403 ? 'NO_ACCESS' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d ? <Skeleton lines={8} /> : d.deleted ? (
        // contents_read.php loads Contents WHERE idx AND Del='N': a deleted 기초차시 shows nothing (no edit / 상세 구성 / 삭제).
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Callout tone="warn">{tr(`삭제된(Del=Y) 기초차시입니다 (#${d.idx}). 기존 사이트와 같이 상세 정보와 수정·삭제는 제공하지 않습니다.`, `This base content is deleted (Del=Y, #${d.idx}); like the previous site, no detail or edit is offered.`)}</Callout>
          <div><AButton to={listTo()}>{tr('목록', 'List')}</AButton></div>
        </div>
      ) : p.mode === 'edit' ? (
        <ContentsForm detail={d} onDone={() => setP({ mode: '' })} onCancel={() => navigate(listTo())} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title={tr('기초차시 정보', 'Base content')}>
            <DescList items={[[tr('차시 구분', '차시 구분'), d.gubun], [tr('차시명', 'Title'), d.title], [tr('수강시간', 'Minutes'), tr(`${d.lectureTimeMin ?? ''}분`, `${d.lectureTimeMin ?? ''} min`)], [tr('차시 목표', 'Goals'), <Multiline text={d.goal} />], [tr('훈련 내용', 'Training content'), <Multiline text={d.trainingContents} />], [tr('학습 활동', 'Activities'), <Multiline text={d.activities} />]]} />
          </Card>
          <ReadButtons left={canWrite ? <AButton variant="danger" onClick={() => setDelContent(true)}>{tr('기초차시 삭제', 'Delete')}</AButton> : null} center={canWrite ? <AButton variant="primary" onClick={() => setP({ mode: 'edit' })}>{tr('기초차시 수정', 'Edit')}</AButton> : null} right={<AButton to={listTo()}>{tr('목록', 'List')}</AButton>} />
          <Card title={`${tr('기초차시 상세 구성', 'Page composition')} (${d.details.length})`} aside={<AButton size="sm" disabled={!canWrite} onClick={() => setDrawer({ row: null })}>{tr('추가 하기', 'Add')}</AButton>}>
            <DataTable columns={cols} rows={d.details} rowKey={(r) => r.seq} dense onRowClick={(r) => pick(r, defaultPlayer(r))} selectedKey={selected?.seq} emptyTitle={tr('상세 구성 내역이 없습니다.', 'No pages.')} emptyBody=" " />
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, alignItems: 'start' }}>
            <Card title={tr('미리보기 (선택한 URL)', 'Preview (selected URL)')}>
              {player ? <PlayerView player={player} servers={meta.data?.servers} /> : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{tr('컨텐츠 URL / 모바일 URL을 누르면 재생됩니다.', 'Click a content or mobile URL to play it.')}</p>}
            </Card>
            <Card title={`${tr('사용 중인 과정', 'Used in courses')} (${d.usedIn.length})`}>
              {d.usedIn.length ? <ul style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>{d.usedIn.map((u) => <li key={`${u.lectureCode}-${u.chapterSeq}`}><Link to={`/admin/courses/${encodeURIComponent(u.lectureCode)}/chapters`}>{u.lectureCode}</Link> <span className="muted">· Seq {u.chapterSeq} · {tr('순서', 'Order')} {u.order}</span></li>)}</ul> : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{tr('사용 중인 과정이 없습니다.', 'Not used in any course.')}</p>}
            </Card>
          </div>
          {drawer ? <ContentDetailDrawer contentsIdx={d.idx} row={drawer.row} nextOrder={d.nextDetailOrder} onClose={() => setDrawer(null)} /> : null}
          <ConfirmDialog open={!!delRow} tone="danger" title={tr('상세 구성 삭제', 'Delete page')} body={<p>{tr('클릭한 상세 구성을 삭제하시겠습니까? (행이 삭제됩니다)', 'Delete this page row?')}</p>} loading={removeRow.isPending} onCancel={() => setDelRow(null)} onConfirm={() => delRow && removeRow.mutate(delRow.seq)} />
          <ConfirmDialog open={delContent} tone="danger" title={tr('기초차시 삭제', 'Delete base content')} body={<p>{tr('현재 기초차시를 삭제하시겠습니까? (Del=Y)', 'Delete this base content? (Del=Y)')}</p>} loading={removeContent.isPending} onCancel={() => setDelContent(false)} onConfirm={() => removeContent.mutate()} />
        </div>
      )}
    </AdminPage>
  );
}
