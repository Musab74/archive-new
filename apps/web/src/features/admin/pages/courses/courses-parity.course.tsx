import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpCourseDetail, type CpCourseMeta, type CpCourseRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { AButton, ACheckbox, AInput, ASelect, ATextarea, Callout, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, type Column } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { Multiline, ReadButtons, listHref, menuName, useFormErrors, useYnOptions, won } from './courses-parity.shared';
import { isAppError } from '../../../../shared/api/client';
import type { CpCourseFileSlot } from '../../../../shared/api/endpoints/admin-courses-parity';

// ====================================================================== course_read.php

/** The read view of course_read.php, in the same row order (등급/과정코드 … 교육목표), plus the action buttons. */
export function CourseReadView({ d, onEdit }: { d: CpCourseDetail; onEdit: () => void }) {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const navigate = useNavigate();
  const [testIds, setTestIds] = useState(false);
  const [del, setDel] = useState(false);
  const { toast } = useToast();
  const listTo = listHref(`courses:${d.ctype ?? 'X'}`, '/admin/courses', `?ctype=${d.ctype ?? 'X'}`);
  const download = async (slot: CpCourseFileSlot, name: string) => { try { await cp.downloadCourseFile(d.idx, slot, name); } catch (err) { toast(isAppError(err) ? err.message : tr('파일을 내려받지 못했습니다.', 'Download failed.'), { tone: 'danger' }); } };
  const remove = useAdminMutation({ fn: () => cp.deleteCourse(d.idx), invalidate: [['admin', 'courses'], ['admin', 'course', d.idx]], success: tr('처리되었습니다.', 'Done.'), onSuccess: () => navigate(listTo) });
  const img = (f: string | null | undefined, h: number) => (f ? <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}><img src={`${d.fileBase}${f}`} alt="" style={{ maxHeight: h, maxWidth: 160 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /><span className="mono" style={{ fontSize: 11 }}>{f}</span></span> : null);
  const rows: [ReactNode, ReactNode][] = [
    [tr('등급 / 과정코드', 'Grade / code'), <>{d.classGradeLabel} / <b className="mono" style={{ color: 'var(--danger, #c00)' }}>{d.lectureCode}</b></>],
    [tr('사이트노출 / 컨텐츠 경로', 'Visible / content path'), <>{d.useLabel} / {d.contentsUrlSelect === 'B' ? tr('예비 경로', 'Backup path') : tr('주 경로', 'Main path')}</>],
    [tr('패키지 콘텐츠 과정코드', 'Package course codes'), <span className="mono" style={{ wordBreak: 'break-all' }}>{d.packageLectureCode ?? ''}</span>],
    [tr('원격훈련일련번호', 'Remote-training serial'), d.hrdSeq ?? ''],
    [tr('과정 분류', 'Category'), `${d.categoryName1 ?? ''} > ${d.categoryName2 ?? ''}`],
    [tr('서비스 구분', 'Service type'), d.serviceTypeLabel],
    [tr('교육시간', 'Duration'), tr(`${d.contentsTime ?? ''} 분`, `${d.contentsTime ?? ''} min`)],
    [tr('과정명', 'Course name'), <b>{d.name}</b>],
    [tr('법정교육여부', 'Mandatory training'), d.legalEduLabel],
    [tr('조회수', 'Views'), tr(`${d.views}회`, `${d.views}`)],
    [tr('난이도(직급)', 'Level (rank)'), d.keyword1Name ?? ''],
    [tr('직무분야', 'Job field'), d.keyword2Name ?? ''],
    [tr('관심분야', 'Interests'), d.keyword3Names.map((n) => `#${n}`).join(' ')],
    [tr('역량', 'Competencies'), d.keyword4Names.map((n) => `#${n}`).join(' ')],
    [tr('차시수', 'Chapters'), d.chapterLabel],
    [tr('컨텐츠 제작연도기간', 'Production period'), `${d.contentsStart} ~ ${d.contentsEnd}`],
    [tr('컨텐츠 업로드 일자', 'Uploaded'), d.uploadDate],
    [tr('교강사', 'Instructor'), d.professor ?? ''],
    [tr('수료기준', 'Pass rule'), tr(`${d.passTime} 시간 이상`, `≥ ${d.passTime} h`)],
    [tr('모바일 지원', 'Mobile'), d.mobileLabel],
    [tr('교재비', 'Textbook price'), won(d.bookPrice)],
    [tr('교육비용', 'Price'), <>{won(d.prices.normal)} | <b>{tr('환급비용', 'Refund')}</b> : {tr('우선지원', 'Priority')} {won(d.prices.priority)} / {tr('대규모 1000인 미만', 'Large <1000')} {won(d.prices.large1)} / {tr('대규모 1000인 이상', 'Large ≥1000')} {won(d.prices.large2)}</>],
    [tr('학습자료 등록', 'Study material'), d.attachFile ? <a href="#download" className="mono" onClick={(e) => { e.preventDefault(); void download('attachFile', d.attachFile!); }}><b>{d.attachFile}</b></a> : ''],
    [tr('과정 이미지', 'Course image'), img(d.previewImage, 100)],
    [tr('교재 이미지', 'Textbook image'), img(d.bookImage, 100)],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canWrite ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
          <a href="#test-ids" onClick={(e) => { e.preventDefault(); setTestIds(true); }}>{tr(`[등록된 심사용 테스트 아이디 ${d.testIdCount}건 보기]`, `[View ${d.testIdCount} review test IDs]`)}</a>
          <AButton size="sm" disabled title={tr('심사용 테스트 아이디 생성(course_testid_creat.php)은 차시마다 진도 100%·학습시간 1800초를 만들어 넣는 기능입니다. 학습시간을 만들어 넣는 쓰기는 HRD/EMON 규칙상 새 콘솔에서 하지 않으므로 기존 사이트에서만 합니다.', 'Creating review test IDs inserts 100% progress and 1800 s of study time per chapter; inventing study time is not allowed in the new console (HRD/EMON rule), so it stays on the previous site.')}>{tr('심사용 테스트 아이디 생성', 'Create review test IDs')}</AButton>
        </div>
      ) : null}
      {d.deleted ? <Callout tone="warn">{tr('삭제된(Del=Y) 컨텐츠입니다. 기존 사이트 상세 화면에서는 보이지 않습니다.', 'This content is deleted (Del=Y); the previous site no longer shows it.')}</Callout> : null}
      <Card title={tr(`${menuName(d.ctype ?? '')} 컨텐츠 정보`, 'Content information')}>
        <DescList cols={2} items={rows} />
      </Card>
      <Card title={tr('과정소개 · 교육대상 · 교육목표', 'Intro · audience · goals')}>
        <DescList items={[[tr('과정소개', 'Introduction'), <Multiline text={d.intro} />], [tr('교육대상', 'Audience'), <Multiline text={d.eduTarget} />], [tr('교육목표', 'Goals'), <Multiline text={d.eduGoal} />]]} />
      </Card>
      <ReadButtons
        left={canWrite ? <AButton variant="danger" onClick={() => setDel(true)} disabled={d.deleted}>{tr('컨텐츠 삭제', 'Delete')}</AButton> : null}
        center={canWrite ? <AButton variant="primary" onClick={onEdit} title={readOnlyTitle}>{tr('컨텐츠 수정', 'Edit')}</AButton> : null}
        right={<AButton to={listTo}>{tr('목록', 'List')}</AButton>} />
      {testIds ? <TestIdsDrawer idx={d.idx} lectureCode={d.lectureCode} onClose={() => setTestIds(false)} /> : null}
      <ConfirmDialog open={del} tone="danger" title={tr('컨텐츠 삭제', 'Delete content')} body={<p>{tr('현재 컨텐츠를 삭제하시겠습니까? (Del=Y로 표시되고 수강 기록은 남습니다)', 'Delete this content? (marked Del=Y; enrollments stay)')}</p>} loading={remove.isPending} onCancel={() => setDel(false)} onConfirm={() => remove.mutate()} />
    </div>
  );
}

