import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type LiveCourseDetail, type LiveCourseRow, type LiveMeta } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, ACheckbox, AdminPage, AInput, ASelect, ATextarea, Callout, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { hasGrant } from '../../../../shared/auth/adminMenu';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { Multiline, ReadButtons, useFormErrors, won } from '../courses/courses-parity.shared';
import { ChapterSection } from '../courses/courses-parity.chapters';
import { AnyGrantGate, LIVE_GRANTS, LIVE_LIST, liveHref } from './shared';

const LIST = LIVE_LIST;
const TITLE = () => tr('라이브 컨텐츠 관리', 'Live contents');

/**
 * /admin/live-courses?idx=N — course_read.php?idx=..&ctype=R (read view), &mode=edit → course_write.php?mode=edit&ctype=R;
 * /admin/live-courses?idx=new → course_write.php?mode=new&ctype=R (라이브 신규 등록). LiveCoursesPage renders this screen for those
 * query params (the router registers only /admin/live-courses); a path route /admin/live-courses/:idx works as well. Backed by the
 * E-granted /admin/live-courses API, so an admin with only archive grants (E1..E8) can open, edit and delete live rows like on the old site.
 */
export default function LiveCourseDetailPage({ idx: idxProp }: { idx?: string } = {}) {
  return <AnyGrantGate grants={LIVE_GRANTS}><LiveCourseScreen idxProp={idxProp} /></AnyGrantGate>;
}

function LiveCourseScreen({ idxProp }: { idxProp?: string }) {
  const params = useParams();
  const idx = idxProp ?? params.idx ?? '';
  // `idx` is part of the search state so that ?idx=N survives setP({ mode }) when the screen is addressed by query params
  const [p, setP] = useSearchState({ idx: '', mode: '' });
  const navigate = useNavigate();
  const isNew = idx === 'new';
  const n = Number(idx);
  const q = useQuery({ queryKey: ['admin', 'live-course', n], queryFn: ({ signal }) => apiX.liveCourse(n, signal), enabled: !isNew && n > 0 });
  const crumbs = (last: string) => [{ label: adm.top.home, to: '/admin' }, { label: TITLE(), to: LIST }, { label: last }];
  if (isNew) {
    return (
      <AdminPage title={tr('실시간 강의실 컨텐츠 관리 등록', 'New live content')} crumbs={crumbs(tr('등록', 'New'))}>
        <LiveCourseForm onDone={(id) => navigate(liveHref.detail(id))} onCancel={() => navigate(LIST)} />
      </AdminPage>
    );
  }
  const d = q.data;
  const editing = p.mode === 'edit';
  return (
    <AdminPage title={`${tr('실시간 강의실 컨텐츠 관리', 'Live content')}${editing ? ` ${tr('수정', 'edit')}` : ''}${d ? ` · ${d.name ?? ''} (${d.lectureCode})` : ''}`} crumbs={crumbs(idx)} actions={<AButton to={LIST}>{adm.common.back}</AButton>}>
      {q.isError ? <StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} />
        : q.isPending || !d ? <Skeleton lines={10} />
          : editing ? <LiveCourseForm detail={d} onDone={() => setP({ mode: '' })} onCancel={() => setP({ mode: '' })} />
            : <LiveCourseRead d={d} onEdit={() => setP({ mode: 'edit' })} />}
    </AdminPage>
  );
}

// ====================================================================== course_read.php (ctype R)

