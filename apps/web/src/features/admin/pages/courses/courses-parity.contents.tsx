import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpContent, type CpContentDetailRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { AButton, AInput, ASelect, ATextarea, Card, FieldRow, DetailDrawer } from '../../../../shared/ui/admin';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { ReadButtons, useFormErrors } from './courses-parity.shared';
import { useToast } from '../../../../app/providers/ToastProvider';

// ====================================================================== contents_write.php

export function ContentsForm({ detail, onDone, onCancel }: { detail?: CpContent; onDone: (idx: number) => void; onCancel: () => void }) {
  const isNew = !detail;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const { errors, setErrors, onError } = useFormErrors();
  const opts = useQuery({ queryKey: ['admin', 'contents-options', '', ''], queryFn: ({ signal }) => cp.contentsOptions({}, signal), staleTime: 5 * 60_000 });
  const [f, setF] = useState({ Gubun: detail?.gubun ?? '', ContentsTitle: detail?.title ?? '', LectureTime: detail?.lectureTimeMin != null ? String(detail.lectureTimeMin) : '25', Expl01: detail?.goal ?? '', Expl02: detail?.trainingContents ?? '', Expl03: detail?.activities ?? '' });
  const save = useAdminMutation({
    fn: (b: Record<string, unknown>) => (isNew ? cp.createContent(b) : cp.patchContent(detail!.idx, b)),
    invalidate: [['admin', 'contents'], ['admin', 'content'], ['admin', 'contents-options']], success: tr('처리되었습니다.', 'Saved.'), onSuccess: (r) => onDone(isNew ? Number((r as { idx?: number }).idx) : detail!.idx), onError,
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.Gubun.trim()) e.Gubun = '차시구분을 입력하세요.';
    if (!f.ContentsTitle.trim()) e.ContentsTitle = '차시명을 입력하세요.';
    if (!f.LectureTime.trim()) e.LectureTime = '수강시간을 입력하세요.';
    else if (!/^\d+$/.test(f.LectureTime.trim())) e.LectureTime = '수강시간은 숫자만 입력하세요.';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!window.confirm(tr('등록하시겠습니까?', 'Save?'))) return;
    save.mutate({ Gubun: f.Gubun.trim(), ContentsTitle: f.ContentsTitle.trim(), LectureTime: Number(f.LectureTime), Expl01: f.Expl01, Expl02: f.Expl02, Expl03: f.Expl03 });
  };
  const gubuns = opts.data?.gubuns ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title={tr(`기초차시 관리 ${isNew ? '등록' : '수정'}`, isNew ? 'New base content' : 'Edit base content')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('차시구분 선택', 'Pick 차시 구분')} htmlFor="cw-gsel"><ASelect id="cw-gsel" value={gubuns.includes(f.Gubun) ? f.Gubun : ''} onChange={(e) => setF({ ...f, Gubun: e.target.value })} options={[{ value: '', label: tr('-- 차시구분 선택 --', '-- choose --') }, ...gubuns.map((g) => ({ value: g, label: g }))]} /></FieldRow>
          <FieldRow label={tr('차시 구분', '차시 구분')} htmlFor="cw-gubun" required error={errors.Gubun} help={tr('차시구분 선택에 없는 경우 직접 입력하세요.', 'Type a new one if it is not in the list.')}><AInput id="cw-gubun" value={f.Gubun} onChange={(e) => setF({ ...f, Gubun: e.target.value })} maxLength={250} invalid={!!errors.Gubun} /></FieldRow>
          <FieldRow label={tr('차시명', 'Title')} htmlFor="cw-title" required error={errors.ContentsTitle}><AInput id="cw-title" value={f.ContentsTitle} onChange={(e) => setF({ ...f, ContentsTitle: e.target.value })} maxLength={250} invalid={!!errors.ContentsTitle} /></FieldRow>
          <FieldRow label={tr('수강시간', 'Minutes')} htmlFor="cw-time" required error={errors.LectureTime} help={tr('플레이어는 차시당 최대 수강시간×60초까지 학습시간을 인정합니다. 이미 저장된 학습시간은 바뀌지 않습니다.', 'The player credits at most minutes×60 s per chapter; stored study time is not changed.')}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><AInput id="cw-time" value={f.LectureTime} onChange={(e) => setF({ ...f, LectureTime: e.target.value })} style={{ width: 90 }} invalid={!!errors.LectureTime} />{tr('분', 'min')}</span></FieldRow>
          <FieldRow label={tr('차시 목표', 'Goals')} htmlFor="cw-e1"><ATextarea id="cw-e1" rows={7} value={f.Expl01} onChange={(e) => setF({ ...f, Expl01: e.target.value })} /></FieldRow>
          <FieldRow label={tr('훈련 내용', 'Training content')} htmlFor="cw-e2"><ATextarea id="cw-e2" rows={7} value={f.Expl02} onChange={(e) => setF({ ...f, Expl02: e.target.value })} /></FieldRow>
          <FieldRow label={tr('학습 활동', 'Activities')} htmlFor="cw-e3"><ATextarea id="cw-e3" rows={7} value={f.Expl03} onChange={(e) => setF({ ...f, Expl03: e.target.value })} /></FieldRow>
        </div>
      </Card>
      <ReadButtons center={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{isNew ? tr('등록', 'Register') : tr('수정', 'Save')}</AButton>} right={<AButton onClick={onCancel}>{tr('목록', 'List')}</AButton>} />
    </div>
  );
}