/** course_testid_view.php */
function TestIdsDrawer({ idx, lectureCode, onClose }: { idx: number; lectureCode: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'course', idx, 'test-ids'], queryFn: ({ signal }) => cp.testIds(idx, signal) });
  type Row = NonNullable<typeof q.data>['items'][number];
  const cols: Column<Row>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 50 },
    { key: 'id', header: tr('아이디', 'ID'), render: (r) => <span className="mono">{r.id}</span> },
    { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
    { key: 'mobile', header: tr('휴대폰', 'Mobile'), render: (r) => r.mobile ?? '' },
    { key: 'lectureStart', header: tr('강의 시작일', 'Start'), nowrap: true, render: (r) => r.lectureStart ?? '' },
    { key: 'lectureEnd', header: tr('강의 종료일', 'End'), nowrap: true, render: (r) => r.lectureEnd ?? '' },
    { key: 'lastLogin', header: tr('최종로그인', 'Last login'), nowrap: true, render: (r) => r.lastLogin ?? '' },
    { key: 'regDate', header: tr('가입일', 'Joined'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'useLabel', header: tr('계정 사용유무', 'Account'), align: 'center', render: (r) => r.useLabel },
  ];
  return (
    <DetailDrawer open onClose={onClose} wide title={tr('심사용 테스트 아이디 보기', 'Review test IDs')} subtitle={lectureCode} footer={<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton>}>
      <DataTable columns={cols} rows={q.data?.items} rowKey={(r) => `${r.id}-${r.no}`} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={tr('등록된 테스트 아이디가 없습니다.', 'No test IDs.')} emptyBody=" " />
    </DetailDrawer>
  );
}

