import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi, type CertificateSheet } from '../../../../shared/api/endpoints/admin-learning';
import { AButton, AdminPage, Callout } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';
import { LEGACY_SITE_ROOT, useCertificatePdf } from './learningShared';
import { adm } from '../../strings';
import { ReceiptPrint } from './ReceiptPrintPage';
import { LearningReport } from './LearningReportPage';

type SheetKind = 'completion' | 'subject' | 'subject-row' | 'seq' | 'learner' | 'manager';
const SHEET_KINDS: SheetKind[] = ['completion', 'subject', 'subject-row', 'seq', 'learner', 'manager'];
/** Which API call / required params / empty message each print kind uses (PHP source in the comment). */
const SHEET: Record<SheetKind, { load: (p: Record<string, string>, s?: AbortSignal) => Promise<CertificateSheet>; ready: (p: Record<string, string>) => boolean; need: string; empty: string; title: string }> = {
  completion: { load: (p, s) => adminLearningApi.closingCertificates(p, s), ready: (p) => !!(p.companyCode && p.lectureStart && p.lectureEnd), need: 'CompanyCode, LectureStart, LectureEnd는 필수입니다.', empty: '수료내역이 없습니다.', title: '수료증 출력' }, // include/certificate_pdf02.php
  subject: { load: (p, s) => adminLearningApi.subjectCertificatePrint(p, s), ready: (p) => !!p.id, need: '이름/ID를 입력하세요.', empty: '이수증을 출력할 데이터가 없습니다. (진도 100% 필요)', title: '이수증 출력' }, // study_end2_user_pdf.php
  'subject-row': { load: (p, s) => adminLearningApi.subjectRowPrint(p, s), ready: (p) => !!p.id, need: 'ID(이름/아이디)는 필수입니다.', empty: '수료내역이 없습니다.', title: '이수증 출력' }, // include/certificate_pdf04.php
  seq: { load: (p, s) => adminLearningApi.certificateBySeq(p.seq ?? '', s), ready: (p) => /^\d+$/.test(p.seq ?? ''), need: 'Seq를 입력하세요.', empty: '출력내용이 없습니다.', title: '수료증 출력' }, // include/certificate_pdf01.php
  learner: { load: (p, s) => adminLearningApi.certificateLearner(p, s), ready: (p) => !!(p.id && p.lectureCode), need: '학습자 ID와 LectureCode는 필수입니다.', empty: '해당 과정의 수강 정보를 찾을 수 없습니다.', title: '이수증 출력 (학습자용)' }, // public/mypage/certificate_pdf01.php
  manager: { load: (p, s) => adminLearningApi.certificateManager(p.id ?? '', s), ready: (p) => !!p.id, need: '교육담당자 ID를 입력하세요.', empty: '출력내용이 없습니다.', title: '교육담당자 수료증 출력' }, // public/mypage/manager_certificate_pdf.php
};

const PRINT_CSS = `
.cert-sheet{width:210mm;min-height:297mm;margin:0 auto 16px;padding:28mm 22mm;box-sizing:border-box;background:#fff url(${LEGACY_SITE_ROOT}/images/certi_print_img01.jpg) center/100% 100% no-repeat;color:#111;font-family:'Batang','BatangChe','Nanum Myeongjo',serif;position:relative;border:1px solid #ddd;page-break-after:always;break-after:page}
.cert-sheet h2{margin:0 0 26mm;text-align:center;font-size:32pt;font-weight:400;letter-spacing:.6em;text-indent:.6em}
.cert-sheet dl{margin:0 0 18mm;font-size:14pt;line-height:1.75;display:grid;grid-template-columns:32mm 1fr;row-gap:4mm}
.cert-sheet dt{font-weight:400;white-space:nowrap}.cert-sheet dd{margin:0}
.cert-sheet .cert-body{text-align:center;font-size:17pt;line-height:1.9;margin:0 0 20mm}
.cert-sheet .cert-date{text-align:center;font-size:18pt;margin:0 0 20mm}
.cert-sheet .cert-site{position:absolute;left:0;right:0;bottom:38mm;text-align:center;font-size:18pt}
.cert-sheet .cert-site img{position:absolute;margin-left:-10mm;margin-top:-10mm;width:25mm;height:26mm}
@media print{body *{visibility:hidden}.cert-print,.cert-print *{visibility:visible}.cert-print{position:absolute;left:0;top:0;width:100%}.cert-sheet{border:0;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:0}}
`;

