import { useMemo, useState } from 'react';
import { adminLearningApi } from '../../../../shared/api/endpoints/admin-learning';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, FieldRow } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { useCertificatePdf, useLearningOptions } from './learningShared';
import type { CertificatePdfKind } from '../../../../shared/api/endpoints/admin-learning';

/** certificate_test.php — 수료증/이수증 테스트 (관리자 A 부서 전용). Every card opens the same PDF as the PHP script it names (built by the API). */
export default function CertificateTestPage() {
  const { admin } = useAdminSession();
  if (admin && admin.dept !== 'A') return <StateBlock code="NO_ACCESS" page title={adm.noGrant.title} body={tr('이 메뉴는 관리자(A) 부서 전용입니다.', 'This menu is for the administrator (A) department only.')} hideActions />;
  return <CertificateTest />;
}

function CertificateTest() {
  const options = useLearningOptions();
  const { toast } = useToast();
  const [c1, setC1] = useState({ lc: '', id: '' });
  const [c2, setC2] = useState('');
  const [c3, setC3] = useState({ cc: '', ls: '', le: '', lc: '', sty: 'N' });
  const [c4, setC4] = useState({ cc: '', ls: '', le: '', lc: '', id: '' });
  const [c5, setC5] = useState({ cn: '', ls: '', le: '', lc: '', id: '' });
  const [c6, setC6] = useState({ cc: '', ls: '', le: '', lc: '', id: '' });
  const courses = useMemo(() => [{ value: '', label: tr('-- 과정 선택 --', '-- choose --') }, ...[...(options.data?.packageCourses ?? []), ...(options.data?.childCourses ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` }))], [options.data]);
  const sample = async (kind: 'latest_seq' | 'latest_study_end' | 'latest_progress100', apply: (d: Awaited<ReturnType<typeof adminLearningApi.certificateSample>>) => void, missing: string) => {
    try { const d = await adminLearningApi.certificateSample(kind); if (!d.found) { toast(missing, { tone: 'danger' }); return; } apply(d); } catch { toast(adm.common.failed, { tone: 'danger' }); }
  };
  const need = (msg: string) => toast(msg, { tone: 'danger' });
  const [, openPdf] = useCertificatePdf();
  /** Opens the PDF of the PHP file the card names (inline ones in a new tab, the others downloaded). */
  const open = ({ kind, ...params }: Record<string, string> & { kind: CertificatePdfKind }) => openPdf(kind, params);
  const row = (label: string, el: React.ReactNode) => <FieldRow label={label}>{el}</FieldRow>;
  const gap: React.CSSProperties = { display: 'grid', gap: 8 };
  return (
    <AdminPage title={tr('수료증/이수증 테스트', 'Certificate test')} lead={tr('각 수료증·이수증 PDF를 직접 테스트할 수 있습니다. 각 카드는 기존 PHP 파일과 같은 배치의 PDF를 엽니다(브라우저 표시 또는 다운로드).', 'Test each certificate PDF. Every card opens the same PDF layout as the PHP file it names (shown or downloaded).')}>
      <Callout tone="info">{tr('데이터는 실제 운영 DB를 읽습니다. 이 화면은 어떤 값도 저장하지 않습니다.', 'Reads production data; nothing is written.')}</Callout>
      <div style={{ display: 'grid', gap: 16 }}>
        <Card title={<>1. {tr('이수증 (학습자용)', 'Certificate (learner)')} — <code>public/mypage/certificate_pdf01.php</code></>}>
          <p className="muted">{tr('학습현황 탭 → 이수증 출력 버튼. LectureCode 기반. 학습자 세션 대신 학습자 ID를 입력합니다.', 'My-room → certificate button. By LectureCode; enter the learner ID instead of the learner session.')}</p>
          <div style={gap}>{row('LectureCode', <ASelect aria-label="LectureCode" value={c1.lc} onChange={(e) => setC1({ ...c1, lc: e.target.value })} options={courses} loading={options.isPending} />)}
            {row(tr('학습자 ID', 'Learner ID'), <AInput aria-label="Learner ID 1" value={c1.id} placeholder={tr('훈련생 ID', 'Learner ID')} onChange={(e) => setC1({ ...c1, id: e.target.value.trim() })} />)}
            <div><AButton variant="primary" onClick={() => (!c1.lc ? need(tr('LectureCode를 선택하세요.', 'Choose a LectureCode.')) : !c1.id ? need(tr('학습자 ID를 입력하세요.', 'Enter the learner ID.')) : open({ kind: 'learner', lectureCode: c1.lc, id: c1.id }))}>{tr('이수증 열기', 'Open')}</AButton></div></div>
        </Card>
        <Card title={<>2. {tr('수료증 (관리자용, Seq 기반)', 'Certificate (admin, by Seq)')} — <code>include/certificate_pdf01.php</code></>}>
          <p className="muted">{tr('학습관리 → 수료 클릭 → 수료증 PDF. Study.Seq 기반.', 'Enrollment list → passed → certificate PDF. By Study.Seq.')}</p>
          <div style={gap}>{row('Study Seq', <div style={{ display: 'flex', gap: 8 }}><AInput aria-label="Study Seq" value={c2} inputMode="numeric" placeholder={tr('Study 테이블의 Seq 번호', 'Study.Seq')} onChange={(e) => setC2(e.target.value.replace(/\D/g, ''))} /><AButton onClick={() => { if (c2) return; void sample('latest_seq', (d) => setC2(String(d.seq ?? '')), tr('수료(PassOK=Y) 기록이 없습니다.', 'No PassOK=Y record.')); }}>{tr('최근 수료 Seq 가져오기', 'Latest passed Seq')}</AButton></div>)}
            <div><AButton variant="primary" onClick={() => (c2 ? open({ kind: 'seq', seq: c2 }) : need(tr('Seq를 입력하세요.', 'Enter a Seq.')))}>{tr('수료증 열기', 'Open')}</AButton></div></div>
        </Card>
        <Card title={<>3. {tr('수료증 일괄 (수강마감)', 'Certificates (closing batch)')} — <code>include/certificate_pdf02.php</code></>}>
          <p className="muted">{tr('수강마감 → 수료증 버튼. CompanyCode + 수강기간 + LectureCode 기반.', 'Closing list → certificates. By company + term + LectureCode.')}</p>
          <div style={gap}>
            {row('CompanyCode', <AInput aria-label="CompanyCode" value={c3.cc} placeholder={tr('사업주코드', 'Company code')} onChange={(e) => setC3({ ...c3, cc: e.target.value.trim() })} />)}
            {row('LectureStart', <AInput aria-label="LectureStart" value={c3.ls} placeholder="2026-01-01" onChange={(e) => setC3({ ...c3, ls: e.target.value.trim() })} />)}
            {row('LectureEnd', <AInput aria-label="LectureEnd" value={c3.le} placeholder="2026-12-31" onChange={(e) => setC3({ ...c3, le: e.target.value.trim() })} />)}
            {row('LectureCode', <AInput aria-label="LectureCode (optional)" value={c3.lc} placeholder={tr('과정코드 (선택)', 'course code (optional)')} onChange={(e) => setC3({ ...c3, lc: e.target.value.trim() })} />)}
            {row('ServiceTypeYN', <ASelect aria-label="ServiceTypeYN" value={c3.sty} onChange={(e) => setC3({ ...c3, sty: e.target.value })} options={[{ value: 'N', label: tr('N (전체)', 'N (all)') }, { value: 'Y', label: tr('Y (아카이브만)', 'Y (archive only)') }]} />)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AButton onClick={() => void sample('latest_study_end', (d) => setC3({ ...c3, cc: d.companyCode ?? '', ls: d.lectureStart ?? '', le: d.lectureEnd ?? '', lc: d.lectureCode ?? '' }), tr('수강마감 데이터가 없습니다.', 'No closing data.'))}>{tr('최근 데이터 가져오기', 'Load latest')}</AButton>
              <AButton variant="primary" onClick={() => { if (!c3.cc || !c3.ls || !c3.le) { need(tr('CompanyCode, LectureStart, LectureEnd는 필수입니다.', 'CompanyCode, LectureStart, LectureEnd are required.')); return; } open({ kind: 'completion', companyCode: c3.cc, lectureStart: c3.ls, lectureEnd: c3.le, serviceTypeYN: c3.sty, lectureCode: c3.lc }); }}>{tr('수료증 일괄 열기', 'Open')}</AButton>
            </div></div>
        </Card>
        <Card title={<>4. {tr('이수증 개인 (과목별)', 'Certificate (individual, by content)')} — <code>include/certificate_pdf04.php</code></>}>
          <p className="muted">{tr('과목별 이수증 → 이수증 버튼. CompanyCode + 수강기간 + LectureCode + ID 기반.', 'By company + term + LectureCode + ID.')}</p>
          <div style={gap}>
            {row('CompanyCode', <AInput aria-label="CompanyCode 4" value={c4.cc} placeholder={tr('사업주코드', 'Company code')} onChange={(e) => setC4({ ...c4, cc: e.target.value.trim() })} />)}
            {row('LectureStart', <AInput aria-label="LectureStart 4" value={c4.ls} placeholder="2026-01-01" onChange={(e) => setC4({ ...c4, ls: e.target.value.trim() })} />)}
            {row('LectureEnd', <AInput aria-label="LectureEnd 4" value={c4.le} placeholder="2026-12-31" onChange={(e) => setC4({ ...c4, le: e.target.value.trim() })} />)}
            {row('LectureCode', <AInput aria-label="LectureCode 4" value={c4.lc} placeholder={tr('과정코드', 'Course code')} onChange={(e) => setC4({ ...c4, lc: e.target.value.trim() })} />)}
            {row(tr('ID (이름/아이디)', 'ID (name / user ID)'), <AInput aria-label="ID 4" value={c4.id} placeholder={tr('훈련생 이름 또는 ID', 'Learner name or ID')} onChange={(e) => setC4({ ...c4, id: e.target.value })} />)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AButton onClick={() => void sample('latest_progress100', (d) => setC4({ cc: d.companyCode ?? '', ls: d.lectureStart ?? '', le: d.lectureEnd ?? '', lc: d.lectureCode ?? '', id: d.id ?? '' }), tr('진도 100% 데이터가 없습니다.', 'No progress-100% data.'))}>{tr('최근 데이터 가져오기', 'Load latest')}</AButton>
              <AButton variant="primary" onClick={() => (c4.id ? open({ kind: 'subject-row', companyCode: c4.cc, lectureStart: c4.ls, lectureEnd: c4.le, lectureCode: c4.lc, id: c4.id.trim() }) : need(tr('ID(이름/아이디)는 필수입니다.', 'ID is required.')))}>{tr('이수증 개인 열기', 'Open')}</AButton>
            </div></div>
        </Card>
        <Card title={<>5. {tr('이수증 일괄 (관리자)', 'Certificates (admin batch)')} — <code>hrd_manager/study_end2_user_pdf.php</code></>}>
          <p className="muted">{tr('과목별 이수증 → 이수증 일괄 버튼. 관리자 전용.', 'Subject certificates → batch button. Admin only.')}</p>
          <div style={gap}>
            {row('CompanyName', <AInput aria-label="CompanyName 5" value={c5.cn} placeholder={tr('사업주명', 'Company name')} onChange={(e) => setC5({ ...c5, cn: e.target.value })} />)}
            {row('LectureStart', <AInput aria-label="LectureStart 5" value={c5.ls} placeholder="2026-01-01" onChange={(e) => setC5({ ...c5, ls: e.target.value.trim() })} />)}
            {row('LectureEnd', <AInput aria-label="LectureEnd 5" value={c5.le} placeholder="2026-12-31" onChange={(e) => setC5({ ...c5, le: e.target.value.trim() })} />)}
            {row('LectureCode', <AInput aria-label="LectureCode 5" value={c5.lc} placeholder={tr('과정코드', 'Course code')} onChange={(e) => setC5({ ...c5, lc: e.target.value.trim() })} />)}
            {row(tr('ID (이름/아이디)', 'ID (name / user ID)'), <AInput aria-label="ID 5" value={c5.id} placeholder={tr('훈련생 이름 또는 ID', 'Learner name or ID')} onChange={(e) => setC5({ ...c5, id: e.target.value })} />)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AButton onClick={() => void sample('latest_progress100', (d) => setC5({ cn: d.companyName ?? '', ls: d.lectureStart ?? '', le: d.lectureEnd ?? '', lc: d.lectureCode ?? '', id: d.id ?? '' }), tr('진도 100% 데이터가 없습니다.', 'No progress-100% data.'))}>{tr('최근 데이터 가져오기', 'Load latest')}</AButton>
              <AButton variant="primary" onClick={() => (c5.id ? open({ kind: 'subject', id: c5.id.trim(), companyName: c5.cn, lectureStart: c5.ls, lectureEnd: c5.le, lectureCode: c5.lc }) : need(tr('ID(이름/아이디)는 필수입니다.', 'ID is required.')))}>{tr('이수증 일괄 열기', 'Open')}</AButton>
            </div></div>
        </Card>
        <Card title={<>6. {tr('수료증 (교육담당자용)', 'Certificate (training manager)')} — <code>public/mypage/manager_certificate_pdf.php</code></>}>
          <p className="muted">{tr('교육담당자 마이페이지 → 수료증 출력. 교육담당자 세션 대신 담당자 ID를 입력합니다. (기존 PDF 도 과정·기간 값은 사용하지 않고 오늘 날짜·15H 로 출력합니다.)', 'Manager my-page → certificates. Enter the manager ID instead of the session (the PHP ignores course/term and prints today, 15H).')}</p>
          <div style={gap}>
            {row(tr('교육담당자 ID', 'Manager ID'), <AInput aria-label="Manager ID 6" value={c6.id} placeholder={tr('교육담당자 ID', 'Manager ID')} onChange={(e) => setC6({ ...c6, id: e.target.value.trim() })} />)}
            {row('CompanyCode', <AInput aria-label="CompanyCode 6" value={c6.cc} placeholder={tr('사업주코드', 'Company code')} onChange={(e) => setC6({ ...c6, cc: e.target.value.trim() })} />)}
            {row('LectureStart', <AInput aria-label="LectureStart 6" value={c6.ls} placeholder="2026-01-01" onChange={(e) => setC6({ ...c6, ls: e.target.value.trim() })} />)}
            {row('LectureEnd', <AInput aria-label="LectureEnd 6" value={c6.le} placeholder="2026-12-31" onChange={(e) => setC6({ ...c6, le: e.target.value.trim() })} />)}
            {row('LectureCode', <AInput aria-label="LectureCode 6" value={c6.lc} placeholder={tr('과정코드', 'Course code')} onChange={(e) => setC6({ ...c6, lc: e.target.value.trim() })} />)}
            <div><AButton variant="primary" onClick={() => (!(c6.cc && c6.ls && c6.le && c6.lc) ? need(tr('모든 필드를 입력하세요.', 'Fill in every field.')) : !c6.id ? need(tr('교육담당자 ID를 입력하세요.', 'Enter the manager ID.')) : open({ kind: 'manager', id: c6.id }))}>{tr('교육담당자 수료증 열기', 'Open')}</AButton></div></div>
        </Card>
      </div>
    </AdminPage>
  );
}