// ====================================================================== course_write.php

type Form = {
  LectureCode: string; ClassGrade: string; UseYN: string; ContentsURLSelect: string; PackageLectureCode: string; HrdSeq: string; Category1: string; Category2: string; ContentsName: string; LegalEduReq: string;
  Keyword1: string; Keyword2: string; Keyword3: number[]; Keyword4: number[]; Chapter: string; ContentsTime: string; ContentsStart: string; ContentsEnd: string; UploadDate: string; Professor: string; PassTime: string;
  Price: string; Price01View: string; Price02View: string; Price03View: string; Mobile: string; BookPrice: string; attachFile: string; PreviewImage: string; BookImage: string; Intro: string; EduTarget: string; EduGoal: string;
};
const EMPTY: Form = {
  LectureCode: '', ClassGrade: 'A', UseYN: 'Y', ContentsURLSelect: 'A', PackageLectureCode: '', HrdSeq: '', Category1: '', Category2: '', ContentsName: '', LegalEduReq: 'N', Keyword1: '', Keyword2: '', Keyword3: [], Keyword4: [],
  Chapter: '', ContentsTime: '', ContentsStart: '', ContentsEnd: '', UploadDate: '', Professor: '', PassTime: '', Price: '', Price01View: '', Price02View: '', Price03View: '', Mobile: 'Y', BookPrice: '', attachFile: '', PreviewImage: '', BookImage: '', Intro: '', EduTarget: '', EduGoal: '',
};
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
export function formFromDetail(d: CpCourseDetail): Form {
  return {
    LectureCode: d.lectureCode, ClassGrade: s(d.classGrade) || 'A', UseYN: s(d.useYN) || 'Y', ContentsURLSelect: s(d.contentsUrlSelect) || 'A', PackageLectureCode: s(d.packageLectureCode), HrdSeq: s(d.hrdSeq), Category1: s(d.category1), Category2: s(d.category2) === '0' ? '' : s(d.category2),
    ContentsName: s(d.name), LegalEduReq: s(d.legalEduReq).toUpperCase() === 'Y' ? 'Y' : 'N', Keyword1: s(d.keyword1), Keyword2: s(d.keyword2), Keyword3: d.keyword3Ids, Keyword4: d.keyword4Ids, Chapter: s(d.chapter), ContentsTime: s(d.contentsTime),
    ContentsStart: d.contentsStart, ContentsEnd: d.contentsEnd, UploadDate: d.uploadDate, Professor: s(d.professor), PassTime: s(d.passTime), Price: s(d.prices.normal), Price01View: s(d.prices.priority), Price02View: s(d.prices.large1), Price03View: s(d.prices.large2),
    Mobile: s(d.mobile) || 'N', BookPrice: s(d.bookPrice), attachFile: s(d.attachFile), PreviewImage: s(d.previewImage), BookImage: s(d.bookImage), Intro: s(d.intro), EduTarget: s(d.eduTarget), EduGoal: s(d.eduGoal),
  };
}

/** SubmitOk() of course_write.php (same order and messages). Returns {field: message}. */
export function validateCourseForm(f: Form, isNew: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (isNew) {
    if (!f.LectureCode) e.LectureCode = '과정코드를 입력하세요.';
    else if (f.LectureCode.length < 4 || f.LectureCode.length > 10) e.LectureCode = '과정코드는 영문 대문자, 숫자로 4자 이상, 10자 이하로 입력하세요.';
    else if (!/^[A-Z0-9]+$/.test(f.LectureCode)) e.LectureCode = '과정코드는 영문 대문자, 숫자로 입력하세요.';
  }
  if (!f.Keyword3.length) e.Keyword3 = '관심분야를 선택하세요.';
  if (!f.Keyword4.length) e.Keyword4 = '역량을 선택하세요.';
  if (!f.Category1) e.Category1 = '과정분류 대분류를 선택하세요.';
  if (!f.Category2) e.Category2 = '과정분류 중분류를 선택하세요.';
  if (!f.Keyword1) e.Keyword1 = '난이도(직급)를 선택하세요.';
  if (!f.Keyword2) e.Keyword2 = '직무분야를 선택하세요.';
  if (!f.ContentsName.trim()) e.ContentsName = '과정명을 입력하세요.';
  if (!f.Chapter) e.Chapter = '차시수를 입력하세요.';
  else if (!/^\d+$/.test(f.Chapter)) e.Chapter = '차시수는 숫자만 입력하세요.';
  if (!f.ContentsTime) e.ContentsTime = '교육시간을 입력하세요.';
  else if (!/^\d+$/.test(f.ContentsTime)) e.ContentsTime = '교육시간은 숫자만 입력하세요.';
  if (!f.ContentsStart) e.ContentsStart = '컨텐츠 시작일을 입력하세요.';
  if (!f.ContentsEnd) e.ContentsEnd = '콘텐츠 만료일을 입력하세요.';
  if (!f.UploadDate) e.UploadDate = '콘텐츠 업로드일을 입력하세요.';
  for (const k of ['PassTime', 'Price', 'Price01View', 'Price02View', 'Price03View', 'BookPrice'] as const) if (f[k] && !/^\d+$/.test(f[k])) e[k] = '숫자만 입력하세요.';
  return e;
}

