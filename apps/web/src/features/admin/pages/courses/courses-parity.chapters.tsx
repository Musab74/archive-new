import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpChapterRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { AButton, ACheckbox, AInput, ASelect, Callout, Card, ConfirmDialog, DataTable, DetailDrawer, FieldRow, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { MoveButtons, moveIn, useFormErrors } from './courses-parity.shared';

/**
 * 차시 구성 — course_read_list.php (list, ▲▼ + 정렬 하기, 수정/삭제) with the chapter_regist.php popup
 * (차시구분 → 기초 차시, 정렬 순서, "선택한 [차시 구분] 모두 등록하기").
 */
export function ChapterSection({ lectureCode, contentsName, chapterCount }: { lectureCode: string; contentsName?: string | null; chapterCount?: string | null }) {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const key = ['admin', 'chapters', lectureCode];
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => cp.chapters(lectureCode, signal), enabled: !!lectureCode });
  const [order, setOrder] = useState<CpChapterRow[] | null>(null);
  useEffect(() => { setOrder(null); }, [q.data]);
  const rows = order ?? q.data ?? [];
  const inv = [key, ['admin', 'course'], ['admin', 'courses']];
  const reorder = useAdminMutation({ fn: (seqs: number[]) => cp.orderChapters(lectureCode, seqs), invalidate: inv, success: tr('정렬 처리되었습니다.', 'Order saved.') });
  const [edit, setEdit] = useState<{ mode: 'new' } | { mode: 'edit'; row: CpChapterRow } | null>(null);
  const [del, setDel] = useState<CpChapterRow | null>(null);
  const remove = useAdminMutation({ fn: (seq: number) => cp.deleteChapter(lectureCode, seq), invalidate: inv, success: adm.common.deleted, onSuccess: () => setDel(null) });
  const lectureRows = (q.data ?? []).filter((r) => r.chapterType === 'A').length;
  const mismatch = chapterCount !== undefined && chapterCount !== null && String(chapterCount) !== String(lectureRows);
  const nextOrder = (q.data ?? []).reduce((m, r) => Math.max(m, r.order), 0) + 1;

  const columns: Column<CpChapterRow>[] = [
    { key: 'order', header: tr('차시 순서', 'Order'), align: 'center', width: 70 },
    { key: 'move', header: tr('순서 조정', 'Move'), align: 'center', width: 90, render: (_r, i) => <MoveButtons index={i} length={rows.length} disabled={!canWrite} onMove={(d) => setOrder(moveIn(rows, i, d))} /> },
    { key: 'typeLabel', header: tr('차시 유형', 'Type'), align: 'center', width: 100, render: (r) => r.typeLabel },
    { key: 'listTitle', header: tr('차시명 / 질문', 'Title / question'), render: (r) => (r.contentsIdx ? <Link to={`/admin/contents/${r.contentsIdx}`}>{r.listTitle ?? r.title ?? ''}</Link> : <span className="muted">{r.listTitle ?? String(r.subIdx ?? '')}</span>) },
    { key: 'subCount', header: tr('하부 컨텐츠수 / 문항수', 'Pages / items'), align: 'center', width: 150, render: (r) => <>{r.subCount ?? ''}{r.deleted ? <> <StatusBadge tone="danger">{tr('삭제된 기초차시', 'Deleted content')}</StatusBadge></> : null}</> },
    { key: 'edit', header: tr('수정', 'Edit'), align: 'center', width: 60, render: (r) => <AButton size="xs" disabled={!canWrite || r.chapterType !== 'A'} onClick={() => setEdit({ mode: 'edit', row: r })}>{tr('수정', 'Edit')}</AButton> },
    { key: 'del', header: tr('삭제', 'Delete'), align: 'center', width: 60, render: (r) => <AButton size="xs" variant="danger" disabled={!canWrite} onClick={() => setDel(r)}>{tr('삭제', 'Delete')}</AButton> },
  ];
  return (
    <Card title={tr('차시 구성', 'Chapters')} aside={<span style={{ display: 'inline-flex', gap: 6 }}>
      <AButton size="sm" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEdit({ mode: 'new' })}>{tr('추가 하기', 'Add')}</AButton>
      <AButton size="sm" variant="primary" disabled={!canWrite || !order} loading={reorder.isPending} onClick={() => { if (rows.length < 2) return; if (window.confirm(tr('차시 구성을 정렬하시겠습니까?', 'Save this order?'))) reorder.mutate(rows.map((r) => r.chapterSeq)); }}>{tr('정렬 하기', 'Save order')}</AButton>
    </span>}>
      {mismatch ? <Callout tone="warn">{tr('☆ 차시수 오류 : 차시구성에 등록된 차시수가 강의정보와 일치하지 않습니다.', '☆ Chapter count mismatch: the chapters registered here do not match the course information.')} ({tr('강의정보', 'course')} {chapterCount} / {tr('차시구성', 'chapters')} {lectureRows})</Callout> : null}
      <DataTable columns={columns} rows={q.isPending ? undefined : rows} rowKey={(r) => r.chapterSeq} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={tr('차시 구성 내역이 없습니다.', 'No chapters.')} emptyBody=" " />
      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{tr('▲▼로 순서를 바꾼 뒤 "정렬 하기"를 누르면 차시 순서가 1부터 다시 매겨집니다. "엑셀로 등록"(chapter_write_excel)은 기존 사이트에서 진행합니다.', 'Move rows with ▲▼ then "Save order" to renumber from 1. "Register from Excel" still runs on the previous site.')}</p>
      {edit ? <ChapterDrawer lectureCode={lectureCode} contentsName={contentsName} edit={edit} nextOrder={nextOrder} onClose={() => setEdit(null)} invalidate={inv} /> : null}
      <ConfirmDialog open={!!del} tone="danger" title={tr('차시 구성 삭제', 'Delete chapter')} body={<p>{tr('클릭한 차시 구성을 삭제하시겠습니까? (Chapter 행이 삭제됩니다)', 'Delete this chapter row?')} <b>{del?.listTitle ?? ''}</b></p>} loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.chapterSeq)} />
    </Card>
  );
}