// ====================================================================== contents_detail.php (popup) → drawer

export type DetailForm = {
  ContentsType: string; ContentsPage: string; ContentsMobilePage: string; ContentsURLSelect: string; ContentsURL: string; ContentsURL2: string; MobileURL: string; MobileURL2: string; Question: string;
  Example01: string; Example02: string; Example03: string; Example04: string; Example05: string; Answer: string; Comment: string; Teacher: string; OrderByNum: string; UseYN: string; Caption: string;
};
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
export function detailForm(row: CpContentDetailRow | null, nextOrder: number): DetailForm {
  return {
    ContentsType: s(row?.type) || 'A', ContentsPage: s(row?.pages), ContentsMobilePage: s(row?.mobilePages), ContentsURLSelect: s(row?.urlSelect) || 'A', ContentsURL: s(row?.url), ContentsURL2: s(row?.url2), MobileURL: s(row?.mobileUrl), MobileURL2: s(row?.mobileUrl2), Question: s(row?.question),
    Example01: s(row?.examples[0]), Example02: s(row?.examples[1]), Example03: s(row?.examples[2]), Example04: s(row?.examples[3]), Example05: s(row?.examples[4]), Answer: s(row?.answer), Comment: s(row?.comment),
    Teacher: row?.teacher ? String(row.teacher) : '', OrderByNum: String(row ? row.order : nextOrder), UseYN: s(row?.useYN) || 'Y', Caption: s(row?.caption),
  };
}
/** Which rows contents_detail.php shows per 컨텐츠 유형 (CommonTR / FlashTR / MovieTR / ExamTR / ExamSelectTR / TeacherTR). */
export function detailSections(type: string) {
  return { common: type === 'A' || type === 'B', flash: type === 'A', movie: type === 'B', exam: type === 'C' || type === 'D', examSelect: type === 'C', teacher: type === 'F' };
}

/**
 * ContentsDetailSubmitOk() (function.js): A/B 컨텐츠 경로; C 질문, 보기1–4, 정답, 해답 설명; D 질문, 해답 설명; F 강사; 정렬순서 required + numeric.
 * Same order and messages; the API runs the same rules (ContentsDetailBody).
 */
export function detailFormError(f: DetailForm): { field: string; message: string } | null {
  const t = (v: string) => v.trim();
  const type = f.ContentsType;
  if (!type) return { field: 'ContentsType', message: '컨텐츠 유형을 선택하세요.' };
  if ((type === 'A' || type === 'B') && !t(f.ContentsURL)) return { field: 'ContentsURL', message: '컨텐츠 경로를 입력하세요.' };
  if (type === 'C') {
    if (!t(f.Question)) return { field: 'Question', message: '질문 내용을 입력하세요.' };
    const ex: [keyof DetailForm, string][] = [['Example01', '보기1을 입력하세요.'], ['Example02', '보기2를 입력하세요.'], ['Example03', '보기3을 입력하세요.'], ['Example04', '보기4를 입력하세요.']];
    for (const [k, m] of ex) if (!t(f[k])) return { field: k, message: m };
    if (!t(f.Answer)) return { field: 'Answer', message: '보기중 정답을 선택하세요.' };
    if (!t(f.Comment)) return { field: 'Comment', message: '해답 설명을 입력하세요.' };
  }
  if (type === 'D') {
    if (!t(f.Question)) return { field: 'Question', message: '질문 내용을 입력하세요.' };
    if (!t(f.Comment)) return { field: 'Comment', message: '해답 설명을 입력하세요.' };
  }
  if (type === 'F' && (!f.Teacher || f.Teacher === '0')) return { field: 'Teacher', message: '강사를 선택하세요.' };
  if (!t(f.OrderByNum)) return { field: 'OrderByNum', message: '정렬순서를 입력하세요.' };
  if (!/^\d+$/.test(t(f.OrderByNum))) return { field: 'OrderByNum', message: '정렬순서는 숫자만 입력하세요.' };
  return null;
}

