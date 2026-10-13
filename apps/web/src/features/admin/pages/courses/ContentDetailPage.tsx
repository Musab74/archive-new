import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AdminContentsDetail } from '../../../../shared/api/schemas';
import { AButton, AdminPage, AInput, Callout, Card, DataTable, DescList, FieldRow, YnBadge, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

type Detail = AdminContentsDetail['details'][number];
const isVideo = (url: string | null | undefined) => !!url && /\.(mp4|webm|m3u8|mov|ogv)(\?|$)/i.test(url);

export default function ContentDetailPage() {
  const { idx = '' } = useParams();
  const n = Number(idx);
  const { canWrite, readOnlyTitle } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'content', n], queryFn: ({ signal }) => adminApi.content(n, signal), enabled: n > 0 });
  const d = q.data;
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [selected, setSelected] = useState<Detail | null>(null);
  useEffect(() => { if (d) { setTitle(d.title ?? ''); setTime(d.lectureTimeMin != null ? String(d.lectureTimeMin) : ''); setSelected(d.details.find((x) => isVideo(x.url) || x.url) ?? null); } }, [d]);
  const save = useAdminMutation({ fn: (body: { ContentsTitle?: string; LectureTime?: number | null }) => adminApi.patchContent(n, body), invalidate: [['admin', 'content', n], ['admin', 'contents']], success: adm.common.saved });
  const dirty = !!d && (title !== (d.title ?? '') || time !== (d.lectureTimeMin != null ? String(d.lectureTimeMin) : ''));
  const e = adm.courses.contents.detail;
  const cols: Column<Detail>[] = [
    { key: 'order', header: '순서', align: 'right' },
    { key: 'seq', header: 'Seq', align: 'right' },
    { key: 'type', header: '유형', align: 'center', render: (r) => r.type ?? '' },
    { key: 'urlSelect', header: 'URL 선택', align: 'center', render: (r) => r.urlSelect ?? '' },
    { key: 'url', header: 'URL', render: (r) => <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{r.url ?? ''}</span> },
    { key: 'mobileUrl', header: '모바일 URL', render: (r) => <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{r.mobileUrl ?? ''}</span> },
    { key: 'pages', header: '페이지', align: 'right', render: (r) => String(r.pages ?? '') },
    { key: 'caption', header: '자막', render: (r) => r.caption ?? '' },
    { key: 'question', header: '문제', render: (r) => (r.question ? <span title={r.answer ?? ''}>{r.question}</span> : '') },
    { key: 'useYN', header: '사용', align: 'center', render: (r) => <YnBadge value={r.useYN} /> },
  ];
  const previewUrl = selected?.url ?? selected?.mobileUrl ?? null;
  return (
    <AdminPage title={`${e.title} · #${idx}${d ? ` ${d.title ?? ''}` : ''}`} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.courses.contents.title, to: '/admin/contents' }, { label: `#${idx}` }]}
      actions={<><AButton to="/admin/contents">{adm.common.back}</AButton><AButton variant="primary" disabled={!canWrite || !dirty} title={readOnlyTitle} loading={save.isPending} onClick={() => { const body: { ContentsTitle?: string; LectureTime?: number | null } = {}; if (d && title !== (d.title ?? '')) body.ContentsTitle = title.trim(); if (d && time !== (d.lectureTimeMin != null ? String(d.lectureTimeMin) : '')) body.LectureTime = time.trim() === '' ? null : Number(time); save.mutate(body); }}>{adm.common.save}</AButton></>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /> : q.isPending || !d ? <Skeleton lines={8} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 420px', gap: 12, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={e.edit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={e.titleField} htmlFor="cd-title" required><AInput id="cd-title" value={title} onChange={(ev) => setTitle(ev.target.value)} maxLength={200} disabled={!canWrite} /></FieldRow>
                <FieldRow label={e.timeField} htmlFor="cd-time" help={e.timeWarn}><AInput id="cd-time" type="number" min={0} max={100000} value={time} onChange={(ev) => setTime(ev.target.value)} style={{ width: 140 }} disabled={!canWrite} /></FieldRow>
              </div>
            </Card>
            <Card title={e.info}><DescList cols={2} items={[['구분', d.gubun], ['크기', d.size?.width || d.size?.height ? `${d.size.width ?? '?'}×${d.size.height ?? '?'}` : null], ['학습목표', d.goal], ['훈련내용', d.trainingContents], ['활동', d.activities], ['등록일', d.regDate], ['삭제', d.deleted ? 'Y' : 'N'], ['', '']]} /></Card>
            <Card title={`${e.details} (${d.details.length})`}><DataTable columns={cols} rows={d.details} rowKey={(r) => r.seq} dense onRowClick={setSelected} selectedKey={selected?.seq} emptyTitle="페이지가 없습니다." emptyBody=" " /></Card>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={e.preview}>
              {previewUrl ? (
                isVideo(previewUrl) ? <video key={previewUrl} src={previewUrl} controls preload="metadata" style={{ width: '100%', background: '#000', borderRadius: 4 }} /> : <Callout>동영상이 아닌 URL입니다. <a href={previewUrl} target="_blank" rel="noopener noreferrer">새 창에서 열기 ↗</a></Callout>
              ) : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{d.details.length ? e.selectRow : e.noVideo}</p>}
              {previewUrl ? <p className="mono muted" style={{ fontSize: 11, marginTop: 8, wordBreak: 'break-all' }}>{previewUrl}</p> : null}
            </Card>
            <Card title={`${e.usedIn} (${d.usedIn.length})`}>
              {d.usedIn.length ? <ul style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>{d.usedIn.map((u) => <li key={`${u.lectureCode}-${u.chapterSeq}`}><Link to={`/admin/courses/${encodeURIComponent(u.lectureCode)}/chapters`}>{u.lectureCode}</Link> <span className="muted">· Seq {u.chapterSeq} · 순서 {u.order}</span></li>)}</ul> : <p className="muted" style={{ fontSize: 13, margin: 0 }}>사용 중인 과정이 없습니다.</p>}
            </Card>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