export function courseBody(f: Form, ctype: string, isNew: boolean): Record<string, unknown> {
  const n = (v: string) => (v.trim() === '' ? 0 : Number(v));
  const b: Record<string, unknown> = {
    ClassGrade: f.ClassGrade, UseYN: f.UseYN, ContentsURLSelect: f.ContentsURLSelect, PackageLectureCode: f.PackageLectureCode, HrdSeq: f.HrdSeq, Category1: Number(f.Category1), Category2: Number(f.Category2), ContentsName: f.ContentsName.trim(), LegalEduReq: f.LegalEduReq,
    Keyword1: Number(f.Keyword1), Keyword2: Number(f.Keyword2), Keyword3: f.Keyword3, Keyword4: f.Keyword4, Chapter: f.Chapter, ContentsTime: f.ContentsTime, ContentsStart: f.ContentsStart, ContentsEnd: f.ContentsEnd, UploadDate: f.UploadDate, Professor: f.Professor,
    PassTime: n(f.PassTime), Price: n(f.Price), Price01View: n(f.Price01View), Price02View: n(f.Price02View), Price03View: n(f.Price03View), Mobile: f.Mobile, BookPrice: n(f.BookPrice), attachFile: f.attachFile, PreviewImage: f.PreviewImage, BookImage: f.BookImage,
    Intro: f.Intro, EduTarget: f.EduTarget, EduGoal: f.EduGoal,
  };
  if (isNew) { b.ctype = ctype; b.LectureCode = f.LectureCode; } else b.ServiceType = ctype;
  return b;
}

function CheckList({ items, value, onChange, max, disabled, error }: { items: { idx: number; name?: string | null }[]; value: number[]; onChange: (v: number[]) => void; max: number; disabled?: boolean; error?: string }) {
  const { toast } = useToast();
  if (!items.length) return <span className="muted" style={{ fontSize: 13 }}>{tr('등록된 항목이 없습니다 (역량진단 문항관리 aBind col3/col4).', 'No options (ArchiveQuestion col3/col4).')}</span>;
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {items.map((it) => <ACheckbox key={it.idx} label={it.name ?? String(it.idx)} checked={value.includes(it.idx)} disabled={disabled} onChange={(e) => {
          if (e.target.checked && value.length >= max) { toast(tr(`최대 ${max}개까지만 선택할 수 있습니다.`, `Up to ${max}.`), { tone: 'danger' }); return; }
          onChange(e.target.checked ? [...value, it.idx] : value.filter((x) => x !== it.idx));
        }} />)}
      </div>
      {error ? <div className="u-mt-4" style={{ color: 'var(--danger, #c00)', fontSize: 12 }}>{error}</div> : null}
    </div>
  );
}

