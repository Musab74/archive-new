import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import type { PopupRow } from '../../../../shared/api/endpoints/admin-site-cms';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, YnBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { rowNumber, validatePopupForm, ymd8ToIso } from './siteCms.helpers';

const DEFAULTS = { page: 1 };
const SIZE = 25; // popup.php $page_size = 25
interface Form { UseYN: 'Y' | 'N'; EndDate: string; Title: string; ImgWidth: string; ImgHeight: string; PopupLeft: string; PopupTop: string; ImgWidthMobile: string; ImgHeightMobile: string; PopupLeftMobile: string; PopupTopMobile: string }
const EMPTY: Form = { UseYN: 'Y', EndDate: '', Title: '', ImgWidth: '', ImgHeight: '', PopupLeft: '', PopupTop: '', ImgWidthMobile: '', ImgHeightMobile: '', PopupLeftMobile: '', PopupTopMobile: '' };
const fromRow = (r: PopupRow): Form => ({ UseYN: r.useYN === 'N' ? 'N' : 'Y', EndDate: r.endDate ?? '', Title: r.title ?? '', ImgWidth: r.imgWidth ?? '', ImgHeight: r.imgHeight ?? '', PopupLeft: r.popupLeft ?? '', PopupTop: r.popupTop ?? '', ImgWidthMobile: r.mobile.imgWidth, ImgHeightMobile: r.mobile.imgHeight, PopupLeftMobile: r.mobile.popupLeft, PopupTopMobile: r.mobile.popupTop });

/** Authenticated preview image (the API streams the file from upload/upload_popup). */
function PopupImage({ idx, kind, width, exactWidth, alt }: { idx: number; kind: 'pc' | 'mobile'; width?: number; /** popup.php PreviewSend(): popupimg.width = ImgWidth */ exactWidth?: number; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let active = true; let obj: string | null = null; setUrl(null); setErr(false);
    adminSiteCmsApi.popupImageUrl(idx, kind).then((u) => { if (active) { obj = u; setUrl(u); } else URL.revokeObjectURL(u); }).catch(() => { if (active) setErr(true); });
    return () => { active = false; if (obj) URL.revokeObjectURL(obj); };
  }, [idx, kind]);
  if (err) return <span className="muted">{tr('이미지 없음', 'No image')}</span>;
  if (!url) return <span className="muted">{adm.common.loading}</span>;
  if (exactWidth && exactWidth > 0) return <img src={url} alt={alt} width={exactWidth} style={{ width: exactWidth, maxWidth: 'none', height: 'auto', display: 'block' }} />;
  return <img src={url} alt={alt} style={{ maxWidth: width ?? '100%', height: 'auto', border: '1px solid var(--c-line, #ddd)' }} />;
}