function LiveCourseRead({ d, onEdit }: { d: LiveCourseDetail; onEdit: () => void }) {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const { admin } = useAdminSession();
  const navigate = useNavigate();
  const [testIds, setTestIds] = useState(false);
  const [del, setDel] = useState(false);
  // course_script.php mode=del → back to the live list (not the generic ctype=R course list)
  const remove = useAdminMutation({ fn: () => apiX.deleteLiveCourse(d.idx), invalidate: [['admin', 'live-courses'], ['admin', 'live-course', d.idx]], success: tr('처리되었습니다.', 'Done.'), onSuccess: () => navigate(LIST) });
  const img = (f: string | null | undefined) => (f ? <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}><img src={`${d.fileBase}${f}`} alt="" style={{ maxHeight: 100, maxWidth: 160 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /><span className="mono" style={{ fontSize: 11 }}>{f}</span></span> : null);
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
    [tr('관심분야', 'Interests'), d.keyword3Names.map((x) => `#${x}`).join(' ')],
    [tr('역량', 'Competencies'), d.keyword4Names.map((x) => `#${x}`).join(' ')],
    [tr('차시수', 'Chapters'), d.chapterLabel],
    [tr('컨텐츠 제작연도기간', 'Production period'), `${d.contentsStart} ~ ${d.contentsEnd}`],
    [tr('컨텐츠 업로드 일자', 'Uploaded'), d.uploadDate],
    [tr('교강사', 'Instructor'), d.professor ?? ''],
    [tr('수료기준', 'Pass rule'), tr(`${d.passTime} 시간 이상`, `≥ ${d.passTime} h`)],
    [tr('모바일 지원', 'Mobile'), d.mobileLabel],
    [tr('교재비', 'Textbook price'), won(d.bookPrice)],
    [tr('교육비용', 'Price'), <>{won(d.prices.normal)} | <b>{tr('환급비용', 'Refund')}</b> : {tr('우선지원', 'Priority')} {won(d.prices.priority)} / {tr('대규모 1000인 미만', 'Large <1000')} {won(d.prices.large1)} / {tr('대규모 1000인 이상', 'Large ≥1000')} {won(d.prices.large2)}</>],
    [tr('학습자료 등록', 'Study material'), d.attachFile ? <span className="mono">{d.attachFile}</span> : ''],
    [tr('과정 이미지', 'Course image'), img(d.previewImage)],
    [tr('교재 이미지', 'Textbook image'), img(d.bookImage)],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canWrite ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
          <a href="#test-ids" onClick={(e) => { e.preventDefault(); setTestIds(true); }}>{tr(`[등록된 심사용 테스트 아이디 ${d.testIdCount}건 보기]`, `[View ${d.testIdCount} review test IDs]`)}</a>
          <AButton size="sm" disabled title={tr('테스트 아이디 생성은 가짜 진도(Progress 100%, 학습시간 1800초) 행을 만들기 때문에 기존 사이트에서만 합니다.', 'Creating test IDs writes synthetic progress rows (100%, 1800 s), so it stays on the previous site.')}>{tr('심사용 테스트 아이디 생성', 'Create review test IDs')}</AButton>
        </div>
      ) : null}
      <Card title={tr('실시간 강의실 컨텐츠 정보', 'Live content information')}>
        <DescList cols={2} items={rows} />
      </Card>
      <Card title={tr('과정소개 · 교육대상 · 교육목표', 'Intro · audience · goals')}>
        <DescList items={[[tr('과정소개', 'Introduction'), <Multiline text={d.intro} />], [tr('교육대상', 'Audience'), <Multiline text={d.eduTarget} />], [tr('교육목표', 'Goals'), <Multiline text={d.eduGoal} />]]} />
      </Card>
      <ReadButtons
        left={canWrite ? <AButton variant="danger" onClick={() => setDel(true)}>{tr('컨텐츠 삭제', 'Delete')}</AButton> : null}
        center={canWrite ? <AButton variant="primary" onClick={onEdit} title={readOnlyTitle}>{tr('컨텐츠 수정', 'Edit')}</AButton> : null}
        right={<AButton to={LIST}>{tr('목록', 'List')}</AButton>} />
      {/* course_read.php loads course_read_list.php (차시 구성) when Chapter != "0" for any logged-in admin. A 컨텐츠관리 (D1) admin gets the
          full editor (추가/수정/삭제/정렬 on the D1 chapter API); an archive-only admin sees the same rows from the E-granted live endpoint. */}
      {d.chapter !== '0' ? (hasGrant(admin, 'D1') ? <ChapterSection lectureCode={d.lectureCode} contentsName={d.name} chapterCount={d.chapter} /> : <LiveChapterList idx={d.idx} chapterCount={d.chapter} />) : null}
      {testIds ? <TestIdsDrawer idx={d.idx} lectureCode={d.lectureCode} onClose={() => setTestIds(false)} /> : null}
      <ConfirmDialog open={del} tone="danger" title={tr('컨텐츠 삭제', 'Delete content')} body={<p>{tr('현재 컨텐츠를 삭제하시겠습니까? (Del=Y로 표시되고 수강 기록은 남습니다)', 'Delete this content? (marked Del=Y; enrollments stay)')}</p>} loading={remove.isPending} onCancel={() => setDel(false)} onConfirm={() => remove.mutate()} />
    </div>
  );
}

/**
 * course_read_list.php for an admin without 컨텐츠관리 (D1): the 차시 구성 table (차시 순서 · 차시 유형 · 차시명 / 질문 · 하부 컨텐츠수 / 문항수)
 * and the "☆ 차시수 오류" notice, read from GET /admin/live-courses/:idx/chapters (E grants). Editing chapters needs the D1 screens.
 */
