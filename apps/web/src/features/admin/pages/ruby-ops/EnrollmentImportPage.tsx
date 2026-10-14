import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { adminRubyOpsApi, type EnrollImportPlanRow, type EnrollImportResult } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { AButton, ACheckbox, AdminPage, ATextarea, Callout, Card, DataTable, Kpi, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { buildEnrollTemplateCsv, downloadText, mapEnrollRows, parseDelimited, type EnrollRow, type MappedEnrollImport } from './enrollmentImport';

const MAX_ROWS = 500;
const tone = (a: EnrollImportPlanRow['action']) => (a === 'enroll' ? 'ok' : a === 'skip' ? 'neutral' : 'danger') as 'ok' | 'neutral' | 'danger';
const ACTION_LABEL: Record<string, string> = { enroll: tr('등록', 'Enrol'), error: tr('오류', 'Error'), skip: tr('건너뜀', 'Skipped') };
const MEMBER_LABEL: Record<string, string> = { create: tr('신규 회원', 'New member'), update: tr('기존 회원', 'Existing'), blocked: tr('계정상태', 'Blocked') };

/** lecture_reg_excel_upload.php + lecture_reg_complete.php — paste/CSV → 검증(dryRun) → 등록(commit), no StudyExcelTemp. */
export default function EnrollmentImportPage() {
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapped, setMapped] = useState<MappedEnrollImport | null>(null);
  const [plan, setPlan] = useState<EnrollImportResult | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);

  const run = useAdminMutation({
    fn: (body: { rows: EnrollRow[]; mode: 'dryRun' | 'commit'; skipInvalid: boolean }) => adminRubyOpsApi.importEnrollments(body), invalidate: [['admin', 'studies'], ['admin', 'members']],
    onSuccess: (r) => { setPlan(r); if (r.mode === 'commit' && r.applied) toast(tr(`수강 ${r.applied.enrolled}건 등록 (신규 회원 ${r.applied.membersCreated}, 새 회차 ${r.applied.termsCreated}, 제외 ${r.applied.skipped})`, `${r.applied.enrolled} enrolled (${r.applied.membersCreated} new members, ${r.applied.termsCreated} new terms, ${r.applied.skipped} skipped)`), { tone: 'ok' }); },
    onError: (err) => {
      const det = isAppError(err) ? (err.details as { rows?: EnrollImportPlanRow[] } | undefined) : undefined;
      if (det?.rows && plan) setPlan({ ...plan, rows: plan.rows.map((r) => det.rows!.find((x) => x.line === r.line) ?? r) });
      toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
    },
  });

  const parse = () => {
    const m = mapEnrollRows(parseDelimited(text));
    setPlan(null);
    if (!m.rows.length) { setMapped(null); toast(tr('읽을 수 있는 행이 없습니다.', 'No readable rows.'), { tone: 'danger' }); return; }
    if (m.rows.length > MAX_ROWS) { setMapped(null); toast(tr('한 번에 500행까지 등록할 수 있습니다.', 'Up to 500 rows per batch.'), { tone: 'danger' }); return; }
    setMapped(m);
    run.mutate({ rows: m.rows, mode: 'dryRun', skipInvalid: false });
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result ?? '')); setMapped(null); setPlan(null); };
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  };
  const commit = () => { if (!mapped) return; run.mutate({ rows: mapped.rows, mode: 'commit', skipInvalid }); };

  const cols: Column<EnrollImportPlanRow>[] = useMemo(() => [
    { key: 'line', header: tr('행', 'Row'), align: 'right', width: 50 },
    { key: 'action', header: tr('처리', 'Action'), align: 'center', render: (r) => <StatusBadge tone={tone(r.action)}>{ACTION_LABEL[r.action] ?? r.action}</StatusBadge> },
    { key: 'userId', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <span className="mono">{r.userId}{r.generatedId ? <small className="muted"> ({tr('자동', 'auto')})</small> : null}</span> },
    { key: 'name', header: tr('성명', 'Name'), render: (r) => <b>{r.name}</b> },
    { key: 'memberAction', header: tr('회원', 'Member'), align: 'center', render: (r) => r.memberAction ? <StatusBadge tone={r.memberAction === 'create' ? 'info' : r.memberAction === 'blocked' ? 'danger' : 'neutral'}>{MEMBER_LABEL[r.memberAction]}</StatusBadge> : '' },
    { key: 'lectureCode', header: tr('과정', 'Course'), render: (r) => <span title={r.lectureCode}>{r.courseName ?? r.lectureCode}</span> },
    { key: 'companyCode', header: tr('사업장', 'Company'), render: (r) => r.companyName ?? r.companyCode },
    { key: 'period', header: tr('수강기간', 'Period'), nowrap: true, render: (r) => `${r.lectureStart} ~ ${r.lectureEnd}` },
    { key: 'serviceType', header: tr('구분/회차', 'Type / session'), align: 'center', nowrap: true, render: (r) => `${r.serviceType} / ${r.openChapter}${r.termAction === 'create' ? ` (${tr('새 회차', 'new term')})` : r.termeIdx ? ` (#${r.termeIdx})` : ''}` },
    { key: 'salesId', header: tr('영업자', 'Sales'), nowrap: true, render: (r) => r.salesId },
    { key: 'errors', header: tr('검증 결과', 'Validation'), render: (r) => r.errors.length ? <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--c-danger)', fontSize: 12 }}>{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : <span className="muted">{r.action === 'skip' ? tr('강의코드 없음', 'no course code') : 'OK'}</span> },
  ], []);

  const committed = plan?.mode === 'commit';
  const canCommit = !!mapped && !!plan && plan.mode === 'dryRun' && (plan.summary.error === 0 || skipInvalid) && plan.summary.enroll > 0;
  return (
    <AdminPage title={tr('엑셀 일괄 수강등록', 'Bulk enrollment (Excel)')} lead={tr('기존 수강등록 엑셀(A~U열)을 복사해 붙여넣거나 CSV 파일을 선택하세요. 임시 테이블 없이 바로 검증하고, 주민번호로 기존 회원을 찾아 없으면 회원을 새로 만든 뒤 회차·수강을 등록합니다.', 'Paste the legacy enrollment sheet (columns A–U) or choose a CSV file. Rows are validated directly; existing members are matched by resident number, new ones are created, then the term and enrollment are written.')}
      crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr('수강 등록', 'Enrol learners'), to: '/admin/enrollments/new' }, { label: tr('엑셀 일괄 등록', 'Bulk import') }]}
      actions={<><AButton onClick={() => downloadText('수강등록_양식.csv', buildEnrollTemplateCsv(false))}>{tr('양식 내려받기 (CSV)', 'Template (CSV)')}</AButton><AButton onClick={() => downloadText('수강등록_샘플.csv', buildEnrollTemplateCsv(true))}>{tr('샘플 포함 양식', 'Template with sample')}</AButton><AButton to="/admin/enrollments/new">{tr('단건 수강 등록', 'Single enrollment')}</AButton></>}>
      {!canWrite ? <Callout tone="warn" className="u-mb-8">{adm.readOnly}</Callout> : null}
      <Callout className="u-mb-8">{tr('규칙은 기존과 같습니다: 사업자번호 하이픈 제거 · 훈련생구분 기본 007 · 비정규직구분 000 · 교육담당자 1/Y → Y · 영업자 비면 사업주의 영업담당자 · 실시회차 기본 1(비환급 W는 0) · 비밀번호 기본 1111 · 복습기간 종료일+7일 · 아이디 = 사업주ID + 주민번호 앞 6자리. 미사용/탈퇴/휴면 회원과 기간이 겹치는 수강은 오류로 표시됩니다.', 'Same rules as before: hyphens stripped from the business number · trainee type 007 · irregular type 000 · EduManager 1/Y → Y · empty sales ID → company sales manager · session 1 (0 for W) · password 1111 · review = end + 7 days · ID = company ID + first 6 digits of the resident number. Inactive members and overlapping enrollments are errors.')}</Callout>
      <Card title={tr('엑셀에서 복사한 내용 붙여넣기', 'Paste rows copied from Excel')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ATextarea aria-label={tr('붙여넣기', 'Paste')} rows={8} value={text} onChange={(e) => { setText(e.target.value); setMapped(null); setPlan(null); setFileName(null); }} placeholder={tr('강의코드\t과정명\t첨삭강사\t성명\t주민번호\t휴대폰\t이메일\t사업자번호\t…  (엑셀에서 머리글 포함 복사 → 붙여넣기)', 'Course code\tCourse\tTutor\tName\tResident no.\tMobile\tE-mail\tBusiness no.\t…  (copy from Excel including the header row)')} spellCheck={false} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} disabled={!canWrite} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13 }}>{tr('CSV / TSV 파일', 'CSV / TSV file')}: <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" onChange={onFile} disabled={!canWrite} /></label>
            {fileName ? <span className="muted" style={{ fontSize: 12 }}>{fileName}</span> : null}
            <span style={{ flex: 1 }} />
            <AButton onClick={() => { setText(''); setMapped(null); setPlan(null); setFileName(null); }} disabled={!text}>{tr('지우기', 'Clear')}</AButton>
            <AButton variant="primary" onClick={parse} loading={run.isPending && !plan} disabled={!canWrite || !text.trim()} title={readOnlyTitle}>{tr('검증하기', 'Validate')}</AButton>
          </div>
        </div>
      </Card>

      {mapped && plan ? (
        <Card className="u-mt-16" title={`${committed ? tr('등록 결과', 'Import result') : tr('검증 결과', 'Validation result')} · ${plan.summary.total.toLocaleString()}${tr('행', ' rows')}`}
          aside={<span className="muted" style={{ fontSize: 12 }}>{mapped.headerDetected ? tr('첫 행을 머리글로 인식했습니다.', 'First row read as header.') : tr('머리글이 없어 기존 엑셀 양식(A~U열) 순서로 읽었습니다.', 'No header: legacy A–U order assumed.')}{mapped.unknownHeaders.length ? ` · ${tr('무시된 열', 'ignored columns')}: ${mapped.unknownHeaders.join(', ')}` : ''}</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
            <Kpi label={tr('전체', 'Total')} value={plan.summary.total} />
            <Kpi label={tr('등록 대상', 'To enrol')} value={plan.summary.enroll} tone="ok" />
            <Kpi label={tr('신규 회원', 'New members')} value={plan.summary.newMembers} tone="navy" />
            <Kpi label={tr('기존 회원', 'Existing members')} value={plan.summary.updateMembers} />
            <Kpi label={tr('새 회차', 'New terms')} value={plan.summary.newTerms} />
            <Kpi label={tr('오류', 'Errors')} value={plan.summary.error} tone={plan.summary.error ? 'warn' : undefined} />
            <Kpi label={tr('건너뜀', 'Skipped')} value={plan.summary.skip} />
          </div>
          {committed && plan.applied ? <Callout tone="ok" className="u-mb-8">{tr(`수강 ${plan.applied.enrolled}건 등록 완료 (신규 회원 ${plan.applied.membersCreated}, 기존 회원 수정 ${plan.applied.membersUpdated}, 새 회차 ${plan.applied.termsCreated}, 제외 ${plan.applied.skipped}).`, `${plan.applied.enrolled} enrolled (${plan.applied.membersCreated} new members, ${plan.applied.membersUpdated} updated, ${plan.applied.termsCreated} new terms, ${plan.applied.skipped} skipped).`)} {plan.applied.studySeqs.length ? <span>Study Seq: {plan.applied.studySeqs.slice(0, 20).map((s, i) => <span key={s}>{i ? ', ' : ''}<Link to={`/admin/studies/${s}`}>{s}</Link></span>)}{plan.applied.studySeqs.length > 20 ? ' …' : ''}</span> : null}</Callout>
            : plan.summary.error ? <Callout tone="warn" className="u-mb-8">{tr('오류 행을 수정하거나 "오류 행은 제외하고 등록"을 선택하세요.', 'Fix the error rows or choose "skip error rows".')}</Callout> : null}
          <DataTable columns={cols} rows={plan.rows} rowKey={(r) => r.line} size={50} dense />
          {!committed ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', marginTop: 12 }}>
              <ACheckbox label={tr('오류 행은 제외하고 등록', 'Skip error rows')} checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} disabled={!plan.summary.error} />
              <AButton variant="primary" onClick={commit} loading={run.isPending} disabled={!canWrite || !canCommit} title={readOnlyTitle}>{tr('등록 실행', 'Enrol now')}</AButton>
            </div>
          ) : null}
        </Card>
      ) : null}
    </AdminPage>
  );
}