/** popup.php / popup_r.php / popup_reg.php / popup_reg_script.php / popup_link.php — 사이트관리 > 팝업 관리 (G2). */
export default function PopupsPage() {
  const [p, setP] = useSearchState(DEFAULTS);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'popups', query], queryFn: ({ signal }) => adminSiteCmsApi.popups(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const uploadOk = list.data?.uploadEnabled ?? true;
  const [sel, setSel] = useState<PopupRow | null>(null);
  const [preview, setPreview] = useState<PopupRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'popup', sel?.idx], queryFn: ({ signal }) => adminSiteCmsApi.popup(sel!.idx, signal), enabled: !!sel });
  const [editOpen, setEditOpen] = useState<'create' | 'edit' | null>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [pcFile, setPcFile] = useState<File | null>(null);
  const [mFile, setMFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [link, setLink] = useState({ ImgArea: '', LinkURL: '' });
  useEffect(() => { if (editOpen === 'create') setF(EMPTY); if (editOpen === 'edit' && detail.data) setF(fromRow(detail.data.popup)); setPcFile(null); setMFile(null); setErrors({}); }, [editOpen, detail.data]);
  const inv = [['admin', 'popups'], ['admin', 'popup']];

  const uploadImages = async (idx: number) => {
    for (const [kind, file] of [['pc', pcFile], ['mobile', mFile]] as const) {
      if (!file) continue;
      try { await adminSiteCmsApi.uploadPopupImage(idx, kind, file); } catch (e) { toast(`${kind === 'pc' ? tr('PC 이미지', 'PC image') : tr('모바일 이미지', 'Mobile image')}: ${isAppError(e) ? e.message : adm.common.failed}`, { tone: 'danger' }); }
    }
    if (pcFile || mFile) for (const k of inv) void qc.invalidateQueries({ queryKey: k });
  };
  const body = () => ({ UseYN: f.UseYN, EndDate: f.EndDate.trim(), Title: f.Title.trim(), ImgWidth: f.ImgWidth.trim(), ImgHeight: f.ImgHeight.trim(), PopupLeft: f.PopupLeft.trim(), PopupTop: f.PopupTop.trim(), ImgWidthMobile: f.ImgWidthMobile.trim(), ImgHeightMobile: f.ImgHeightMobile.trim(), PopupLeftMobile: f.PopupLeftMobile.trim(), PopupTopMobile: f.PopupTopMobile.trim() });
  const create = useAdminMutation({ fn: async () => { const r = await adminSiteCmsApi.createPopup(body()); await uploadImages(r.idx); return r; }, invalidate: inv, success: adm.common.created, onSuccess: () => setEditOpen(null) });
  const patch = useAdminMutation({ fn: async () => { const r = await adminSiteCmsApi.patchPopup(sel!.idx, body()); await uploadImages(sel!.idx); return r; }, invalidate: inv, success: adm.common.saved, onSuccess: () => setEditOpen(null) });
  const [delTarget, setDelTarget] = useState<PopupRow | null>(null);
  const del = useAdminMutation({ fn: (idx: number) => adminSiteCmsApi.deletePopup(idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDelTarget(null); setSel(null); } });
  const addLink = useAdminMutation({ fn: () => adminSiteCmsApi.addPopupLink(sel!.idx, { ImgArea: link.ImgArea.trim(), LinkURL: link.LinkURL.trim() }), invalidate: [['admin', 'popup']], success: adm.common.created, onSuccess: () => setLink({ ImgArea: '', LinkURL: '' }) });
  const delLink = useAdminMutation({ fn: (num: number) => adminSiteCmsApi.deletePopupLink(sel!.idx, num), invalidate: [['admin', 'popup']], success: adm.common.deleted });
  const submit = () => { const e = validatePopupForm(f); setErrors(e); if (Object.keys(e).length) return; if (editOpen === 'create') create.mutate(undefined as never); else patch.mutate(undefined as never); };

  const columns: Column<PopupRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => rowNumber(total, p.page, SIZE, i) },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title ?? ''}</b> },
    { key: 'size', header: tr('이미지 사이즈', 'Image size'), nowrap: true, render: (r) => `${r.imgWidth ?? ''}(W) X ${r.imgHeight ?? ''}(H)` },
    { key: 'pos', header: tr('팝업 위치', 'Position'), nowrap: true, render: (r) => `${tr('좌측', 'left')}:${r.popupLeft ?? ''}, ${tr('상단', 'top')}:${r.popupTop ?? ''}` },
    { key: 'endDate', header: tr('마감일', 'Ends'), nowrap: true, render: (r) => <span title={ymd8ToIso(r.endDate)}>{r.endDate ?? ''}</span> },
    { key: 'useYN', header: tr('사용여부', 'Active'), align: 'center', render: (r) => <YnBadge value={r.useYN} yes="Y" no="N" /> },
    { key: 'regDay', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDay ?? '' },
    { key: 'preview', header: tr('미리보기', 'Preview'), align: 'center', render: (r) => <AButton size="xs" onClick={(e) => { e.stopPropagation(); setPreview(r); }} disabled={!r.imgName}>{tr('보기', 'View')}</AButton> },
    { key: 'del', header: tr('삭제', 'Delete'), align: 'center', render: (r) => <AButton size="xs" variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={(e) => { e.stopPropagation(); setDelTarget(r); }}>{tr('삭제', 'Delete')}</AButton> },
  ];
  const d = detail.data;
  const num = (k: keyof Form, id: string, w = 90) => <AInput id={id} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/\D/g, '').slice(0, 4) })} maxLength={4} inputMode="numeric" style={{ width: w }} invalid={!!errors[k]} aria-label={id} />;
  return (
    <AdminPage title={tr('팝업 관리', 'Pop-ups')} lead={tr('홈페이지 팝업을 등록·수정·삭제하고 이미지맵 링크를 관리합니다.', 'Create, edit and delete homepage pop-ups and their image-map links.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setEditOpen('create'); }}>{tr('팝업 등록', 'New pop-up')}</AButton>}>
      {list.data && !list.data.uploadEnabled ? <Callout tone="warn">{tr('팝업 이미지 저장 폴더(upload/upload_popup)가 이 서버에 연결되어 있지 않습니다. 제목·크기·위치·마감일은 여기서 수정할 수 있지만 이미지는 기존 관리자 페이지에서 올려주세요.', 'The pop-up image folder (upload/upload_popup) is not available on this server. Edit text here; upload images on the legacy admin page.')}</Callout> : null}
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 글이 없습니다.', 'No pop-ups.')} dense />

      {/* popup_r.php: 팝업 상세 정보 + 링크 걸기 */}
      <DetailDrawer open={!!sel && !editOpen} onClose={() => setSel(null)} title={sel?.title ?? ''} subtitle={sel ? `#${sel.idx}` : ''} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={() => setDelTarget(sel)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEditOpen('edit')}>{tr('수 정', 'Edit')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={tr('팝업 상세 정보', 'Pop-up details')}>
              <DescList cols={2} items={[[tr('제목', 'Title'), d.popup.title], [tr('위치', 'Position'), `${tr('좌측', 'left')}:${d.popup.popupLeft ?? ''}, ${tr('상단', 'top')}:${d.popup.popupTop ?? ''}`], [tr('크기', 'Size'), `${d.popup.imgWidth ?? ''} X ${d.popup.imgHeight ?? ''}`], [tr('마감일', 'Ends'), ymd8ToIso(d.popup.endDate)], [tr('사용여부', 'Active'), d.popup.useYN], [tr('등록일', 'Registered'), d.popup.regDate], [tr('이미지 파일', 'Image file'), d.popup.imgName], [tr('모바일', 'Mobile'), d.popup.mobile.imgWidth || d.popup.mobile.imgName ? `${d.popup.mobile.imgWidth || '-'} X ${d.popup.mobile.imgHeight || '-'} / ${tr('좌측', 'left')}:${d.popup.mobile.popupLeft || '-'}, ${tr('상단', 'top')}:${d.popup.mobile.popupTop || '-'} ${d.popup.mobile.imgName ? `(${d.popup.mobile.imgName})` : ''}` : null]]} />
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                {d.popup.imgName ? <div><div className="muted" style={{ marginBottom: 4 }}>PC</div><PopupImage idx={d.popup.idx} kind="pc" width={320} alt={d.popup.title ?? 'popup'} /></div> : null}
                {d.popup.mobile.imgName ? <div><div className="muted" style={{ marginBottom: 4 }}>{tr('모바일', 'Mobile')}</div><PopupImage idx={d.popup.idx} kind="mobile" width={200} alt={d.popup.title ?? 'popup'} /></div> : null}
              </div>
            </Card>
            <Card title={tr('링크 걸기', 'Image-map links')} aside={<span className="muted" style={{ color: 'var(--c-danger)' }}>{tr('전체 영역에 링크를 걸려면 이미지맵 영역은 빈칸으로 함', 'Leave the area empty to link the whole image')}</span>}>
              <DataTable columns={[{ key: 'no', header: tr('번호', 'No.'), width: 50, align: 'right', render: (_r, i) => i + 1 }, { key: 'imgArea', header: tr('이미지맵 영역', 'Map area'), render: (r) => <span className="mono">{r.imgArea ?? ''}</span> }, { key: 'linkUrl', header: tr('링크', 'Link'), render: (r) => <a href={r.linkUrl ?? '#'} target="_blank" rel="noreferrer">{r.linkUrl}</a> }, { key: 'del', header: tr('삭제', 'Delete'), align: 'center', width: 70, render: (r) => <AButton size="xs" variant="danger" disabled={!canWrite} loading={delLink.isPending} onClick={() => { if (window.confirm(tr('링크를 삭제합니까?', 'Delete this link?'))) delLink.mutate(r.num); }}>{tr('삭제', 'Delete')}</AButton> }]} rows={d.links} rowKey={(r) => r.num} emptyTitle={tr('등록된 링크가 없습니다.', 'No links.')} dense />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, marginTop: 10, alignItems: 'end' }}>
                <FieldRow label={tr('이미지맵 영역', 'Map area')} htmlFor="pl-area"><AInput id="pl-area" value={link.ImgArea} onChange={(e) => setLink({ ...link, ImgArea: e.target.value })} maxLength={50} placeholder="0,0,100,100" /></FieldRow>
                <FieldRow label={tr('링크 URL', 'Link URL')} htmlFor="pl-url"><AInput id="pl-url" value={link.LinkURL} onChange={(e) => setLink({ ...link, LinkURL: e.target.value })} maxLength={100} placeholder="https://" /></FieldRow>
                <AButton variant="primary" disabled={!canWrite || !link.LinkURL.trim()} loading={addLink.isPending} onClick={() => { if (window.confirm(tr('등록합니까?', 'Add this link?'))) addLink.mutate(undefined as never); }}>{tr('등록 하기', 'Add')}</AButton>
              </div>
            </Card>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      {/* popup_reg.php */}
      <DetailDrawer open={!!editOpen} onClose={() => setEditOpen(null)} title={editOpen === 'create' ? tr('팝업 관리 등록', 'New pop-up') : tr('팝업 관리 수정', 'Edit pop-up')} wide
        footer={<><AButton onClick={() => setEditOpen(null)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{editOpen === 'create' ? tr('등록', 'Create') : tr('수정', 'Save')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('사용 여부', 'Active')}><ASelect aria-label={tr('사용 여부', 'Active')} value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value as 'Y' | 'N' })} options={[{ value: 'Y', label: tr('사용', 'Yes') }, { value: 'N', label: tr('미사용', 'No') }]} /></FieldRow>
          <FieldRow label={tr('마감일', 'End date')} htmlFor="pf-end" required error={errors.EndDate} help={tr('예) 20100510 숫자 8자리로 입력', 'e.g. 20100510 (8 digits)')}><AInput id="pf-end" value={f.EndDate} onChange={(e) => setF({ ...f, EndDate: e.target.value.replace(/\D/g, '').slice(0, 8) })} maxLength={8} inputMode="numeric" style={{ width: 140 }} invalid={!!errors.EndDate} /></FieldRow>
          <FieldRow label={tr('제 목', 'Title')} htmlFor="pf-title" required error={errors.Title}><AInput id="pf-title" value={f.Title} onChange={(e) => setF({ ...f, Title: e.target.value })} maxLength={100} /></FieldRow>
          <FieldRow label={tr('크기', 'Size')} required error={errors.ImgWidth || errors.ImgHeight} help={tr('이미지 사이즈를 등록', 'Image size in px')}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{num('ImgWidth', 'pf-w')}(W) X {num('ImgHeight', 'pf-h')}(H)</div></FieldRow>
          <FieldRow label={tr('위치', 'Position')} required error={errors.PopupLeft || errors.PopupTop} help={tr('팝업위치를 등록하세요. 좌측:200, 상단:50', 'e.g. left 200, top 50')}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{tr('좌측', 'left')} : {num('PopupLeft', 'pf-l')} {tr('상단', 'top')} : {num('PopupTop', 'pf-t')}</div></FieldRow>
          <FieldRow label={tr('첨부파일 (PC용)', 'Image (PC)')} htmlFor="pf-file" help={editOpen === 'edit' && d?.popup.imgName ? `${tr('현재', 'Current')}: ${d.popup.imgName}` : undefined}><input id="pf-file" type="file" accept="image/*" disabled={!uploadOk || !canWrite} onChange={(e) => setPcFile(e.target.files?.[0] ?? null)} /></FieldRow>
          <FieldRow label={tr('크기 (모바일용)', 'Size (mobile)')} error={errors.ImgWidthMobile || errors.ImgHeightMobile} help={tr('모바일 최대 너비. 높이는 이미지 비율을 따릅니다', 'Max mobile width; height follows the image ratio')}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{num('ImgWidthMobile', 'pf-mw')}(W) X {num('ImgHeightMobile', 'pf-mh')}(H)</div></FieldRow>
          <FieldRow label={tr('위치 (모바일용)', 'Position (mobile)')} error={errors.PopupLeftMobile || errors.PopupTopMobile} help={tr('모바일 팝업위치를 등록하세요. 좌측:50, 상단:50', 'e.g. left 50, top 50')}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{tr('좌측', 'left')} : {num('PopupLeftMobile', 'pf-ml')} {tr('상단', 'top')} : {num('PopupTopMobile', 'pf-mt')}</div></FieldRow>
          <FieldRow label={tr('첨부파일 (모바일용)', 'Image (mobile)')} htmlFor="pf-mfile" help={editOpen === 'edit' && d?.popup.mobile.imgName ? `${tr('현재', 'Current')}: ${d.popup.mobile.imgName}` : undefined}><input id="pf-mfile" type="file" accept="image/*" disabled={!uploadOk || !canWrite} onChange={(e) => setMFile(e.target.files?.[0] ?? null)} /></FieldRow>
        </div>
      </DetailDrawer>

      {/* popup.php PreviewSend(): the image at the row's ImgWidth with the site's "오늘 하루 창 열지 않기 / 닫기" bar */}
      <DetailDrawer open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} subtitle={preview ? `${preview.imgWidth}(W) X ${preview.imgHeight}(H)` : ''} wide>
        {preview ? (
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <div data-testid="popup-preview" style={{ display: 'inline-block', border: '1px solid var(--c-line-2, #ccc)', boxShadow: 'var(--shadow-xs, 0 1px 3px rgba(0,0,0,.15))', background: '#fff' }}>
              <PopupImage idx={preview.idx} kind="pc" exactWidth={Number(preview.imgWidth) || undefined} alt={preview.title ?? 'popup'} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '6px 10px', background: '#222', color: '#fff', fontSize: 12 }}>
                <span>{tr('오늘 하루 창 열지 않기', "Don't show again today")}</span>
                <button type="button" onClick={() => setPreview(null)} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer', fontSize: 12 }}>{tr('닫기', 'Close')}</button>
              </div>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
      <ConfirmDialog open={!!delTarget} title={tr('팝업 삭제', 'Delete pop-up')} tone="danger" loading={del.isPending} onCancel={() => setDelTarget(null)} onConfirm={() => delTarget && del.mutate(delTarget.idx)} body={<p>{tr('선택한 팝업을 삭제하시겠습니까? 삭제된 내용은 복구되지 않습니다.', 'Delete this pop-up? This cannot be undone.')} <b>{delTarget?.title}</b></p>} />
    </AdminPage>
  );
}