function LiveChapterList({ idx, chapterCount }: { idx: number; chapterCount: string | null | undefined }) {
  const q = useQuery({ queryKey: ['admin', 'live-course', idx, 'chapters'], queryFn: ({ signal }) => apiX.liveChapters(idx, signal) });
  type Row = NonNullable<typeof q.data>[number];
  const lectureRows = (q.data ?? []).filter((r) => r.chapterType === 'A').length;
  const mismatch = !!q.data && chapterCount !== undefined && chapterCount !== null && String(chapterCount) !== String(lectureRows);
  const cols: Column<Row>[] = [
    { key: 'order', header: tr('차시 순서', 'Order'), align: 'center', width: 70 },
    { key: 'typeLabel', header: tr('차시 유형', 'Type'), align: 'center', width: 100, render: (r) => r.typeLabel },
    { key: 'listTitle', header: tr('차시명 / 질문', 'Title / question'), render: (r) => r.listTitle ?? r.title ?? <span className="muted">{String(r.subIdx ?? '')}</span> },
    { key: 'subCount', header: tr('하부 컨텐츠수 / 문항수', 'Pages / items'), align: 'center', width: 150, render: (r) => <>{r.subCount ?? ''}{r.deleted ? <span className="muted"> ({tr('삭제된 기초차시', 'deleted content')})</span> : null}</> },
  ];
  return (
    <Card title={tr('차시 구성', 'Chapters')}>
      {mismatch ? <Callout tone="warn">{tr('☆ 차시수 오류 : 차시구성에 등록된 차시수가 강의정보와 일치하지 않습니다.', '☆ Chapter count mismatch: the chapters registered here do not match the course information.')} ({tr('강의정보', 'course')} {chapterCount} / {tr('차시구성', 'chapters')} {lectureRows})</Callout> : null}
      <DataTable columns={cols} rows={q.data} rowKey={(r) => r.chapterSeq} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={tr('차시 구성 내역이 없습니다.', 'No chapters.')} emptyBody=" " />
      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{tr('차시 추가·수정·삭제·정렬은 컨텐츠관리(D1) 권한이 있는 관리자 화면에서 합니다.', 'Adding, editing, deleting or reordering chapters needs the 컨텐츠관리 (D1) grant.')}</p>
    </Card>
  );
}

/** course_testid_view.php */
function TestIdsDrawer({ idx, lectureCode, onClose }: { idx: number; lectureCode: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'live-course', idx, 'test-ids'], queryFn: ({ signal }) => apiX.liveTestIds(idx, signal) });
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

// ====================================================================== course_write.php (ctype R)

export type LiveForm = {
  LectureCode: string; ClassGrade: string; UseYN: string; ContentsURLSelect: string; NcsCode: string; PackageLectureCode: string; HrdSeq: string; Category1: string; Category2: string; ContentsName: string; LegalEduReq: string;
  Keyword1: string; Keyword2: string; Keyword3: number[]; Keyword4: number[]; Chapter: string; ContentsTime: string; ContentsStart: string; ContentsEnd: string; UploadDate: string; Professor: string; PassTime: string;
  Price: string; Price01View: string; Price02View: string; Price03View: string; Mobile: string; BookPrice: string; attachFile: string; PreviewImage: string; BookImage: string; Intro: string; EduTarget: string; EduGoal: string;
};
export const EMPTY_LIVE_FORM: LiveForm = {
  LectureCode: '', ClassGrade: 'A', UseYN: 'Y', ContentsURLSelect: 'A', NcsCode: '', PackageLectureCode: '', HrdSeq: '', Category1: '', Category2: '', ContentsName: '', LegalEduReq: 'N', Keyword1: '', Keyword2: '', Keyword3: [], Keyword4: [],
  Chapter: '', ContentsTime: '', ContentsStart: '', ContentsEnd: '', UploadDate: '', Professor: '', PassTime: '', Price: '', Price01View: '', Price02View: '', Price03View: '', Mobile: 'Y', BookPrice: '', attachFile: '', PreviewImage: '', BookImage: '', Intro: '', EduTarget: '', EduGoal: '',
};
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const noZero = (v: unknown) => (s(v) === '0' ? '' : s(v));
export function liveFormFromDetail(d: LiveCourseDetail): LiveForm {
  return {
    LectureCode: d.lectureCode, ClassGrade: s(d.classGrade) || 'A', UseYN: s(d.useYN) || 'Y', ContentsURLSelect: s(d.contentsUrlSelect) || 'A', NcsCode: s(d.ncsCode), PackageLectureCode: s(d.packageLectureCode), HrdSeq: s(d.hrdSeq),
    Category1: noZero(d.category1), Category2: noZero(d.category2), ContentsName: s(d.name), LegalEduReq: s(d.legalEduReq).toUpperCase() === 'Y' ? 'Y' : 'N', Keyword1: s(d.keyword1), Keyword2: s(d.keyword2), Keyword3: d.keyword3Ids, Keyword4: d.keyword4Ids,
    Chapter: s(d.chapter), ContentsTime: s(d.contentsTime), ContentsStart: d.contentsStart, ContentsEnd: d.contentsEnd, UploadDate: d.uploadDate, Professor: s(d.professor), PassTime: s(d.passTime), Price: s(d.prices.normal), Price01View: s(d.prices.priority),
    Price02View: s(d.prices.large1), Price03View: s(d.prices.large2), Mobile: s(d.mobile) || 'N', BookPrice: s(d.bookPrice), attachFile: s(d.attachFile), PreviewImage: s(d.previewImage), BookImage: s(d.bookImage), Intro: s(d.intro), EduTarget: s(d.eduTarget), EduGoal: s(d.eduGoal),
  };
}