/** course_write.php — 등록 (mode=new) and 수정 (mode=edit) with the same fields and checks. */
export function CourseForm({ ctype, detail, onDone, onCancel }: { ctype: string; detail?: CpCourseDetail; onDone: (idx: number) => void; onCancel: () => void }) {
  const isNew = !detail;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const qc = useQueryClient();
  const meta = useQuery({ queryKey: ['admin', 'courses', 'meta'], queryFn: ({ signal }) => cp.courseMeta(signal), staleTime: 5 * 60_000 });
  const [f, setF] = useState<Form>(detail ? formFromDetail(detail) : EMPTY);
  useEffect(() => { if (detail) setF(formFromDetail(detail)); }, [detail]);
  const { errors, setErrors, onError } = useFormErrors();
  const [copy, setCopy] = useState(false);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const m: CpCourseMeta | undefined = meta.data;
  const cat2 = useMemo(() => m?.categories.find((c) => String(c.idx) === f.Category1)?.children ?? [], [m, f.Category1]);
  const save = useAdminMutation({
    fn: (b: Record<string, unknown>) => (isNew ? cp.createCourse(b) : cp.patchCourse(detail!.idx, b)),
    invalidate: [['admin', 'courses'], ['admin', 'course']], success: tr('처리되었습니다.', 'Saved.'),
    onSuccess: (r) => onDone(isNew ? Number((r as { idx?: number }).idx) : detail!.idx), onError,
  });
  const submit = () => {
    const e = validateCourseForm(f, isNew);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!window.confirm(isNew ? tr('등록 하시겠습니까?', 'Register?') : tr('수정 하시겠습니까?', 'Save changes?'))) return;
    save.mutate(courseBody(f, ctype, isNew));
  };
  const applyCopy = async (idx: number) => {
    const d = await qc.fetchQuery({ queryKey: ['admin', 'course', idx], queryFn: ({ signal }) => cp.course(idx, signal) });
    const x = formFromDetail(d);
    // course_copy_apply.php copies these fields (과정코드 is never copied)
    set({ ClassGrade: x.ClassGrade, UseYN: x.UseYN, Category1: x.Category1, Category2: x.Category2, ContentsName: x.ContentsName, Chapter: x.Chapter, ContentsTime: x.ContentsTime, Mobile: x.Mobile, BookPrice: x.BookPrice, attachFile: x.attachFile, PreviewImage: x.PreviewImage, BookImage: x.BookImage, Intro: x.Intro, EduTarget: x.EduTarget, EduGoal: x.EduGoal });
    setCopy(false);
  };
  const dis = !canWrite;
  const num = (k: keyof Form, w = 110, max = 7) => <AInput id={`cf-${k}`} value={f[k] as string} onChange={(e) => set({ [k]: e.target.value } as Partial<Form>)} maxLength={max} style={{ width: w, textAlign: 'right' }} disabled={dis} invalid={!!errors[k]} />;
  const yn = useYnOptions();
  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isNew && canWrite ? <div style={{ display: 'flex', justifyContent: 'flex-end' }}><AButton variant="primary" onClick={() => setCopy(true)}>{tr('컨텐츠 정보 가져오기', 'Copy from existing content')}</AButton></div> : null}
      <Card title={tr(`${menuName(ctype)} 컨텐츠 관리 ${isNew ? '등록' : '수정'}`, isNew ? 'New content' : 'Edit content')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={grid2}>
            <FieldRow label={tr('등급 / 과정코드', 'Grade / code')} htmlFor="cf-LectureCode" required error={errors.LectureCode}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 110 }}><ASelect aria-label={tr('등급', 'Grade')} value={f.ClassGrade} onChange={(e) => set({ ClassGrade: e.target.value })} options={m?.classGrades ?? [{ value: 'A', label: 'A등급' }, { value: 'B', label: 'B등급' }, { value: 'C', label: 'C등급' }]} disabled={dis} /></div>
                /{isNew ? <AInput id="cf-LectureCode" value={f.LectureCode} onChange={(e) => set({ LectureCode: e.target.value.toUpperCase() })} maxLength={10} style={{ width: 140 }} disabled={dis} invalid={!!errors.LectureCode} /> : <b className="mono">{f.LectureCode}</b>}
              </div>
            </FieldRow>
            <FieldRow label={tr('사이트노출 / 컨텐츠 경로', 'Visible / path')}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 110 }}><ASelect aria-label={tr('사이트노출', 'Visible')} value={f.UseYN} onChange={(e) => set({ UseYN: e.target.value })} options={yn} disabled={dis} /></div>
                <label><input type="radio" name="cf-url" checked={f.ContentsURLSelect === 'A'} onChange={() => set({ ContentsURLSelect: 'A' })} disabled={dis} /> {tr('주 경로', 'Main')}</label>
                <label><input type="radio" name="cf-url" checked={f.ContentsURLSelect === 'B'} onChange={() => set({ ContentsURLSelect: 'B' })} disabled={dis} /> {tr('예비 경로', 'Backup')}</label>
              </div>
            </FieldRow>
            <FieldRow label={tr('패키지콘텐츠 과정코드', 'Package course codes')} htmlFor="cf-PackageLectureCode"><AInput id="cf-PackageLectureCode" value={f.PackageLectureCode} onChange={(e) => set({ PackageLectureCode: e.target.value })} disabled={dis} /></FieldRow>
            <FieldRow label={tr('원격훈련일련번호', 'Remote-training serial')} htmlFor="cf-HrdSeq"><AInput id="cf-HrdSeq" value={f.HrdSeq} onChange={(e) => set({ HrdSeq: e.target.value })} maxLength={100} disabled={dis} /></FieldRow>
            <FieldRow label={tr('과정분류', 'Category')} required error={errors.Category1 || errors.Category2}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><ASelect aria-label={tr('대분류', 'Main')} value={f.Category1} onChange={(e) => set({ Category1: e.target.value, Category2: '' })} options={[{ value: '', label: tr('-- 대분류 선택 --', '-- main --') }, ...(m?.categories ?? []).map((c) => ({ value: String(c.idx), label: c.name ?? '' }))]} disabled={dis} /></div>
                {f.Category1 ? <div style={{ flex: 1 }}><ASelect aria-label={tr('중분류', 'Sub')} value={f.Category2} onChange={(e) => set({ Category2: e.target.value })} options={[{ value: '', label: tr('-- 소분류 선택 --', '-- sub --') }, ...cat2.map((c) => ({ value: String(c.idx), label: c.name ?? '' }))]} disabled={dis} /></div> : null}
              </div>
            </FieldRow>
            <FieldRow label={tr('서비스 구분', 'Service type')}><div style={{ paddingTop: 6 }}>{menuName(ctype)}</div></FieldRow>
            <FieldRow label={tr('과정명', 'Course name')} htmlFor="cf-ContentsName" required error={errors.ContentsName}><AInput id="cf-ContentsName" value={f.ContentsName} onChange={(e) => set({ ContentsName: e.target.value })} maxLength={120} disabled={dis} invalid={!!errors.ContentsName} /></FieldRow>
            <FieldRow label={tr('법정교육여부', 'Mandatory training')}>
              <div style={{ display: 'flex', gap: 12, paddingTop: 6 }}>
                <label><input type="radio" name="cf-legal" checked={f.LegalEduReq === 'Y'} onChange={() => set({ LegalEduReq: 'Y' })} disabled={dis} /> {tr('예', 'Yes')}</label>
                <label><input type="radio" name="cf-legal" checked={f.LegalEduReq === 'N'} onChange={() => set({ LegalEduReq: 'N' })} disabled={dis} /> {tr('아니오', 'No')}</label>
              </div>
            </FieldRow>
            <FieldRow label={tr('난이도(직급)', 'Level (rank)')} required error={errors.Keyword1}><ASelect aria-label={tr('난이도(직급)', 'Level')} value={f.Keyword1} onChange={(e) => set({ Keyword1: e.target.value })} options={[{ value: '', label: tr('선택', 'Select') }, ...(m?.keyword1 ?? []).map((k) => ({ value: String(k.idx), label: k.name ?? '' }))]} disabled={dis} /></FieldRow>
            <FieldRow label={tr('직무분야', 'Job field')} required error={errors.Keyword2}><ASelect aria-label={tr('직무분야', 'Job field')} value={f.Keyword2} onChange={(e) => set({ Keyword2: e.target.value })} options={[{ value: '', label: tr('선택', 'Select') }, ...(m?.keyword2 ?? []).map((k) => ({ value: String(k.idx), label: k.name ?? '' }))]} disabled={dis} /></FieldRow>
          </div>
          <FieldRow label={tr('관심분야 (최대 3개)', 'Interests (max 3)')} required><CheckList items={m?.keyword3 ?? []} value={f.Keyword3} onChange={(v) => set({ Keyword3: v })} max={3} disabled={dis} error={errors.Keyword3} /></FieldRow>
          <FieldRow label={tr('역량 (최대 3개)', 'Competencies (max 3)')} required><CheckList items={m?.keyword4 ?? []} value={f.Keyword4} onChange={(v) => set({ Keyword4: v })} max={3} disabled={dis} error={errors.Keyword4} /></FieldRow>
          <div style={grid2}>
            <FieldRow label={tr('차시수', 'Chapters')} htmlFor="cf-Chapter" required error={errors.Chapter}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{num('Chapter', 80, 3)} {tr('차시', '')}</span></FieldRow>
            <FieldRow label={tr('교육시간', 'Duration')} htmlFor="cf-ContentsTime" required error={errors.ContentsTime}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{num('ContentsTime', 80, 3)} {tr('분', 'min')}</span></FieldRow>
            <FieldRow label={tr('컨텐츠 제작연도 기간', 'Production period')} required error={errors.ContentsStart || errors.ContentsEnd}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><AInput type="date" aria-label={tr('시작일', 'Start')} value={f.ContentsStart} onChange={(e) => set({ ContentsStart: e.target.value })} disabled={dis} /> ~ <AInput type="date" aria-label={tr('만료일', 'End')} value={f.ContentsEnd} onChange={(e) => set({ ContentsEnd: e.target.value })} disabled={dis} /></span>
            </FieldRow>
            <FieldRow label={tr('컨텐츠 업로드 일자', 'Upload date')} htmlFor="cf-UploadDate" required error={errors.UploadDate}><AInput id="cf-UploadDate" type="date" value={f.UploadDate} onChange={(e) => set({ UploadDate: e.target.value })} disabled={dis} /></FieldRow>
            <FieldRow label={tr('교강사', 'Instructor')} htmlFor="cf-Professor"><AInput id="cf-Professor" value={f.Professor} onChange={(e) => set({ Professor: e.target.value })} maxLength={150} disabled={dis} /></FieldRow>
            <FieldRow label={tr('수료기준', 'Pass rule')} htmlFor="cf-PassTime" error={errors.PassTime}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{num('PassTime', 80, 3)} {tr('시간 이상', 'h or more')}</span></FieldRow>
          </div>
          <FieldRow label={tr('수강비용', 'Price')} error={errors.Price || errors.Price01View || errors.Price02View || errors.Price03View}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {num('Price')} {tr('원', 'KRW')} | <b>{tr('환급비용', 'Refund')}</b> : {tr('우선지원', 'Priority')} {num('Price01View')} / {tr('대규모 1000인 미만', 'Large <1000')} {num('Price02View')} / {tr('대규모 1000인 이상', 'Large ≥1000')} {num('Price03View')}
            </div>
          </FieldRow>
          <div style={grid2}>
            <FieldRow label={tr('모바일 지원', 'Mobile')}><div style={{ width: 120 }}><ASelect aria-label={tr('모바일 지원', 'Mobile')} value={f.Mobile} onChange={(e) => set({ Mobile: e.target.value })} options={yn} disabled={dis} /></div></FieldRow>
            <FieldRow label={tr('교재비', 'Textbook price')} htmlFor="cf-BookPrice" error={errors.BookPrice}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{num('BookPrice', 110, 6)} {tr('원', 'KRW')}</span></FieldRow>
            <FieldRow label={tr('학습자료 등록', 'Study material')}><FileSlot slot="attachFile" kind="text" value={f.attachFile} courseIdx={detail?.idx} savedValue={detail?.attachFile} fileBase={m?.fileBase} disabled={dis} onChange={(v) => set({ attachFile: v })} /></FieldRow>
            <FieldRow label={tr('과정 이미지', 'Course image')}><FileSlot slot="PreviewImage" kind="img" value={f.PreviewImage} courseIdx={detail?.idx} savedValue={detail?.previewImage} fileBase={m?.fileBase} disabled={dis} onChange={(v) => set({ PreviewImage: v })} /></FieldRow>
            <FieldRow label={tr('교재 이미지', 'Textbook image')}><FileSlot slot="BookImage" kind="img" value={f.BookImage} courseIdx={detail?.idx} savedValue={detail?.bookImage} fileBase={m?.fileBase} disabled={dis} onChange={(v) => set({ BookImage: v })} /></FieldRow>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('파일은 "파일 첨부" 즉시 서버(upload/Course)에 저장되고, 열 값은 "등록/수정"을 눌러야 저장됩니다. "파일 삭제"는 서버 파일을 지우고(다른 컨텐츠가 쓰는 파일은 남김) 값을 비웁니다.', 'Files are stored in upload/Course right away; the column is saved with Register/Save. "Delete file" removes the server file (unless another content uses it) and clears the value.')}</p>
          <FieldRow label={tr('과정소개', 'Introduction')} htmlFor="cf-Intro"><ATextarea id="cf-Intro" rows={7} value={f.Intro} onChange={(e) => set({ Intro: e.target.value })} disabled={dis} /></FieldRow>
          <FieldRow label={tr('교육대상', 'Audience')} htmlFor="cf-EduTarget"><ATextarea id="cf-EduTarget" rows={7} value={f.EduTarget} onChange={(e) => set({ EduTarget: e.target.value })} disabled={dis} /></FieldRow>
          <FieldRow label={tr('교육목표', 'Goals')} htmlFor="cf-EduGoal"><ATextarea id="cf-EduGoal" rows={7} value={f.EduGoal} onChange={(e) => set({ EduGoal: e.target.value })} disabled={dis} /></FieldRow>
        </div>
      </Card>
      <ReadButtons center={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{isNew ? tr('등록', 'Register') : tr('수정', 'Save')}</AButton>} right={<AButton onClick={onCancel}>{tr('목록', 'List')}</AButton>} />
      {copy ? <CopyPicker ctype={ctype} onPick={(idx) => void applyCopy(idx)} onClose={() => setCopy(false)} /> : null}
    </div>
  );
}