function ChapterDrawer({ lectureCode, contentsName, edit, nextOrder, onClose, invalidate }: { lectureCode: string; contentsName?: string | null; edit: { mode: 'new' } | { mode: 'edit'; row: CpChapterRow }; nextOrder: number; onClose: () => void; invalidate: (string | number)[][] }) {
  const { canWrite } = useWriteGate();
  const { errors, setErrors, onError } = useFormErrors();
  const [only, setOnly] = useState(edit.mode === 'new');
  const [gubun, setGubun] = useState(edit.mode === 'edit' ? edit.row.gubun ?? '' : '');
  const [content, setContent] = useState(edit.mode === 'edit' && edit.row.contentsIdx ? String(edit.row.contentsIdx) : '');
  const [orderNum, setOrderNum] = useState(String(edit.mode === 'edit' ? edit.row.order : nextOrder));
  const opts = useQuery({ queryKey: ['admin', 'contents-options', only ? contentsName ?? '' : '', gubun], queryFn: ({ signal }) => cp.contentsOptions({ only: only && contentsName ? contentsName : undefined, gubun: gubun || undefined }, signal) });
  const gubunOptions = useMemo(() => (opts.data?.gubuns ?? []).map((g) => ({ value: g, label: g })), [opts.data]);
  const save = useAdminMutation({
    fn: (b: { ContentIdx: number; OrderByNum: number }) => (edit.mode === 'new' ? cp.createChapter(lectureCode, b) : cp.patchChapter(lectureCode, edit.row.chapterSeq, b)),
    invalidate, success: tr('처리되었습니다.', 'Saved.'), onSuccess: onClose, onError,
  });
  const batch = useAdminMutation({ fn: (g: string) => cp.batchChapters(lectureCode, g), invalidate, success: tr('등록 되었습니다.', 'Registered.'), onSuccess: onClose, onError });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!content) e.ContentIdx = tr('기초 차시를 선택하세요.', 'Choose a base content.');
    if (orderNum.trim() === '') e.OrderByNum = tr('정렬순서를 입력하세요.', 'Enter the order.');
    else if (!/^\d+$/.test(orderNum.trim())) e.OrderByNum = tr('정렬순서를 숫자만 입력하세요.', 'Digits only.');
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate({ ContentIdx: Number(content), OrderByNum: Number(orderNum) });
  };
  const runBatch = () => {
    if (!gubun) { setErrors({ Gubun: tr('차시 구분을 선택하세요.', 'Choose a 차시 구분.') }); return; }
    const n = opts.data?.contents.length ?? 0;
    if (n < 1) { setErrors({ Gubun: tr('선택한 차시구분에 등록된 기초차시가 없습니다.', 'No base contents in this 차시 구분.') }); return; }
    if (window.confirm(tr(`선택한 차시구분에 등록된 ${n}개의 기초차시를\n\n모두 등록하시겠습니까?`, `Register all ${n} base contents of this 차시 구분?`))) batch.mutate(gubun);
  };
  return (
    <DetailDrawer open onClose={onClose} title={tr('차시 구성', 'Chapter')} subtitle={`${lectureCode}${contentsName ? ` · ${contentsName}` : ''}`} wide
      footer={<><AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" disabled={!canWrite} loading={save.isPending} onClick={submit}>{tr('등록 하기', 'Save')}</AButton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldRow label={tr('차시 유형', 'Type')}><div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 6 }}><b>{tr('강의차시', 'Lecture')}</b><ACheckbox label={tr('현재 강의와 일치하는 차시구분만 보기', 'Only the 차시 구분 matching this course name')} checked={only} onChange={(e) => { setOnly(e.target.checked); setGubun(''); setContent(''); }} /></div></FieldRow>
        <FieldRow label={tr('차시 구분 선택', '차시 구분')} htmlFor="ch-gubun" error={errors.Gubun}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><ASelect id="ch-gubun" value={gubun} onChange={(e) => { setGubun(e.target.value); setContent(''); }} options={[{ value: '', label: tr('-- 차시구분 선택 --', '-- choose --') }, ...gubunOptions]} /></div>
            {edit.mode === 'new' ? <AButton size="sm" disabled={!canWrite || !gubun} loading={batch.isPending} onClick={runBatch}>{tr('선택한 [차시 구분] 모두 등록하기', 'Register all of this 차시 구분')}</AButton> : null}
          </div>
        </FieldRow>
        <FieldRow label={tr('기초 차시 선택', 'Base content')} htmlFor="ch-content" required error={errors.ContentIdx}>
          <ASelect id="ch-content" value={content} onChange={(e) => setContent(e.target.value)} options={[{ value: '', label: tr('-- 기초 차시 선택 --', '-- choose --') }, ...(opts.data?.contents ?? []).map((c) => ({ value: String(c.idx), label: `${c.no}. ${c.title ?? ''}  (${c.detailCount})` }))]} />
        </FieldRow>
        <FieldRow label={tr('정렬 순서', 'Order')} htmlFor="ch-order" required error={errors.OrderByNum}><AInput id="ch-order" value={orderNum} onChange={(e) => setOrderNum(e.target.value)} maxLength={3} style={{ width: 90 }} /></FieldRow>
      </div>
    </DetailDrawer>
  );
}