/**
 * SubmitOk() of course_write.php with ctype == "R": 과정코드 (new), 과정명, 교육시간 (+ numeric), 시작일, 만료일, 업로드일 — in that order and with
 * the same messages. 관심분야 / 역량 / 과정분류 / 난이도 / 직무분야 / 차시수 are skipped for R exactly like the PHP.
 */
export function validateLiveForm(f: LiveForm, isNew: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (isNew) {
    if (!f.LectureCode) e.LectureCode = '과정코드를 입력하세요.';
    else if (f.LectureCode.length < 4 || f.LectureCode.length > 10) e.LectureCode = '과정코드는 영문 대문자, 숫자로 4자 이상, 10자 이하로 입력하세요.';
    else if (!/^[A-Z0-9]+$/.test(f.LectureCode)) e.LectureCode = '과정코드는 영문 대문자, 숫자로 입력하세요.';
  }
  if (!f.ContentsName.trim()) e.ContentsName = '과정명을 입력하세요.';
  if (f.Chapter && !/^\d+$/.test(f.Chapter)) e.Chapter = '차시수는 숫자만 입력하세요.';
  if (!f.ContentsTime) e.ContentsTime = '교육시간을 입력하세요.';
  else if (!/^\d+$/.test(f.ContentsTime)) e.ContentsTime = '교육시간은 숫자만 입력하세요.';
  if (!f.ContentsStart) e.ContentsStart = '컨텐츠 시작일을 입력하세요.';
  if (!f.ContentsEnd) e.ContentsEnd = '콘텐츠 만료일을 입력하세요.';
  if (!f.UploadDate) e.UploadDate = '콘텐츠 업로드일을 입력하세요.';
  for (const k of ['PassTime', 'Price', 'Price01View', 'Price02View', 'Price03View', 'BookPrice'] as const) if (f[k] && !/^\d+$/.test(f[k])) e[k] = '숫자만 입력하세요.';
  return e;
}

/** Body of POST/PATCH /admin/live-courses (the PHP form posts every field; ServiceType is fixed to R by the API). */
export function liveCourseBody(f: LiveForm, isNew: boolean): Record<string, unknown> {
  const idxOrEmpty = (v: string) => (v === '' ? '' : Number(v));
  const b: Record<string, unknown> = {
    ClassGrade: f.ClassGrade, UseYN: f.UseYN, ContentsURLSelect: f.ContentsURLSelect, NcsCode: f.NcsCode, PackageLectureCode: f.PackageLectureCode, HrdSeq: f.HrdSeq, Category1: idxOrEmpty(f.Category1), Category2: idxOrEmpty(f.Category2),
    ContentsName: f.ContentsName.trim(), LegalEduReq: f.LegalEduReq, Keyword1: idxOrEmpty(f.Keyword1), Keyword2: idxOrEmpty(f.Keyword2), Keyword3: f.Keyword3, Keyword4: f.Keyword4, Chapter: f.Chapter, ContentsTime: f.ContentsTime,
    ContentsStart: f.ContentsStart, ContentsEnd: f.ContentsEnd, UploadDate: f.UploadDate, Professor: f.Professor, PassTime: f.PassTime, Price: f.Price, Price01View: f.Price01View, Price02View: f.Price02View, Price03View: f.Price03View,
    Mobile: f.Mobile, BookPrice: f.BookPrice, attachFile: f.attachFile, PreviewImage: f.PreviewImage, BookImage: f.BookImage, Intro: f.Intro, EduTarget: f.EduTarget, EduGoal: f.EduGoal,
  };
  if (isNew) b.LectureCode = f.LectureCode;
  return b;
}

