import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLearningApi } from '../../../../shared/api/endpoints/admin-learning';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, FieldRow } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { GrantGate } from '../../GrantGate';
import { legacyAdminHref, legacySiteHref, openLegacy, useLearningOptions } from './learningShared';

/** certificate_test.php — 수료증/이수증 테스트 (관리자 A 부서 전용). Cards 3 and 5 use the new printable pages; the rest open the PHP PDFs. */
export default function CertificateTestPage() {
  const { admin } = useAdminSession();
  if (admin && admin.dept !== 'A') return <StateBlock code="NO_ACCESS" page title={adm.noGrant.title} body={tr('이 메뉴는 관리자(A) 부서 전용입니다.', 'This menu is for the administrator (A) department only.')} hideActions />;
  return <GrantGate grant="B8"><CertificateTest /></GrantGate>;
}

function CertificateTest() {
  const options = useLearningOptions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [c3, setC3] = useState({ cc: '', ls: '', le: '', lc: '', sty: 'N' });
  const [c4, setC4] = useState({ cc: '', ls: '', le: '', lc: '', id: '' });
  const [c5, setC5] = useState({ cn: '', ls: '', le: '', lc: '', id: '' });
  const [c6, setC6] = useState({ cc: '', ls: '', le: '', lc: '' });
  const courses = useMemo(() => [{ value: '', label: tr('-- 과정 선택 --', '-- choose --') }, ...[...(options.data?.packageCourses ?? []), ...(options.data?.childCourses ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((c) => ({ value: c.lectureCode, label: `${c.name} | ${c.lectureCode}` }))], [options.data]);
  const sample = async (kind: 'latest_seq' | 'latest_study_end' | 'latest_progress100', apply: (d: Awaited<ReturnType<typeof adminLearningApi.certificateSample>>) => void, missing: string) => {
    try { const d = await adminLearningApi.certificateSample(kind); if (!d.found) { toast(missing, { tone: 'danger' }); return; } apply(d); } catch { toast(adm.common.failed, { tone: 'danger' }); }
  };
  const need = (msg: string) => toast(msg, { tone: 'danger' });
  const row = (label: string, el: React.ReactNode) => <FieldRow label={label}>{el}</FieldRow>;
  const gap: React.CSSProperties = { display: 'grid', gap: 8 };
  return (
    <AdminPage title={tr('수료증/이수증 테스트', 'Certificate test')} lead={tr('각 수료증·이수증 출력을 직접 테스트할 수 있습니다. 3·5번은 새 콘솔의 인쇄용 화면, 나머지는 기존 사이트의 PDF 페이지를 엽니다(기존 사이트 로그인 필요).', 'Test each certificate output. Cards 3 and 5 use the new printable pages; the others open the previous site’s PDF pages (login there first).')}>
      <Callout tone="info">{tr('데이터는 실제 운영 DB를 읽습니다. 이 화면은 어떤 값도 저장하지 않습니다.', 'Reads production data; nothing is written.')}</Callout>
      <div style={{ display: 'grid', gap: 16 }}>
        <Card title={<>1. {tr('이수증 (학습자용)', 'Certificate (learner)')} — <code>public/mypage/certificate_pdf01.php</code></>}>
          <p className="muted">{tr('학습현황 탭 → 이수증 출력 버튼. LectureCode 기반.', 'My-room → certificate button. By LectureCode.')}</p>
          <div style={gap}>{row('LectureCode', <ASelect aria-label="LectureCode" value={c1} onChange={(e) => setC1(e.target.value)} options={courses} loading={options.isPending} />)}
            <div><AButton variant="primary" onClick={() => (c1 ? openLegacy(legacySiteHref('public/mypage/certificate_pdf01.php', { LectureCode: c1 })) : need(tr('LectureCode를 선택하세요.', 'Choose a LectureCode.')))}>{tr('이수증 열기', 'Open')}</AButton></div></div>
        </Card>
        <Card title={<>2. {tr('수료증 (관리자용, Seq 기반)', 'Certificate (admin, by Seq)')} — <code>include/certificate_pdf01.php</code></>}>
          <p className="muted">{tr('학습관리 → 수료 클릭 → 수료증 PDF. Study.Seq 기반.', 'Enrollment list → passed → certificate PDF. By Study.Seq.')}</p>
          <div style={gap}>{row('Study Seq', <div style={{ display: 'flex', gap: 8 }}><AInput aria-label="Study Seq" value={c2} inputMode="numeric" placeholder={tr('Study 테이블의 Seq 번호', 'Study.Seq')} onChange={(e) => setC2(e.target.value.replace(/\D/g, ''))} /><AButton onClick={() => void sample('latest_seq', (d) => setC2(String(d.seq ?? '')), tr('수료(PassOK=Y) 기록이 없습니다.', 'No PassOK=Y record.'))}>{tr('최근 수료 Seq 가져오기', 'Latest passed Seq')}</AButton></div>)}
            <div><AButton variant="primary" onClick={() => (c2 ? openLegacy(legacySiteHref('include/certificate_pdf01.php', { Seq: c2 })) : need(tr('Seq를 입력하세요.', 'Enter a Seq.')))}>{tr('수료증 열기', 'Open')}</AButton></div></div>
        </Card>
        <Card title={<>3. {tr('수료증 일괄 (수강마감)', 'Certificates (closing batch)')} — <code>include/certificate_pdf02.php</code> → {tr('새 인쇄 화면', 'new print page')}</>}>
          <p className="muted">{tr('수강마감 → 수료증 버튼. CompanyCode + 수강기간 + LectureCode 기반.', 'Closing list → certificates. By company + term + LectureCode.')}</p>
          <div style={gap}>
            {row('CompanyCode', <AInput aria-label="CompanyCode" value={c3.cc} onChange={(e) => setC3({ ...c3, cc: e.target.value.trim() })} />)}
            {row('LectureStart', <AInput aria-label="LectureStart" value={c3.ls} placeholder="2026-01-01" onChange={(e) => setC3({ ...c3, ls: e.target.value.trim() })} />)}
            {row('LectureEnd', <AInput aria-label="LectureEnd" value={c3.le} placeholder="2026-12-31" onChange={(e) => setC3({ ...c3, le: e.target.value.trim() })} />)}
            {row('LectureCode', <AInput aria-label="LectureCode (optional)" value={c3.lc} placeholder={tr('과정코드 (선택)', 'course code (optional)')} onChange={(e) => setC3({ ...c3, lc: e.target.value.trim() })} />)}
            {row('ServiceTypeYN', <ASelect aria-label="ServiceTypeYN" value={c3.sty} onChange={(e) => setC3({ ...c3, sty: e.target.value })} options={[{ value: 'N', label: tr('N (전체)', 'N (all)') }, { value: 'Y', label: tr('Y (아카이브만)', 'Y (archive only)') }]} />)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AButton onClick={() => void sample('latest_study_end', (d) => setC3({ ...c3, cc: d.companyCode ?? '', ls: d.lectureStart ?? '', le: d.lectureEnd ?? '', lc: d.lectureCode ?? '' }), tr('수강마감 데이터가 없습니다.', 'No closing data.'))}>{tr('최근 데이터 가져오기', 'Load latest')}</AButton>
              <AButton variant="primary" onClick={() => { if (!c3.cc || !c3.ls || !c3.le) { need(tr('CompanyCode, LectureStart, LectureEnd는 필수입니다.', 'CompanyCode, LectureStart, LectureEnd are required.')); return; } const q = new URLSearchParams({ kind: 'completion', companyCode: c3.cc, lectureStart: c3.ls, lectureEnd: c3.le, serviceTypeYN: c3.sty }); if (c3.lc) q.set('lectureCode', c3.lc); navigate(`/admin/learning/certificates/print?${q.toString()}`); }}>{tr('수료증 일괄 열기 (새 화면)', 'Open (new page)')}</AButton>
              <AButton onClick={() => (c3.cc && c3.ls && c3.le ? openLegacy(legacySiteHref('include/certificate_pdf02.php', { CompanyCode: c3.cc, LectureStart: c3.ls, LectureEnd: c3.le, ServiceTypeYN: c3.sty, LectureCode: c3.lc || undefined })) : need(tr('CompanyCode, LectureStart, LectureEnd는 필수입니다.', 'Required fields missing.')))}>{tr('기존 PDF 열기', 'Open legacy PDF')}</AButton>
            </div></div>
        </Card>
        <Card title={<>4. {tr('이수증 개인 (과목별)', 'Certificate (individual, by content)')} — <code>include/certificate_pdf04.php</code></>}>
          <p className="muted">{tr('과목별 이수증 → 이수증 버튼. CompanyCode + 수강기간 + LectureCode + ID 기반.', 'By company + term + LectureCode + ID.')}</p>
          <div style={gap}>
            {row('CompanyCode', <AInput aria-label="CompanyCode 4" value={c4.cc} onChange={(e) => setC4({ ...c4, cc: e.target.value.trim() })} />)}
            {row('LectureStart', <AInput aria-label="LectureStart 4" value={c4.ls} onChange={(e) => setC4({ ...c4, ls: e.target.value.trim() })} />)}
            {row('LectureEnd', <AInput aria-label="LectureEnd 4" value={c4.le} onChange={(e) => setC4({ ...c4, le: e.target.value.trim() })} />)}
            {row('LectureCode', <AInput aria-label="LectureCode 4" value={c4.lc} onChange={(e) => setC4({ ...c4, lc: e.target.value.trim() })} />)}
            {row(tr('ID (이름/아이디)', 'ID (name / user ID)'), <AInput aria-label="ID 4" value={c4.id} onChange={(e) => setC4({ ...c4, id: e.target.value })} />)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AButton onClick={() => void sample('latest_progress100', (d) => setC4({ cc: d.companyCode ?? '', ls: d.lectureStart ?? '', le: d.lectureEnd ?? '', lc: d.lectureCode ?? '', id: d.id ?? '' }), tr('진도 100% 데이터가 없습니다.', 'No progress-100% data.'))}>{tr('최근 데이터 가져오기', 'Load latest')}</AButton>
              <AButton variant="primary" onClick={() => (c4.id ? openLegacy(legacySiteHref('include/certificate_pdf04.php', { CompanyCode: c4.cc, LectureStart: c4.ls, LectureEnd: c4.le, LectureCode: c4.lc, ID: c4.id })) : need(tr('ID(이름/아이디)는 필수입니다.', 'ID is required.')))}>{tr('이수증 개인 열기', 'Open')}</AButton>
            </div></div>
        </Card>
        <Card title={<>5. {tr('이수증 일괄 (관리자)', 'Certificates (admin batch)')} — <code>hrd_manager/study_end2_user_pdf.php</code> → {tr('새 인쇄 화면', 'new print page')}</>}>
          <p className="muted">{tr('과목별 이수증 → 이수증 일괄 버튼. 관리자 전용.', 'Subject certificates → batch button. Admin only.')}</p>
          <div style={gap}>
            {row('CompanyName', <AInput aria-label="CompanyName 5" value={c5.cn} onChange={(e) => setC5({ ...c5, cn: e.target.value })} />)}
            {row('LectureStart', <AInput aria-label="LectureStart 5" value={c5.ls} onChange={(e) => setC5({ ...c5, ls: e.target.value.trim() })} />)}
            {row('LectureEnd', <AInput aria-label="LectureEnd 5" value={c5.le} onChange={(e) => setC5({ ...c5, le: e.target.value.trim() })} />)}
            {row('LectureCode', <AInput aria-label="LectureCode 5" value={c5.lc} onChange={(e) => setC5({ ...c5, lc: e.target.value.trim() })} />)}
            {row(tr('ID (이름/아이디)', 'ID (name / user ID)'), <AInput aria-label="ID 5" value={c5.id} onChange={(e) => setC5({ ...c5, id: e.target.value })} />)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <AButton onClick={() => void sample('latest_progress100', (d) => setC5({ cn: d.companyName ?? '', ls: d.lectureStart ?? '', le: d.lectureEnd ?? '', lc: d.lectureCode ?? '', id: d.id ?? '' }), tr('진도 100% 데이터가 없습니다.', 'No progress-100% data.'))}>{tr('최근 데이터 가져오기', 'Load latest')}</AButton>
              <AButton variant="primary" onClick={() => { if (!c5.id) { need(tr('ID(이름/아이디)는 필수입니다.', 'ID is required.')); return; } const q = new URLSearchParams({ kind: 'subject', id: c5.id }); if (c5.cn) q.set('companyName', c5.cn); if (c5.ls) q.set('lectureStart', c5.ls); if (c5.le) q.set('lectureEnd', c5.le); if (c5.lc) q.set('lectureCode', c5.lc); navigate(`/admin/learning/certificates/print?${q.toString()}`); }}>{tr('이수증 일괄 열기 (새 화면)', 'Open (new page)')}</AButton>
              <AButton onClick={() => (c5.id ? openLegacy(legacyAdminHref('study_end2_user_pdf.php', { CompanyName: c5.cn, LectureStart: c5.ls, LectureEnd: c5.le, LectureCode: c5.lc, ID: c5.id })) : need(tr('ID(이름/아이디)는 필수입니다.', 'ID is required.')))}>{tr('기존 PDF 열기', 'Open legacy PDF')}</AButton>
            </div></div>
        </Card>
        <Card title={<>6. {tr('수료증 (교육담당자용)', 'Certificate (training manager)')} — <code>public/mypage/manager_certificate_pdf.php</code></>}>
          <p className="muted">{tr('교육담당자 마이페이지 → 수료증 출력. CompanyCode + 수강기간 + LectureCode 기반.', 'Manager my-page → certificates. By company + term + LectureCode.')}</p>
          <div style={gap}>
            {row('CompanyCode', <AInput aria-label="CompanyCode 6" value={c6.cc} onChange={(e) => setC6({ ...c6, cc: e.target.value.trim() })} />)}
            {row('LectureStart', <AInput aria-label="LectureStart 6" value={c6.ls} onChange={(e) => setC6({ ...c6, ls: e.target.value.trim() })} />)}
            {row('LectureEnd', <AInput aria-label="LectureEnd 6" value={c6.le} onChange={(e) => setC6({ ...c6, le: e.target.value.trim() })} />)}
            {row('LectureCode', <AInput aria-label="LectureCode 6" value={c6.lc} onChange={(e) => setC6({ ...c6, lc: e.target.value.trim() })} />)}
            <div><AButton variant="primary" onClick={() => (c6.cc && c6.ls && c6.le && c6.lc ? openLegacy(legacySiteHref('public/mypage/manager_certificate_pdf.php', { CompanyCode: c6.cc, LectureStart: c6.ls, LectureEnd: c6.le, LectureCode: c6.lc })) : need(tr('모든 필드를 입력하세요.', 'Fill in every field.')))}>{tr('교육담당자 수료증 열기', 'Open')}</AButton></div></div>
        </Card>
      </div>
    </AdminPage>
  );
}
