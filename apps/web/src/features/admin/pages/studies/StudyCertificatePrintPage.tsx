import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminStudiesParityApi, type StudyCertificateSheet } from '../../../../shared/api/endpoints/admin-studies-parity';
import { AButton, AdminPage, Callout } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { isAppError } from '../../../../shared/api/client';
import { tr } from '../../../../shared/i18n/adminLang';
import { LEGACY_SITE_ROOT } from '../learning/learningShared';

const PRINT_CSS = `
.cert-sheet{width:210mm;min-height:297mm;margin:0 auto 16px;padding:28mm 22mm;box-sizing:border-box;background:#fff url(${LEGACY_SITE_ROOT}/images/certi_print_img01.jpg) center/100% 100% no-repeat;color:#111;font-family:'Batang','BatangChe','Nanum Myeongjo',serif;position:relative;border:1px solid #ddd}
.cert-sheet h2{margin:0 0 26mm;text-align:center;font-size:32pt;font-weight:400;letter-spacing:.6em;text-indent:.6em}
.cert-sheet dl{margin:0 0 18mm;font-size:14pt;line-height:1.75;display:grid;grid-template-columns:32mm 1fr;row-gap:4mm}
.cert-sheet dt{font-weight:400;white-space:nowrap}.cert-sheet dd{margin:0}
.cert-sheet .cert-body{text-align:center;font-size:17pt;line-height:1.9;margin:0 0 20mm}
.cert-sheet .cert-date{text-align:center;font-size:18pt;margin:0 0 20mm}
.cert-sheet .cert-site{position:absolute;left:0;right:0;bottom:38mm;text-align:center;font-size:18pt}
.cert-sheet .cert-site img{position:absolute;margin-left:1.5mm;margin-top:-3mm;width:14mm;height:14mm}
@media print{body *{visibility:hidden}.cert-print,.cert-print *{visibility:visible}.cert-print{position:absolute;left:0;top:0;width:100%}.cert-sheet{border:0;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:0}}
`;

/**
 * 수료증 1장 — include/certificate_pdf01.php?Seq= (certificate_layer.php "수료증 PDF로 출력하기"). Rendered as an A4 HTML sheet and printed
 * (or saved as PDF) with the browser; the API has no PDF library. Opened as /admin/studies/:seq?print=certificate (StudyDetailPage delegates here), and
 * also mountable at /admin/studies/:seq/certificate/print.
 */
export default function StudyCertificatePrintPage() {
  const { seq } = useParams();
  const n = Number(seq);
  const q = useQuery({ queryKey: ['admin', 'studies', 'certificate-print', n], queryFn: ({ signal }) => adminStudiesParityApi.certificatePrint(n, signal), enabled: Number.isInteger(n) && n > 0, retry: false });
  const d = q.data;
  return (
    <AdminPage title={tr('수료증 출력', 'Certificate of completion')} lead={tr('브라우저 인쇄(Ctrl+P / ⌘P)로 출력하거나 PDF로 저장하세요. 이 수강 1건의 수료증입니다.', 'Print (Ctrl+P / ⌘P) or save as PDF. One certificate for this enrollment.')}
      actions={<AButton variant="primary" icon="file" onClick={() => window.print()} disabled={!d?.items.length}>{tr('인쇄 / PDF 저장', 'Print / Save PDF')}</AButton>}>
      <style>{PRINT_CSS}</style>
      {q.isError ? (isAppError(q.error) && (q.error.code === 'VALIDATION' || q.error.code === 'NOT_FOUND') ? <Callout tone="warn">{q.error.message}</Callout> : <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} />) : null}
      {d ? <div className="cert-print">{d.items.map((it) => <Sheet key={it.studySeq} sheet={d} item={it} />)}</div> : null}
    </AdminPage>
  );
}

function Sheet({ sheet, item }: { sheet: StudyCertificateSheet; item: StudyCertificateSheet['items'][number] }) {
  return (
    <section className="cert-sheet" aria-label={`${sheet.title} ${item.name ?? item.id}`}>
      <h2>{sheet.title}</h2>
      <dl>
        <dt>성      명 :</dt><dd>{item.name ?? item.id}</dd>
        <dt>생년월일 :</dt><dd>{item.birthDay}</dd>
        <dt>소속회사 :</dt><dd>{item.companyName}</dd>
        <dt>훈련과정 :</dt><dd>{item.courseName}</dd>
        <dt>훈련기간 :</dt><dd>{item.periodLabel} ({item.hours}H)</dd>
      </dl>
      <div className="cert-body">{sheet.body.map((line, i) => <div key={i}>{line}</div>)}</div>
      <div className="cert-date">{sheet.issueDateLabel}</div>
      <div className="cert-site">{sheet.siteName}<img src={`${LEGACY_SITE_ROOT}/images/company_stamp.png`} alt="" aria-hidden="true" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /></div>
    </section>
  );
}