/** course_copy.php — pick an existing content of the same ctype to prefill the form. */
function CopyPicker({ ctype, onPick, onClose }: { ctype: string; onPick: (idx: number) => void; onClose: () => void }) {
  const [q, setQ] = useState(''); const [applied, setApplied] = useState(''); const [pg, setPg] = useState(1);
  const query = { ctype, packageYN: 'N', col: applied ? 'ContentsName' : undefined, q: applied || undefined, page: pg, size: 10 };
  const list = useQuery({ queryKey: ['admin', 'courses', 'copy', query], queryFn: ({ signal }) => cp.courses(query, signal), placeholderData: keepPreviousData });
  const cols: Column<CpCourseRow>[] = [
    { key: 'lectureCode', header: <>{tr('등급', 'Grade')}<br />{tr('과정 코드', 'Code')}</>, render: (r) => <>{r.classGradeLabel}<br /><b className="mono">{r.lectureCode}</b></> },
    { key: 'serviceTypeLabel', header: tr('서비스 구분', 'Service'), render: (r) => r.serviceTypeLabel },
    { key: 'name', header: <>{tr('과정 분류', 'Category')}<br />{tr('과정명', 'Name')}</>, render: (r) => <><span className="muted">{r.category}</span><br />{r.name}</> },
    { key: 'chapter', header: <>{tr('총차시', 'Chapters')}<br />{tr('교육시간', 'Duration')}</>, render: (r) => <>{r.chapterLabel}<br />{r.contentsTime}</> },
    { key: 'hrdSeq', header: <>{tr('패키지콘텐츠 과정코드', 'Package')}<br />{tr('원격훈련 일련번호', 'Serial')}</>, render: (r) => <>{r.packageLectureCode ?? ''}<br />{r.hrdSeq ?? ''}</> },
    { key: 'contentsStart', header: <>{tr('제작연도', 'Produced')}<br />{tr('업로드', 'Uploaded')}</>, render: (r) => <>{r.contentsStart}<br />{r.uploadDate}</> },
    { key: 'mobile', header: tr('모바일', 'Mobile'), render: (r) => r.mobileLabel },
    { key: 'useYN', header: <>{tr('사이트', 'Site')}<br />{tr('노출', 'visible')}</>, render: (r) => r.useLabel },
    { key: 'pick', header: tr('선택', 'Pick'), render: (r) => <AButton size="xs" variant="primary" onClick={() => onPick(r.idx)}>{tr('선택', 'Pick')}</AButton> },
  ];
  return (
    <DetailDrawer open onClose={onClose} wide title={tr('컨텐츠 정보 가져오기', 'Copy from existing content')} footer={<AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton>}>
      <form style={{ display: 'flex', gap: 8, marginBottom: 10 }} onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); setPg(1); }}>
        <AInput aria-label={tr('과정명', 'Course name')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('과정명', 'Course name')} style={{ width: 280 }} /><AButton type="submit">{tr('검색', 'Search')}</AButton>
      </form>
      <DataTable columns={cols} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} page={pg} size={10} total={list.data?.total} onPageChange={setPg} dense />
    </DetailDrawer>
  );
}

