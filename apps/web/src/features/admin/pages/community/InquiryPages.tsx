import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminSupportParityApi, COUNSEL_CATEGORIES, REVEAL_GUBUN, SUPPORT_STATUSES,
  type CheatingRow, type CounselRow, type InquiryRow,
} from '../../../../shared/api/endpoints/admin-support-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, ACheckbox, AdminPage, AInput, ASelect, Callout, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { PHP_PAGE_SIZE, nl2br, revealReasonError, rowNo, statusChecks, statusFilterOf, toEditorHtml, tooShort } from './support-parity.helpers';
import { SupportRichEditor } from './SupportRichEditor';
import { SupportSubmitConfirm, useSubmitConfirm } from './SupportSubmitConfirm';

/** include_top.php $page_size = 30 for inquiry.php, qna.php and cheating_report.php (each page keeps its own constant). */
const INQUIRY_SIZE = PHP_PAGE_SIZE;
const COUNSEL_SIZE = PHP_PAGE_SIZE;
const CHEATING_SIZE = PHP_PAGE_SIZE;
const DONE = () => tr('처리되었습니다.', 'Done.');
const box = { whiteSpace: 'normal' as const, fontSize: 13, lineHeight: 1.6, padding: 12, background: 'var(--c-soft)', borderRadius: 6 };
const Html = ({ html }: { html: string | null | undefined }) => <div style={box} dangerouslySetInnerHTML={{ __html: html ?? '' }} />;
const Section = ({ title, children }: { title: ReactNode; children: ReactNode }) => <Card title={title}>{children}</Card>;
const statusOptions = SUPPORT_STATUSES.map((s) => ({ value: s.value, label: s.label }));