/**
 * Printable 수료증 / 이수증 / 수납확인서 / 보고서 page (one route: /admin/learning/certificates/print?kind=…). Certificates are previewed
 * as HTML; "PDF 파일" fetches the real PDF the API builds with the PHP FPDF layout (same file name). kind=receipt and kind=report hand
 * off to ReceiptPrint / LearningReport.
 */
export default function CertificatePrintPage() {
  const [sp] = useSearchParams();
  const raw = sp.get('kind') ?? 'completion';
  const params = useMemo(() => { const o: Record<string, string> = {}; sp.forEach((v, k) => { if (k !== 'kind' && v) o[k] = v; }); return o; }, [sp]);
  if (raw === 'receipt') return <ReceiptPrint params={params} />;
  if (raw === 'report') return <LearningReport params={params} />;
  return <SheetPrint kind={(SHEET_KINDS as string[]).includes(raw) ? (raw as SheetKind) : 'completion'} params={params} />;
}

function SheetPrint({ kind, params }: { kind: SheetKind; params: Record<string, string> }) {
  const cfg = SHEET[kind];
  const q = useQuery({ queryKey: ['admin', 'learning', 'certificate', kind, params], queryFn: ({ signal }) => cfg.load(params, signal), enabled: cfg.ready(params) });
  const d = q.data;
  const title = tr(cfg.title, 'Certificate print');
  const [pdfBusy, openPdf] = useCertificatePdf();
  useEffect(() => { if (!d?.fileName) return; const prev = document.title; document.title = d.fileName; return () => { document.title = prev; }; }, [d?.fileName]);
  return (
    <AdminPage title={title} lead={tr('"PDF 파일"은 기존과 같은 PDF 를 받습니다. 아래는 화면 미리보기입니다. 한 장 = 수료자 1명(이수증은 콘텐츠 1개).', '"PDF file" downloads the same PDF as before; below is an on-screen preview. One page per learner (per content for 이수증).')}
      actions={<><AButton variant="primary" icon="file" loading={pdfBusy} onClick={() => openPdf(kind, params)} disabled={!d?.items.length}>{tr('PDF 파일', 'PDF file')}</AButton><AButton icon="file" onClick={() => window.print()} disabled={!d?.items.length}>{tr('화면 인쇄', 'Print this page')}</AButton></>}>
      <style>{PRINT_CSS}</style>
      {!cfg.ready(params) ? <Callout tone="warn">{tr(cfg.need, 'Required parameters are missing.')}</Callout> : null}
      {q.isPending && q.isFetching ? <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>{adm.common.loading}</p> : null}
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : null}
      {d && d.items.length === 0 ? <Callout tone="warn">{(d.diag?.messages?.length ? d.diag.messages : [cfg.empty]).map((m, i) => <div key={i}>{m}</div>)}</Callout> : null}
      {d && d.items.length ? <Callout tone="info">{tr(`${d.items.length}장 · 발급일 ${d.issueDate}`, `${d.items.length} page(s) · issued ${d.issueDate}`)}</Callout> : null}
      {d ? <div className="cert-print">{d.items.map((it, i) => <Sheet key={`${it.studySeq}-${it.lectureCode ?? ''}-${i}`} sheet={d} item={it} />)}</div> : null}
    </AdminPage>
  );
}

function Sheet({ sheet, item }: { sheet: CertificateSheet; item: CertificateSheet['items'][number] }) {
  const subject = sheet.kind === 'subject';
  return (
    <section className="cert-sheet" aria-label={`${sheet.title} ${item.name ?? item.id}`}>
      <h2>{sheet.title}</h2>
      <dl>
        <dt>성      명 :</dt><dd>{item.name ?? item.id}</dd>
        <dt>생년월일 :</dt><dd>{item.birthDay}</dd>
        <dt>소속회사 :</dt><dd>{item.companyName}</dd>
        <dt>훈련과정 :</dt><dd>{item.courseName}</dd>
        <dt>훈련기간 :</dt><dd>{item.periodLabel} ({item.hours}H)</dd>
        {(sheet.showContentsTime ?? subject) ? <><dt>훈련시간 :</dt><dd>{item.contentsTime ?? ''}시간</dd></> : null}
      </dl>
      <div className="cert-body">{sheet.body.map((line, i) => <div key={i}>{line}</div>)}</div>
      <div className="cert-date">{sheet.issueDateLabel}</div>
      <div className="cert-site">{sheet.siteName}<img src={`${LEGACY_SITE_ROOT}/images/company_stamp.png`} alt="" aria-hidden="true" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /></div>
    </section>
  );
}