export function ContentDetailDrawer({ contentsIdx, row, nextOrder, onClose }: { contentsIdx: number; row: CpContentDetailRow | null; nextOrder: number; onClose: () => void }) {
  const { canWrite } = useWriteGate();
  const { toast } = useToast();
  const { errors, setErrors, onError } = useFormErrors();
  const meta = useQuery({ queryKey: ['admin', 'contents', 'meta'], queryFn: ({ signal }) => cp.contentsMeta(signal), staleTime: 10 * 60_000 });
  const [f, setF] = useState<DetailForm>(() => detailForm(row, nextOrder));
  const set = (p: Partial<DetailForm>) => setF((x) => ({ ...x, ...p }));
  const save = useAdminMutation({
    fn: (b: Record<string, unknown>) => (row ? cp.putDetail(contentsIdx, row.seq, b) : cp.createDetail(contentsIdx, b)),
    invalidate: [['admin', 'content', contentsIdx], ['admin', 'contents']], success: tr('처리되었습니다.', 'Saved.'), onSuccess: onClose, onError,
  });
  const sec = detailSections(f.ContentsType);
  const submit = () => {
    const err = detailFormError(f);
    setErrors(err ? { [err.field]: err.message } : {});
    if (err) { toast(err.message, { tone: 'danger' }); return; }
    if (!window.confirm(tr('등록 하시겠습니까?', 'Register?'))) return;
    save.mutate({ ...f, OrderByNum: Number(f.OrderByNum), Teacher: f.Teacher ? Number(f.Teacher) : 0, Answer: f.Answer || null });
  };
  const deleteCaption = () => { if (window.confirm(tr('파일을 서버에서 삭제 하시겠습니까?', 'Delete the file?'))) set({ Caption: '' }); };
  const t = (k: keyof DetailForm, label: string, required = false) => <FieldRow label={label} htmlFor={`cd-${k}`} required={required} error={errors[k]}><AInput id={`cd-${k}`} value={f[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<DetailForm>)} maxLength={500} invalid={!!errors[k]} /></FieldRow>;
  const srv = meta.data?.servers;
  return (
    <DetailDrawer open onClose={onClose} wide title={tr('기초차시 상세 구성', 'Page composition')} subtitle={row ? `Seq ${row.seq}` : tr('추가', 'New')}
      footer={<><AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" disabled={!canWrite} loading={save.isPending} onClick={submit}>{tr('등록 하기', 'Save')}</AButton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldRow label={tr('컨텐츠 유형', 'Type')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', paddingTop: 6 }}>
            {(meta.data?.contentsTypes ?? []).map((o) => <label key={o.value}><input type="radio" name="cd-type" checked={f.ContentsType === o.value} onChange={() => set({ ContentsType: o.value })} /> {o.label}</label>)}
          </div>
        </FieldRow>
        {sec.common ? <>{t('ContentsPage', tr('차시 페이지수', 'Pages'))}{t('ContentsMobilePage', tr('모바일 페이지수', 'Mobile pages'))}</> : null}
        {sec.flash ? <FieldRow label={tr('Flash 서버', 'Flash server')}><div className="mono" style={{ paddingTop: 6, fontSize: 12 }}>{srv?.flash}</div></FieldRow> : null}
        {sec.movie ? <FieldRow label={tr('동영상 서버', 'Video server')}><div className="mono" style={{ paddingTop: 6, fontSize: 12 }}>{srv?.movie}</div></FieldRow> : null}
        {sec.movie ? (
          <FieldRow label={tr('컨텐츠 경로 선택', 'Path')}>
            <div style={{ display: 'flex', gap: 12, paddingTop: 6 }}>
              <label><input type="radio" name="cd-url" checked={f.ContentsURLSelect === 'A'} onChange={() => set({ ContentsURLSelect: 'A' })} /> {tr('주 경로', 'Main')}</label>
              <label><input type="radio" name="cd-url" checked={f.ContentsURLSelect === 'B'} onChange={() => set({ ContentsURLSelect: 'B' })} /> {tr('예비 경로', 'Backup')}</label>
            </div>
          </FieldRow>
        ) : null}
        {sec.common ? t('ContentsURL', tr('컨텐츠 경로', 'Content path'), true) : null}
        {sec.movie ? t('ContentsURL2', tr('컨텐츠 경로(예비)', 'Content path (backup)')) : null}
        {sec.common ? <FieldRow label={tr('모바일 서버', 'Mobile server')}><div className="mono" style={{ paddingTop: 6, fontSize: 12 }}>{srv?.mobile}</div></FieldRow> : null}
        {sec.common ? t('MobileURL', tr('모바일 경로', 'Mobile path')) : null}
        {sec.movie ? t('MobileURL2', tr('모바일 경로(예비)', 'Mobile path (backup)')) : null}
        {sec.movie ? (
          <FieldRow label={tr('자막 업로드', 'Captions')} help={tr('"파일 삭제"는 저장된 파일명(Caption)을 비우고 "등록 하기"로 저장합니다. 자막 업로드(CaptionUploadFile)와 내려받기 링크는 기존 사이트에서도 동작하지 않았습니다.', '"Delete file" clears the stored caption name (saved with "Register"). Caption upload and download never worked on the previous site either.')}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
              <span className="mono" style={{ fontSize: 12 }}>{f.Caption || adm.common.none}</span>
              {f.Caption ? <AButton size="xs" disabled={!canWrite} onClick={deleteCaption}>{tr('파일 삭제', 'Delete file')}</AButton> : null}
            </div>
          </FieldRow>
        ) : null}
        {sec.exam ? <FieldRow label={tr('질문 내용', 'Question')} htmlFor="cd-q" required error={errors.Question}><ATextarea id="cd-q" rows={2} value={f.Question} onChange={(e) => set({ Question: e.target.value })} /></FieldRow> : null}
        {sec.examSelect ? ([1, 2, 3, 4, 5] as const).map((i) => { const k = `Example0${i}` as keyof DetailForm; return (
          <FieldRow key={k} label={tr(`보기 ${i}`, `Choice ${i}`)} error={errors[k] || (i === 1 ? errors.Answer : undefined)}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="radio" name="cd-answer" aria-label={tr(`정답 ${i}`, `Answer ${i}`)} checked={f.Answer === String(i)} onChange={() => set({ Answer: String(i) })} /><AInput aria-label={tr(`보기 ${i}`, `Choice ${i}`)} value={f[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<DetailForm>)} maxLength={500} /></div>
          </FieldRow>
        ); }) : null}
        {sec.exam ? <FieldRow label={tr('해답 설명', 'Explanation')} htmlFor="cd-c" required error={errors.Comment}><ATextarea id="cd-c" rows={3} value={f.Comment} onChange={(e) => set({ Comment: e.target.value })} /></FieldRow> : null}
        {sec.teacher ? <FieldRow label={tr('강사 선택', 'Instructor')} required error={errors.Teacher}><ASelect aria-label={tr('강사 선택', 'Instructor')} value={f.Teacher} onChange={(e) => set({ Teacher: e.target.value })} options={[{ value: '', label: tr('-- 강사 선택 --', '-- choose --') }, ...(meta.data?.teachers ?? []).map((x) => ({ value: String(x.idx), label: x.name ?? '' }))]} /></FieldRow> : null}
        <FieldRow label={tr('정렬 순서', 'Order')} htmlFor="cd-order" required error={errors.OrderByNum}><AInput id="cd-order" value={f.OrderByNum} onChange={(e) => set({ OrderByNum: e.target.value })} style={{ width: 90 }} invalid={!!errors.OrderByNum} /></FieldRow>
        <FieldRow label={tr('사용 여부', 'In use')}>
          <div style={{ display: 'flex', gap: 12, paddingTop: 6 }}>
            <label><input type="radio" name="cd-use" checked={f.UseYN === 'Y'} onChange={() => set({ UseYN: 'Y' })} /> {tr('사용', 'Yes')}</label>
            <label><input type="radio" name="cd-use" checked={f.UseYN === 'N'} onChange={() => set({ UseYN: 'N' })} /> {tr('미사용', 'No')}</label>
          </div>
        </FieldRow>
      </div>
    </DetailDrawer>
  );
}