// ---------------------------------------------------------------- /admin/inquiries — inquiry.php (수강신청관리, E7)
export function InquiriesPage() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [p, setP, reset] = useSearchState({ col: 'CompanyName', q: '', page: 1 });
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: INQUIRY_SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'inquiries', query], queryFn: ({ signal }) => adminSupportParityApi.inquiries(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const [sel, setSel] = useState<number | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'inquiry', sel], queryFn: ({ signal }) => adminSupportParityApi.inquiry(sel!, signal), enabled: sel !== null });
  const d = detail.data;
  const [ans, setAns] = useState<{ Status: 'A' | 'B'; Name2: string; Contents2: string }>({ Status: 'A', Name2: '', Contents2: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (d) setAns({ Status: d.status === 'B' ? 'B' : 'A', Name2: d.answer.name ?? '', Contents2: toEditorHtml(d.answer.contents) }); setErrors({}); }, [d]);
  const inv = [['admin', 'inquiries'], ['admin', 'inquiry'], ['admin', 'dashboard']];
  const firstAnswer = !d?.answer.regDate;
  const save = useAdminMutation({ fn: () => adminSupportParityApi.answerInquiry(sel!, { Status: ans.Status, Contents2: ans.Contents2, ...(firstAnswer ? { Name2: ans.Name2.trim() } : {}) }), invalidate: inv, success: DONE(), onSuccess: () => setSel(null) });
  const [delOpen, setDelOpen] = useState(false);
  const remove = useAdminMutation({ fn: () => adminSupportParityApi.deleteInquiry(sel!), invalidate: inv, success: DONE(), onSuccess: () => { setDelOpen(false); setSel(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (firstAnswer && !ans.Name2.trim()) e.Name2 = tr('작성자를 입력하세요.', 'Enter the author.');
    if (tooShort(ans.Contents2)) e.Contents2 = tr('답변 내용을 15자 이상 입력해주세요', 'Enter at least 15 characters.');
    setErrors(e); if (!Object.keys(e).length) confirmSave.ask(); // inquiry_read.php SubmitOk(): confirm("등록하시겠습니까?")
  };
  const confirmSave = useSubmitConfirm();
  const columns: Column<InquiryRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 80, render: (_r, i) => rowNo(total, p.page, INQUIRY_SIZE, i) },
    { key: 'serviceTypeLabel', header: tr('문의종류', 'Type'), width: 150, render: (r) => r.serviceTypeLabel || r.serviceType || '' },
    { key: 'companyName', header: tr('회사명', 'Company'), render: (r) => <b>{r.companyName ?? ''}</b> },
    { key: 'name', header: tr('문의자 이름', 'Name'), render: (r) => r.name ?? '' },
    { key: 'regDate', header: tr('문의일', 'Received'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'statusLabel', header: tr('처리상태', 'Status'), align: 'center', render: (r) => r.statusLabel },
  ];
  return (
    <AdminPage title={tr('수강신청관리', 'Enrolment requests')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'CompanyName', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="iq-col" width={140}><ASelect id="iq-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'CompanyName', label: tr('회사명', 'Company') }, { value: 'Name', label: tr('문의자 이름', 'Name') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="iq-q" width={300}><AInput id="iq-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={INQUIRY_SIZE} total={total} onPageChange={(x) => setP({ page: x })} onRowClick={(r) => setSel(r.idx)} selectedKey={sel} emptyTitle={tr('등록된 내용이 없습니다.', 'Nothing registered.')} dense />
      <DetailDrawer open={sel !== null} onClose={() => setSel(null)} title={tr('수강신청관리', 'Enrolment request')} subtitle={d ? `${d.companyName ?? ''} · ${d.name ?? ''}` : ''} wide
        footer={<><AButton variant="danger" disabled={!canWrite || !d} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite || !d} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{tr('답변 하기', 'Save answer')}</AButton><AButton onClick={() => setSel(null)}>{tr('목록', 'List')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Section title={tr('문의 내용', 'Request')}>
              <DescList cols={2} items={[[tr('문의종류', 'Type'), d.serviceTypeLabel || d.serviceType], ['', null], [tr('회사명', 'Company'), d.companyName], [tr('이름', 'Name'), d.name], [tr('연락처', 'Phone'), d.phone], [tr('이메일', 'Email'), d.email], [tr('예상인원', 'Headcount'), d.personnel !== null && d.personnel !== undefined && d.personnel !== '' ? `${d.personnel}${tr('명', '')}` : null], [tr('문의일', 'Received'), d.regDate]]} />
              <h3 style={{ fontSize: 13, margin: '12px 0 6px' }}>{tr('내용', 'Content')}</h3>
              <Html html={nl2br(d.contents)} />
            </Section>
            <Section title={tr('답변', 'Answer')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={tr('처리 상태', 'Status')} htmlFor="iq-status"><ASelect id="iq-status" value={ans.Status} onChange={(e) => setAns({ ...ans, Status: e.target.value as 'A' | 'B' })} options={d.statuses.length ? d.statuses : statusOptions} disabled={!canWrite} style={{ width: 120 }} /></FieldRow>
                <FieldRow label={tr('작성자', 'Author')} htmlFor="iq-name2" required={firstAnswer} error={errors.Name2}>{firstAnswer ? <AInput id="iq-name2" value={ans.Name2} onChange={(e) => setAns({ ...ans, Name2: e.target.value })} maxLength={50} style={{ width: 240 }} disabled={!canWrite} /> : <span>{d.answer.name}</span>}</FieldRow>
                <DescList cols={2} items={[[tr('답변등록 일시', 'Answered'), d.answer.regDate || '-'], [tr('답변수정 일시', 'Edited'), d.answer.mdfDate || '-']]} />
                <FieldRow label={tr('답변 내용', 'Answer')} htmlFor="iq-answer" required error={errors.Contents2}><SupportRichEditor id="iq-answer" ariaLabel={tr('답변 내용', 'Answer')} height={320} value={ans.Contents2} onChange={(html) => setAns((x) => ({ ...x, Contents2: html }))} disabled={!canWrite} invalid={!!errors.Contents2} /></FieldRow>
              </div>
            </Section>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>
      <SupportSubmitConfirm open={confirmSave.open} loading={save.isPending} onCancel={confirmSave.close} onConfirm={() => save.mutate(undefined as never, { onSettled: confirmSave.close })} />
      <ConfirmDialog open={delOpen} title={tr('문의 삭제', 'Delete request')} body={tr('현재 글을 삭제하시겠습니까?', 'Delete this post?')} tone="danger" confirmLabel={tr('삭 제', 'Delete')} loading={remove.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => remove.mutate(undefined as never)} />
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/counsel — qna.php (1:1 상담문의 / 학습상담, F3)
export function CounselPage() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const { admin } = useAdminSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [p, setP, reset] = useSearchState({ status: '', category: '', col: 'Title', q: '', page: 1 });
  const [form, setForm] = useState({ status: p.status, category: p.category, col: p.col, q: p.q });
  const checks = statusChecks(form.status);
  const query = useMemo(() => ({ status: p.status || undefined, category: p.category || undefined, col: p.col, q: p.q || undefined, page: p.page, size: COUNSEL_SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'counsel', query], queryFn: ({ signal }) => adminSupportParityApi.counsel(query, signal), placeholderData: keepPreviousData });
  const meta = useQuery({ queryKey: ['admin', 'counsel', 'meta'], queryFn: ({ signal }) => adminSupportParityApi.counselMeta(signal) });
  const categories = meta.data?.categories ?? COUNSEL_CATEGORIES;
  const total = list.data?.total ?? 0;

  // ?open=<idx> (수강생 상세 / 학습내역 → 1:1 상담문의에서 답변하기) opens that question straight away, like qna_read.php?idx=.
  const [sel, setSel] = useState<number | null>(() => Number(new URLSearchParams(window.location.search).get('open')) || null);
  const detail = useQuery({ queryKey: ['admin', 'counsel-detail', sel], queryFn: ({ signal }) => adminSupportParityApi.counselDetail(sel!, signal), enabled: sel !== null });
  const d = detail.data;
  const [ans, setAns] = useState<{ Status: 'A' | 'B'; Name2: string; Contents2: string }>({ Status: 'A', Name2: '', Contents2: '' });
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [clear, setClear] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Partial<Record<'Mobile' | 'Email', string>>>({});
  useEffect(() => { if (d) setAns({ Status: d.status === 'B' ? 'B' : 'A', Name2: d.name2 ?? '', Contents2: toEditorHtml(d.contents2) }); setFiles({}); setClear([]); setErrors({}); }, [d]);
  useEffect(() => { setRevealed({}); }, [sel]);
  const inv = [['admin', 'counsel'], ['admin', 'counsel-detail'], ['admin', 'dashboard']];

  const save = useAdminMutation({
    fn: async () => {
      const r = await adminSupportParityApi.answerCounsel(sel!, { Status: ans.Status, Name2: ans.Name2.trim(), Contents2: ans.Contents2, clearFiles: clear });
      for (const s of [1, 2, 3, 4, 5].filter((x) => files[x])) { try { await adminSupportParityApi.uploadCounselFile(sel!, s, files[s]!); } catch (e) { toast(`${tr('첨부파일', 'Attachment')} ${s}: ${isAppError(e) ? e.message : adm.common.failed}`, { tone: 'danger' }); } }
      return r;
    },
    invalidate: inv,
    success: (r) => (r.notify && r.notify.code === 'SEND_NOT_CONFIGURED' ? tr('답변을 저장했습니다. 완료 알림톡은 발송 기록만 남겼고 실제 발송은 기존 사이트에서 진행됩니다.', 'Answer saved. The 완료 KakaoTalk was logged only; sending still runs on the previous site.') : DONE()),
    onSuccess: () => { setSel(null); void qc.invalidateQueries({ queryKey: ['admin', 'counsel'] }); },
  });
  const [delOpen, setDelOpen] = useState(false);
  const remove = useAdminMutation({ fn: () => adminSupportParityApi.deleteCounsel(sel!), invalidate: inv, success: DONE(), onSuccess: () => { setDelOpen(false); setSel(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!ans.Name2.trim()) e.Name2 = tr('작성자를 입력하세요.', 'Enter the author.');
    if (tooShort(ans.Contents2)) e.Contents2 = tr('답변 내용을 15자 이상 입력해주세요', 'Enter at least 15 characters.');
    setErrors(e); if (!Object.keys(e).length) confirmSave.ask(); // qna_read.php SubmitOk(): confirm("등록하시겠습니까?")
  };
  const confirmSave = useSubmitConfirm();

  // 개인정보 열람사유 (Information_protection_regist2.php)
  const [reveal, setReveal] = useState<'Mobile' | 'Email' | null>(null);
  const [gubun, setGubun] = useState(REVEAL_GUBUN[0]!);
  const doReveal = useAdminMutation({
    fn: (reason: string) => adminSupportParityApi.revealCounsel(sel!, { field: reveal!, gubun, reason }),
    onSuccess: (r) => { setRevealed((x) => ({ ...x, [r.field]: r.value })); setReveal(null); },
  });
  const confirmReveal = (reason: string) => { const err = revealReasonError(reason); if (err) { toast(err, { tone: 'danger' }); return; } doReveal.mutate(reason); };
  const maskedLink = (field: 'Mobile' | 'Email', masked: string | null | undefined, has: boolean) => revealed[field] ?? (has ? <AButton variant="link" size="sm" onClick={() => { setGubun(REVEAL_GUBUN[0]!); setReveal(field); }} title={tr('열람 사유를 남기고 전체 값을 봅니다', 'Log a reason to view the full value')}>{masked}</AButton> : null);

  const download = async (slot: number | 'student', name: string) => { try { await adminSupportParityApi.downloadCounselFile(sel!, slot, name); } catch (e) { toast(isAppError(e) ? e.message : adm.common.failed, { tone: 'danger' }); } };
  const exportXlsx = async () => { try { await adminSupportParityApi.downloadCounselXlsx({ status: p.status || undefined, category: p.category || undefined, col: p.col, q: p.q || undefined }); } catch (e) { toast(isAppError(e) ? e.message : adm.common.failed, { tone: 'danger' }); } };

  const wait = (r: CounselRow) => (r.status === 'A' ? { color: '#ff9700', fontWeight: 700 } : undefined);
  const columns: Column<CounselRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 70, render: (r, i) => <span style={wait(r)}>{rowNo(total, p.page, COUNSEL_SIZE, i)}</span> },
    { key: 'categoryLabel', header: tr('문의종류', 'Type'), width: 140, render: (r) => <span style={wait(r)}>{r.categoryLabel}</span> },
    { key: 'id', header: 'ID', width: 120, render: (r) => <span style={wait(r)}>{r.id ?? ''}</span> },
    { key: 'name', header: tr('이름', 'Name'), width: 100, render: (r) => <span style={wait(r)}>{r.name ?? ''}</span> },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <span style={wait(r)}>{r.title ?? ''}</span> },
    { key: 'regDate', header: tr('등록일시', 'Received'), width: 160, nowrap: true, render: (r) => <span style={wait(r)}>{r.regDate ?? ''}</span> },
    { key: 'regDate2', header: tr('답변일시', 'Answered'), width: 160, nowrap: true, render: (r) => <span style={wait(r)}>{r.regDate2}</span> },
    { key: 'statusLabel', header: tr('처리상태', 'Status'), align: 'center', width: 80, render: (r) => <span style={wait(r)}>{r.statusLabel}</span> },
  ];
  const uploadOk = d?.uploadEnabled ?? meta.data?.uploadEnabled ?? true;
  return (
    <AdminPage title={tr('1:1 상담문의 / 학습상담', '1:1 questions')} actions={<AButton icon="download" onClick={() => void exportXlsx()}>{tr('검색항목 엑셀 출력', 'Export (Excel)')}</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ status: '', category: '', col: 'Title', q: '' }); reset(); }}>
        <FilterField label={tr('처리상태', 'Status')} width={240}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 40 }}>
            <ACheckbox label={tr('전체', 'All')} checked={checks.all} onChange={() => setForm({ ...form, status: '' })} />
            <ACheckbox label={tr('대기', 'Waiting')} checked={checks.wait} onChange={(e) => setForm({ ...form, status: statusFilterOf(e.target.checked, checks.done) })} />
            <ACheckbox label={tr('완료', 'Done')} checked={checks.done} onChange={(e) => setForm({ ...form, status: statusFilterOf(checks.wait, e.target.checked) })} />
          </div>
        </FilterField>
        <FilterField label={tr('문의종류', 'Type')} htmlFor="cs-cat" width={160}><ASelect id="cs-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={[{ value: '', label: tr('전체', 'All') }, ...categories]} /></FilterField>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="cs-col" width={110}><ASelect id="cs-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Title', label: tr('제목', 'Title') }, { value: 'Contents', label: tr('내용', 'Content') }, { value: 'ID', label: 'ID' }, { value: 'Name', label: tr('이름', 'Name') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="cs-q" width={260}><AInput id="cs-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={COUNSEL_SIZE} total={total} onPageChange={(x) => setP({ page: x })} onRowClick={(r) => setSel(r.idx)} selectedKey={sel} emptyTitle={tr('등록된 내용이 없습니다.', 'Nothing registered.')} dense />

      <DetailDrawer open={sel !== null} onClose={() => setSel(null)} title={tr('1:1 상담문의 / 학습상담', '1:1 question')} subtitle={d ? `${d.categoryLabel} · ${d.id ?? ''}` : ''} wide
        footer={<><AButton variant="danger" disabled={!canWrite || !d} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite || !d} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{tr('답변 하기', 'Save answer')}</AButton><AButton onClick={() => setSel(null)}>{tr('목록', 'List')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Section title={tr('문의', 'Question')}>
              <DescList items={[
                ...(d.courseName ? ([[tr('과정명', 'Course'), d.courseName], [tr('차시명', 'Chapter'), d.contentsTitle]] as [ReactNode, ReactNode][]) : []),
                [tr('문의 제목', 'Title'), d.title], [tr('이름', 'Name'), d.name], [tr('아이디', 'User ID'), d.id],
                [tr('연락처', 'Mobile'), maskedLink('Mobile', d.mobile, d.hasMobile)], [tr('이메일', 'Email'), maskedLink('Email', d.email, d.hasEmail)],
                [tr('등록일시', 'Received'), d.regDate], [tr('답변일시', 'Answered'), d.regDate2],
                ...(d.studentFile ? ([[tr('첨부된 파일', 'Attached file'), <AButton key="sf" variant="link" size="sm" onClick={() => void download('student', d.studentFile!.realFileName)}>{d.studentFile.realFileName}</AButton>]] as [ReactNode, ReactNode][]) : []),
              ]} />
              <h3 style={{ fontSize: 13, margin: '12px 0 6px' }}>{tr('내용', 'Content')}</h3>
              <Html html={d.contents} />
            </Section>
            <Section title={tr('답변', 'Answer')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Callout>{tr('처리 상태를 대기 → 완료로 바꾸면 기존 사이트는 답변 완료 알림톡을 보냅니다. 새 콘솔은 같은 발송 기록(SmsSendLog)만 남기며, 실제 발송은 아직 기존 사이트에서 진행됩니다.', 'Switching 대기 → 완료 sends the answer KakaoTalk on the previous site. This console only writes the same SmsSendLog row; sending still runs on the previous site.')}</Callout>
                {!uploadOk ? <Callout tone="warn">{tr('첨부 파일 저장 폴더(upload/Counsel)가 이 서버에 연결되어 있지 않습니다. 파일은 기존 관리자 페이지에서 올려주세요.', 'The attachment folder (upload/Counsel) is not available here; upload files on the legacy admin page.')}</Callout> : null}
                <FieldRow label={tr('처리 상태', 'Status')} htmlFor="cs-status"><ASelect id="cs-status" value={ans.Status} onChange={(e) => setAns({ ...ans, Status: e.target.value as 'A' | 'B' })} options={meta.data?.statuses ?? statusOptions} disabled={!canWrite} style={{ width: 120 }} /></FieldRow>
                <FieldRow label={tr('작성자', 'Author')} htmlFor="cs-name2" required error={errors.Name2}><AInput id="cs-name2" value={ans.Name2} onChange={(e) => setAns({ ...ans, Name2: e.target.value })} maxLength={50} style={{ width: 240 }} disabled={!canWrite} /></FieldRow>
                {[1, 2, 3, 4, 5].map((s) => {
                  const existing = d.files.find((x) => x.slot === s);
                  return (
                    <FieldRow key={s} label={`${tr('첨부파일', 'File')} ${s}`} htmlFor={`cs-file-${s}`} help={existing ? <span><AButton variant="link" size="sm" onClick={() => void download(s, existing.realFileName)}>{existing.realFileName}</AButton> <label style={{ marginLeft: 8 }}><input type="checkbox" checked={clear.includes(s)} onChange={(e) => setClear(e.target.checked ? [...clear, s] : clear.filter((x) => x !== s))} disabled={!canWrite} /> {tr('파일 삭제', 'Delete file')}</label></span> : undefined}>
                      <input id={`cs-file-${s}`} type="file" accept=".hwp,.hwpx,.xlsx,.xls,.txt,.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.zip" disabled={!uploadOk || !canWrite} onChange={(e) => setFiles({ ...files, [s]: e.target.files?.[0] ?? null })} />
                    </FieldRow>
                  );
                })}
                <FieldRow label={tr('답변 내용', 'Answer')} htmlFor="cs-answer" required error={errors.Contents2} help={tr('Editor / HTML / TEXT 모드(기존 스마트에디터와 같음), 15자 이상', 'Editor / HTML / TEXT modes (as SmartEditor), 15+ characters')}><SupportRichEditor id="cs-answer" ariaLabel={tr('답변 내용', 'Answer')} height={320} value={ans.Contents2} onChange={(html) => setAns((x) => ({ ...x, Contents2: html }))} disabled={!canWrite} invalid={!!errors.Contents2} /></FieldRow>
              </div>
            </Section>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>
      <SupportSubmitConfirm open={confirmSave.open} loading={save.isPending} onCancel={confirmSave.close} onConfirm={() => save.mutate(undefined as never, { onSettled: confirmSave.close })} />
      <ConfirmDialog open={delOpen} title={tr('문의 삭제', 'Delete question')} body={tr('현재 글을 삭제하시겠습니까?', 'Delete this post?')} tone="danger" confirmLabel={tr('삭 제', 'Delete')} loading={remove.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => remove.mutate(undefined as never)} />
      <ConfirmDialog open={!!reveal} title={tr('개인정보 열람사유 작성', 'Reason for viewing personal data')} tone="info" confirmLabel={tr('등록 하기', 'Submit')} reason reasonRequired reasonLabel={tr('사유', 'Reason')} reasonPlaceholder={tr('한글, 영문, 숫자, 공백만 입력 가능합니다.', 'Letters, digits and spaces only.')} loading={doReveal.isPending} onCancel={() => setReveal(null)} onConfirm={confirmReveal}
        body={<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DescList items={[[tr('열람자', 'Viewer'), `${admin?.name ?? ''} (${admin?.id ?? ''})`], [tr('열람 항목', 'Field'), reveal === 'Mobile' ? tr('휴대폰', 'Mobile') : tr('이메일', 'Email')]]} />
          <FieldRow label={tr('구분', 'Purpose')} htmlFor="rv-gubun"><ASelect id="rv-gubun" value={gubun} onChange={(e) => setGubun(e.target.value)} options={(meta.data?.revealGubun ?? REVEAL_GUBUN).map((g) => ({ value: g, label: g }))} /></FieldRow>
        </div>} />
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/cheating — cheating_report.php (부정제보, F6)
export function CheatingPage() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [p, setP, reset] = useSearchState({ col: 'Title', q: '', page: 1 });
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: CHEATING_SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'cheating', query], queryFn: ({ signal }) => adminSupportParityApi.cheating(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const [sel, setSel] = useState<number | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'cheating-detail', sel], queryFn: ({ signal }) => adminSupportParityApi.cheatingDetail(sel!, signal), enabled: sel !== null });
  const d = detail.data;
  const [st, setSt] = useState<{ Status: 'A' | 'B'; Name2: string }>({ Status: 'A', Name2: '' });
  const [err, setErr] = useState('');
  useEffect(() => { if (d) setSt({ Status: d.status === 'B' ? 'B' : 'A', Name2: d.answeredBy ?? '' }); setErr(''); }, [d]);
  const inv = [['admin', 'cheating'], ['admin', 'cheating-detail'], ['admin', 'dashboard']];
  const save = useAdminMutation({ fn: () => adminSupportParityApi.setCheatingStatus(sel!, { Status: st.Status, Name2: st.Name2.trim() }), invalidate: inv, success: DONE(), onSuccess: () => setSel(null) });
  const [delOpen, setDelOpen] = useState(false);
  const remove = useAdminMutation({ fn: () => adminSupportParityApi.deleteCheating(sel!), invalidate: inv, success: DONE(), onSuccess: () => { setDelOpen(false); setSel(null); } });
  const confirmSave = useSubmitConfirm();
  /** cheating_report_read.php SubmitOk(): 작성자 required, then confirm("등록하시겠습니까?"). */
  const submit = () => { if (!st.Name2.trim()) { setErr(tr('작성자를 입력하세요.', 'Enter the author.')); return; } setErr(''); confirmSave.ask(); };
  const columns: Column<CheatingRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 80, render: (_r, i) => rowNo(total, p.page, CHEATING_SIZE, i) },
    { key: 'categoryLabel', header: tr('문의종류', 'Type'), width: 150, render: (r) => r.categoryLabel },
    { key: 'name', header: tr('이름', 'Name'), width: 150, render: (r) => r.name ?? '' },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title ?? ''}</b> },
    { key: 'regDate', header: tr('등록일', 'Received'), width: 150, nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'statusLabel', header: tr('상태', 'Status'), align: 'center', width: 80, render: (r) => r.statusLabel },
    { key: 'answeredBy', header: tr('답변자', 'Handled by'), align: 'center', width: 80, render: (r) => r.answeredBy ?? '' },
  ];
  return (
    <AdminPage title={tr('부정제보', 'Misconduct reports')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'Title', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="ch-col" width={120}><ASelect id="ch-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Title', label: tr('제목', 'Title') }, { value: 'Contents', label: tr('내용', 'Content') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="ch-q" width={300}><AInput id="ch-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={CHEATING_SIZE} total={total} onPageChange={(x) => setP({ page: x })} onRowClick={(r) => setSel(r.idx)} selectedKey={sel} emptyTitle={tr('등록된 내용이 없습니다.', 'Nothing registered.')} dense />
      <DetailDrawer open={sel !== null} onClose={() => setSel(null)} title={tr('부정제보', 'Misconduct report')} subtitle={d?.regDate ?? ''} wide
        footer={<><AButton variant="danger" disabled={!canWrite || !d} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite || !d} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{tr('상태 변경', 'Change status')}</AButton><AButton onClick={() => setSel(null)}>{tr('목록', 'List')}</AButton></>}>
        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Section title={tr('제보 내용', 'Report')}>
              <DescList cols={2} items={[[tr('제보회신방법', 'Reply via'), d.categoryLabel], [tr('이름', 'Name'), d.name], [tr('이메일', 'Email'), d.email], [tr('연락처', 'Phone'), d.mobile], [tr('등록일', 'Received'), d.regDate], ['', null]]} />
              <DescList items={[[tr('문의 제목', 'Title'), d.title]]} />
              <h3 style={{ fontSize: 13, margin: '12px 0 6px' }}>{tr('내용', 'Content')}</h3>
              <Html html={d.contents} />
            </Section>
            <Section title={tr('상태 변경', 'Status')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={tr('처리 상태', 'Status')} htmlFor="ch-status"><ASelect id="ch-status" value={st.Status} onChange={(e) => setSt({ ...st, Status: e.target.value as 'A' | 'B' })} options={d.statuses.length ? d.statuses : statusOptions} disabled={!canWrite} style={{ width: 120 }} /></FieldRow>
                <FieldRow label={tr('작성자', 'Author')} htmlFor="ch-name2" required error={err}><AInput id="ch-name2" value={st.Name2} onChange={(e) => setSt({ ...st, Name2: e.target.value })} maxLength={50} style={{ width: 240 }} disabled={!canWrite} /></FieldRow>
                {d.answeredAt ? <DescList items={[[tr('답변일자', 'Handled at'), d.answeredAt]]} /> : null}
              </div>
            </Section>
          </div>
        ) : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>
      <SupportSubmitConfirm open={confirmSave.open} loading={save.isPending} onCancel={confirmSave.close} onConfirm={() => save.mutate(undefined as never, { onSettled: confirmSave.close })} />
      <ConfirmDialog open={delOpen} title={tr('제보 삭제', 'Delete report')} body={tr('현재 글을 삭제하시겠습니까?', 'Delete this post?')} tone="danger" confirmLabel={tr('삭 제', 'Delete')} loading={remove.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => remove.mutate(undefined as never)} />
    </AdminPage>
  );
}