function CheckList({ items, value, onChange, max, disabled }: { items: { idx: number; name?: string | null }[]; value: number[]; onChange: (v: number[]) => void; max: number; disabled?: boolean }) {
  const { toast } = useToast();
  if (!items.length) return <span className="muted" style={{ fontSize: 13 }}>{tr('등록된 항목이 없습니다 (역량진단 문항관리 aBind col3/col4).', 'No options (ArchiveQuestion col3/col4).')}</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {items.map((it) => <ACheckbox key={it.idx} label={it.name ?? String(it.idx)} checked={value.includes(it.idx)} disabled={disabled} onChange={(e) => {
        if (e.target.checked && value.length >= max) { toast(tr(`최대 ${max}개까지만 선택할 수 있습니다.`, `Up to ${max}.`), { tone: 'danger' }); return; }
        onChange(e.target.checked ? [...value, it.idx] : value.filter((x) => x !== it.idx));
      }} />)}
    </div>
  );
}

export function LiveCourseForm({ detail, onDone, onCancel }: { detail?: LiveCourseDetail; onDone: (idx: number) => void; onCancel: () => void }) {
  const isNew = !detail;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const qc = useQueryClient();
  const meta = useQuery({ queryKey: ['admin', 'live-courses', 'meta'], queryFn: ({ signal }) => apiX.liveMeta(signal), staleTime: 5 * 60_000 });
  const [f, setF] = useState<LiveForm>(detail ? liveFormFromDetail(detail) : EMPTY_LIVE_FORM);
  useEffect(() => { if (detail) setF(liveFormFromDetail(detail)); }, [detail]);
  const { errors, setErrors, onError } = useFormErrors();
  const [copy, setCopy] = useState(false);
  const set = (p: Partial<LiveForm>) => setF((x) => ({ ...x, ...p }));
  const m: LiveMeta | undefined = meta.data;
  const cat2 = useMemo(() => m?.categories.find((c) => String(c.idx) === f.Category1)?.children ?? [], [m, f.Category1]);
  const save = useAdminMutation({
    fn: (b: Record<string, unknown>) => (isNew ? apiX.createLiveCourse(b) : apiX.patchLiveCourse(detail!.idx, b)),
    invalidate: [['admin', 'live-courses'], ['admin', 'live-course']], success: tr('처리되었습니다.', 'Saved.'),
    onSuccess: (r) => onDone(isNew ? Number((r as { idx?: number }).idx) : detail!.idx), onError,
  });
  const submit = () => {
    const e = validateLiveForm(f, isNew);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!window.confirm(isNew ? tr('등록 하시겠습니까?', 'Register?') : tr('수정 하시겠습니까?', 'Save changes?'))) return;
    save.mutate(liveCourseBody(f, isNew));
  };
  /** course_copy_apply.php: the fields it copies (과정코드 is never copied). */
  const applyCopy = async (idx: number) => {
    const d = await qc.fetchQuery({ queryKey: ['admin', 'live-course', idx], queryFn: ({ signal }) => apiX.liveCourse(idx, signal) });
    const x = liveFormFromDetail(d);
    set({ ClassGrade: x.ClassGrade, UseYN: x.UseYN, Category1: x.Category1, Category2: x.Category2, ContentsName: x.ContentsName, Chapter: x.Chapter, ContentsTime: x.ContentsTime, Mobile: x.Mobile, BookPrice: x.BookPrice, attachFile: x.attachFile, PreviewImage: x.PreviewImage, BookImage: x.BookImage, Intro: x.Intro, EduTarget: x.EduTarget, EduGoal: x.EduGoal });
    setCopy(false);
  };
  const dis = !canWrite;
  const num = (k: keyof LiveForm, w = 110, max = 7) => <AInput id={`lf-${k}`} value={f[k] as string} onChange={(e) => set({ [k]: e.target.value } as Partial<LiveForm>)} maxLength={max} style={{ width: w, textAlign: 'right' }} disabled={dis} invalid={!!errors[k]} />;
  const yn = [{ value: 'Y', label: tr('사용', 'In use') }, { value: 'N', label: tr('미사용', 'Not used') }];
  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 } as const;
  const ncsOptions = [{ value: '', label: tr('선택 안함 (미지정)', 'None') }, ...(m?.ncsCodes ?? []), ...(f.NcsCode && !(m?.ncsCodes ?? []).some((o) => o.value === f.NcsCode) ? [{ value: f.NcsCode, label: f.NcsCode }] : [])];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isNew && canWrite ? <div style={{ display: 'flex', justifyContent: 'flex-end' }}><AButton variant="primary" onClick={() => setCopy(true)}>{tr('컨텐츠 정보 가져오기', 'Copy from existing content')}</AButton></div> : null}
      <Card title={tr(`실시간 강의실 컨텐츠 관리 ${isNew ? '등록' : '수정'}`, isNew ? 'New live content' : 'Edit live content')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={grid2}>
            <FieldRow label={tr('등급 / 과정코드', 'Grade / code')} htmlFor="lf-LectureCode" required error={errors.LectureCode}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 110 }}><ASelect aria-label={tr('등급', 'Grade')} value={f.ClassGrade} onChange={(e) => set({ ClassGrade: e.target.value })} options={m?.classGrades ?? [{ value: 'A', label: 'A등급' }, { value: 'B', label: 'B등급' }, { value: 'C', label: 'C등급' }]} disabled={dis} /></div>
                /{isNew ? <AInput id="lf-LectureCode" value={f.LectureCode} onChange={(e) => set({ LectureCode: e.target.value.toUpperCase() })} maxLength={10} style={{ width: 140 }} disabled={dis} invalid={!!errors.LectureCode} /> : <b className="mono">{f.LectureCode}</b>}
              </div>
            </FieldRow>
            <FieldRow label={tr('사이트노출 / 컨텐츠 경로', 'Visible / path')}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 110 }}><ASelect aria-label={tr('사이트노출', 'Visible')} value={f.UseYN} onChange={(e) => set({ UseYN: e.target.value })} options={yn} disabled={dis} /></div>
                <label><input type="radio" name="lf-url" checked={f.ContentsURLSelect === 'A'} onChange={() => set({ ContentsURLSelect: 'A' })} disabled={dis} /> {tr('주 경로', 'Main')}</label>
                <label><input type="radio" name="lf-url" checked={f.ContentsURLSelect === 'B'} onChange={() => set({ ContentsURLSelect: 'B' })} disabled={dis} /> {tr('예비 경로', 'Backup')}</label>
              </div>
            </FieldRow>
          </div>
          <FieldRow label={tr('NCS 분류 (선택)', 'NCS code (optional)')} htmlFor="lf-NcsCode" help={m && !m.ncsColumn ? tr('목록에서 선택(선택 사항). 현재 DB의 Course 테이블에 NcsCode 열이 없어 기존 사이트와 같이 저장되지 않습니다.', 'Optional. The Course table has no NcsCode column, so — like the previous site — it is not stored.') : tr('목록에서 선택(선택 사항).', 'Optional.')}>
            <div style={{ maxWidth: 420 }}><ASelect id="lf-NcsCode" value={f.NcsCode} onChange={(e) => set({ NcsCode: e.target.value })} options={ncsOptions} disabled={dis} /></div>
          </FieldRow>
          <div style={grid2}>
            <FieldRow label={tr('패키지콘텐츠 과정코드', 'Package course codes')} htmlFor="lf-PackageLectureCode"><AInput id="lf-PackageLectureCode" value={f.PackageLectureCode} onChange={(e) => set({ PackageLectureCode: e.target.value })} disabled={dis} /></FieldRow>
            <FieldRow label={tr('원격훈련일련번호', 'Remote-training serial')} htmlFor="lf-HrdSeq"><AInput id="lf-HrdSeq" value={f.HrdSeq} onChange={(e) => set({ HrdSeq: e.target.value })} maxLength={100} disabled={dis} /></FieldRow>
            <FieldRow label={tr('과정분류', 'Category')}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><ASelect aria-label={tr('대분류', 'Main')} value={f.Category1} onChange={(e) => set({ Category1: e.target.value, Category2: '' })} options={[{ value: '', label: tr('-- 대분류 선택 --', '-- main --') }, ...(m?.categories ?? []).map((c) => ({ value: String(c.idx), label: c.name ?? '' }))]} disabled={dis} /></div>
                {f.Category1 ? <div style={{ flex: 1 }}><ASelect aria-label={tr('중분류', 'Sub')} value={f.Category2} onChange={(e) => set({ Category2: e.target.value })} options={[{ value: '', label: tr('-- 소분류 선택 --', '-- sub --') }, ...cat2.map((c) => ({ value: String(c.idx), label: c.name ?? '' }))]} disabled={dis} /></div> : null}
              </div>
            </FieldRow>
            <FieldRow label={tr('서비스 구분', 'Service type')}><div style={{ paddingTop: 6 }}>{tr('실시간 강의실', 'Live classroom')}</div></FieldRow>
            <FieldRow label={tr('과정명', 'Course name')} htmlFor="lf-ContentsName" required error={errors.ContentsName}><AInput id="lf-ContentsName" value={f.ContentsName} onChange={(e) => set({ ContentsName: e.target.value })} maxLength={120} disabled={dis} invalid={!!errors.ContentsName} /></FieldRow>
            <FieldRow label={tr('법정교육여부', 'Mandatory training')}>
              <div style={{ display: 'flex', gap: 12, paddingTop: 6 }}>
                <label><input type="radio" name="lf-legal" checked={f.LegalEduReq === 'Y'} onChange={() => set({ LegalEduReq: 'Y' })} disabled={dis} /> {tr('예', 'Yes')}</label>
                <label><input type="radio" name="lf-legal" checked={f.LegalEduReq === 'N'} onChange={() => set({ LegalEduReq: 'N' })} disabled={dis} /> {tr('아니오', 'No')}</label>
              </div>
            </FieldRow>
            <FieldRow label={tr('난이도(직급)', 'Level (rank)')}><ASelect aria-label={tr('난이도(직급)', 'Level')} value={f.Keyword1} onChange={(e) => set({ Keyword1: e.target.value })} options={[{ value: '', label: tr('선택', 'Select') }, ...(m?.keyword1 ?? []).map((k) => ({ value: String(k.idx), label: k.name ?? '' }))]} disabled={dis} /></FieldRow>
            <FieldRow label={tr('직무분야', 'Job field')}><ASelect aria-label={tr('직무분야', 'Job field')} value={f.Keyword2} onChange={(e) => set({ Keyword2: e.target.value })} options={[{ value: '', label: tr('선택', 'Select') }, ...(m?.keyword2 ?? []).map((k) => ({ value: String(k.idx), label: k.name ?? '' }))]} disabled={dis} /></FieldRow>
          </div>
          <FieldRow label={tr('관심분야 (최대 3개)', 'Interests (max 3)')}><CheckList items={m?.keyword3 ?? []} value={f.Keyword3} onChange={(v) => set({ Keyword3: v })} max={3} disabled={dis} /></FieldRow>
          <FieldRow label={tr('역량 (최대 3개)', 'Competencies (max 3)')}><CheckList items={m?.keyword4 ?? []} value={f.Keyword4} onChange={(v) => set({ Keyword4: v })} max={3} disabled={dis} /></FieldRow>
          <div style={grid2}>
            <FieldRow label={tr('차시수', 'Chapters')} htmlFor="lf-Chapter" error={errors.Chapter}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{num('Chapter', 80, 3)} {tr('차시', '')}</span></FieldRow>
            <FieldRow label={tr('교육시간', 'Duration')} htmlFor="lf-ContentsTime" required error={errors.ContentsTime}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{num('ContentsTime', 80, 3)} {tr('분', 'min')}</span></FieldRow>
            <FieldRow label={tr('컨텐츠 제작연도 기간', 'Production period')} required error={errors.ContentsStart || errors.ContentsEnd}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><AInput type="date" aria-label={tr('시작일', 'Start')} value={f.ContentsStart} onChange={(e) => set({ ContentsStart: e.target.value })} disabled={dis} /> ~ <AInput type="date" aria-label={tr('만료일', 'End')} value={f.ContentsEnd} onChange={(e) => set({ ContentsEnd: e.target.value })} disabled={dis} /></span>
            </FieldRow>
            <FieldRow label={tr('컨텐츠 업로드 일자', 'Upload date')} htmlFor="lf-UploadDate" required error={errors.UploadDate}><AInput id="lf-UploadDate" type="date" value={f.UploadDate} onChange={(e) => set({ UploadDate: e.target.value })} disabled={dis} /></FieldRow>
            <FieldRow label={tr('교강사', 'Instructor')} htmlFor="lf-Professor"><AInput id="lf-Professor" value={f.Professor} onChange={(e) => set({ Professor: e.target.value })} maxLength={150} disabled={dis} /></FieldRow>
            <FieldRow label={tr('수료기준', 'Pass rule')} htmlFor="lf-PassTime" error={errors.PassTime}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{num('PassTime', 80, 3)} {tr('시간 이상', 'h or more')}</span></FieldRow>
          </div>
          <FieldRow label={tr('수강비용', 'Price')} error={errors.Price || errors.Price01View || errors.Price02View || errors.Price03View}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {num('Price')} {tr('원', 'KRW')} | <b>{tr('환급비용', 'Refund')}</b> : {tr('우선지원', 'Priority')} {num('Price01View')} / {tr('대규모 1000인 미만', 'Large <1000')} {num('Price02View')} / {tr('대규모 1000인 이상', 'Large ≥1000')} {num('Price03View')}
            </div>
          </FieldRow>
          <div style={grid2}>
            <FieldRow label={tr('모바일 지원', 'Mobile')}><div style={{ width: 120 }}><ASelect aria-label={tr('모바일 지원', 'Mobile')} value={f.Mobile} onChange={(e) => set({ Mobile: e.target.value })} options={yn} disabled={dis} /></div></FieldRow>
            <FieldRow label={tr('교재비', 'Textbook price')} htmlFor="lf-BookPrice" error={errors.BookPrice}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{num('BookPrice', 110, 6)} {tr('원', 'KRW')}</span></FieldRow>
            <FieldRow label={tr('학습자료 등록', 'Study material')}><div className="mono" style={{ paddingTop: 6, fontSize: 12 }}>{f.attachFile || <span className="muted">{adm.common.none}</span>}</div></FieldRow>
            <FieldRow label={tr('과정 이미지', 'Course image')}><div className="mono" style={{ paddingTop: 6, fontSize: 12 }}>{f.PreviewImage || <span className="muted">{adm.common.none}</span>}</div></FieldRow>
            <FieldRow label={tr('교재 이미지', 'Textbook image')}><div className="mono" style={{ paddingTop: 6, fontSize: 12 }}>{f.BookImage || <span className="muted">{adm.common.none}</span>}</div></FieldRow>
          </div>
          <Callout>{tr('학습자료·과정 이미지·교재 이미지의 파일 첨부/삭제는 서버 업로드 폴더를 쓰므로 아직 기존 사이트에서 합니다. 여기서는 저장된 파일명이 그대로 유지됩니다.', 'File upload/delete for material and images writes the server upload folder, so it still runs on the previous site. Stored file names are kept as they are.')}</Callout>
          <FieldRow label={tr('과정소개', 'Introduction')} htmlFor="lf-Intro"><ATextarea id="lf-Intro" rows={7} value={f.Intro} onChange={(e) => set({ Intro: e.target.value })} disabled={dis} /></FieldRow>
          <FieldRow label={tr('교육대상', 'Audience')} htmlFor="lf-EduTarget"><ATextarea id="lf-EduTarget" rows={7} value={f.EduTarget} onChange={(e) => set({ EduTarget: e.target.value })} disabled={dis} /></FieldRow>
          <FieldRow label={tr('교육목표', 'Goals')} htmlFor="lf-EduGoal"><ATextarea id="lf-EduGoal" rows={7} value={f.EduGoal} onChange={(e) => set({ EduGoal: e.target.value })} disabled={dis} /></FieldRow>
        </div>
      </Card>
      <ReadButtons center={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{isNew ? tr('등록', 'Register') : tr('수정', 'Save')}</AButton>} right={<AButton onClick={onCancel}>{tr('목록', 'List')}</AButton>} />
      {copy ? <CopyPicker onPick={(idx) => void applyCopy(idx)} onClose={() => setCopy(false)} /> : null}
    </div>
  );
}

/** course_copy.php for ctype R — Del=N, ctype=R, PackageYN=N (no ServiceType filter), 10 per page. */
function CopyPicker({ onPick, onClose }: { onPick: (idx: number) => void; onClose: () => void }) {
  const [q, setQ] = useState(''); const [applied, setApplied] = useState(''); const [pg, setPg] = useState(1);
  const query = { scope: 'copy', col: 'ContentsName', q: applied || undefined, page: pg, size: 10 };
  const list = useQuery({ queryKey: ['admin', 'live-courses', 'copy', query], queryFn: ({ signal }) => apiX.liveCourses(query, signal), placeholderData: keepPreviousData });
  const cols: Column<LiveCourseRow>[] = [
    { key: 'lectureCode', header: <>{tr('등급', 'Grade')}<br />{tr('과정 코드', 'Code')}</>, render: (r) => <>{r.classGradeLabel}<br /><b className="mono">{r.lectureCode}</b></> },
    { key: 'courseName', header: <>{tr('과정 분류', 'Category')}<br />{tr('과정명', 'Name')}</>, render: (r) => <><span className="muted">{r.category}</span><br />{r.courseName}</> },
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