/**
 * 학습자료 / 과정 이미지 / 교재 이미지 slot of course_write.php: "파일 첨부" (upload_file.php → upload_file_ok.php) and
 * "파일 삭제" (UploadFileDelete → file_delete.php), each with the PHP confirm; images are previewed like the PHP page.
 */
function FileSlot({ slot, kind, value, savedValue, courseIdx, fileBase, disabled, onChange }: { slot: CpCourseFileSlot; kind: 'text' | 'img'; value: string; savedValue?: string | null; courseIdx?: number; fileBase?: string; disabled: boolean; onChange: (v: string) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const pickerId = `cf-file-${slot}`;
  const upload = async (file: File | undefined) => {
    if (!file) { toast(tr('파일을 선택하세요.', 'Choose a file.'), { tone: 'danger' }); return; }
    if (!window.confirm(tr('업로드 하시겠습니까?', 'Upload?'))) return;
    setBusy(true);
    try { const r = await cp.uploadCourseFile(kind, file); onChange(r.fileName); toast(tr('첨부되었습니다. 저장해야 반영됩니다.', 'Attached. Save to keep it.'), { tone: 'ok' }); }
    catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(tr('파일을 서버에서 삭제 하시겠습니까?', 'Delete the file from the server?'))) return;
    setBusy(true);
    try { const r = await cp.deleteCourseFile(value, courseIdx); toast(r.removed ? tr('삭제되었습니다.', 'Deleted.') : r.reason ?? tr('삭제되었습니다.', 'Deleted.'), { tone: 'ok' }); onChange(''); }
    catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
    finally { setBusy(false); }
  };
  const saved = !!courseIdx && !!value && value === savedValue;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
      {value ? (kind === 'img'
        ? <img src={`${fileBase ?? '/upload/Course/'}${value}`} alt={value} title={value} style={{ width: 150, maxHeight: 120, objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        : saved ? <a href="#download" className="mono" style={{ fontSize: 12 }} onClick={(e) => { e.preventDefault(); void cp.downloadCourseFile(courseIdx!, slot, value).catch(() => toast(tr('파일을 내려받지 못했습니다.', 'Download failed.'), { tone: 'danger' })); }}><b>{value}</b></a> : <b className="mono" style={{ fontSize: 12 }}>{value}</b>)
        : <span className="muted" style={{ fontSize: 12 }}>{adm.common.none}</span>}
      {value && kind === 'img' ? <span className="mono" style={{ fontSize: 11 }}>{value}</span> : null}
      {value ? <AButton size="xs" disabled={disabled || busy} onClick={() => void remove()}>{tr('파일 삭제', 'Delete file')}</AButton> : null}
      <input id={pickerId} type="file" accept={kind === 'img' ? '.jpg,.jpeg,.png,.gif' : undefined} style={{ display: 'none' }} aria-label={tr('첨부할 파일', 'File to attach')} disabled={disabled || busy}
        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void upload(file); }} />
      <AButton size="xs" disabled={disabled} loading={busy} onClick={() => document.getElementById(pickerId)?.click()}>{tr('파일 첨부', 'Attach file')}</AButton>
    </div>
  );
}
