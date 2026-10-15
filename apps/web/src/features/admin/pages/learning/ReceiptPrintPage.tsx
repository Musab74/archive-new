import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi } from '../../../../shared/api/endpoints/admin-learning';
import { AButton, AdminPage, Callout } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { LEGACY_SITE_ROOT, useCsvDownload } from './learningShared';

const CSS = `
.rc-sheet{width:210mm;margin:0 auto;padding:16mm 12mm;box-sizing:border-box;background:#fff;color:#111;font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:10pt;border:1px solid #ddd}
.rc-sheet h2{text-align:center;font-size:25pt;font-weight:400;margin:0 0 4mm}
.rc-sheet .rc-co{text-align:center;margin:0 0 6mm}
.rc-sheet table{width:100%;border-collapse:collapse}
.rc-sheet th,.rc-sheet td{border:1px solid #000;padding:3px 4px;text-align:center}
.rc-sheet th{background:#e8e8e8;font-weight:400}
.rc-sheet .rc-total td{font-weight:600}
.rc-sheet .rc-foot{text-align:center;margin-top:12mm;line-height:2}
.rc-sheet .rc-site{font-size:20pt;position:relative;display:inline-block;margin-top:6mm}
.rc-sheet .rc-site img{position:absolute;right:-26mm;top:-8mm;width:25mm}
@media print{body *{visibility:hidden}.rc-print,.rc-print *{visibility:visible}.rc-print{position:absolute;left:0;top:0;width:100%}.rc-sheet{border:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:0}}
`;

/** hrd_manager/receipt_confirm_excel.php (수납확인서) — printable sheet + the same .xls download. */
export function ReceiptPrint({ params }: { params: Record<string, string> }) {
  const ready = !!(params.companyCode && params.lectureStart && params.lectureEnd && params.lectureCode);
  const q = useQuery({ queryKey: ['admin', 'learning', 'receipt', params], queryFn: ({ signal }) => adminLearningApi.receipt(params, signal), enabled: ready });
  const [busy, download] = useCsvDownload();
  const d = q.data;
  useEffect(() => { if (!d) return; const prev = document.title; document.title = d.fileName.replace(/\.xls$/, ''); return () => { document.title = prev; }; }, [d]);
  return (
    <AdminPage title={tr('수납확인서', 'Payment receipt')} lead={tr('환급(A) 수료자 기준 자부담금 수납확인서입니다. 브라우저 인쇄(PDF 저장) 또는 엑셀(.xls)로 내려받을 수 있습니다.', 'Self-payment receipt for refund-course completers. Print / save as PDF, or download the .xls.')}
      actions={<><AButton onClick={() => void download(() => adminLearningApi.downloadReceiptXls(params, d?.fileName ?? 'receipt.xls'))} loading={busy} disabled={!ready}>{tr('엑셀(.xls) 다운로드', 'Download .xls')}</AButton><AButton variant="primary" icon="file" onClick={() => window.print()} disabled={!d}>{tr('인쇄 / PDF 저장', 'Print / Save PDF')}</AButton></>}>
      <style>{CSS}</style>
      {!ready ? <Callout tone="warn">{tr('CompanyCode, LectureStart, LectureEnd, LectureCode는 필수입니다.', 'companyCode, lectureStart, lectureEnd and lectureCode are required.')}</Callout> : null}
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : null}
      {ready && !d && !q.isError ? <p className="muted">{adm.common.loading}</p> : null}
      {d ? (
        <div className="rc-print">
          <section className="rc-sheet" aria-label={d.title}>
            <h2>{d.title}</h2>
            <div className="rc-co">{d.companyLabel}</div>
            <table>
              <thead><tr>{d.header.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {d.items.map((r) => <tr key={r.studySeq}><td>{r.no}</td><td>{r.course}</td><td>{r.period}</td><td>{r.companyName}</td><td>{r.name}</td><td>{r.birthDay}</td><td>{r.fee}</td><td>{r.selfPay}</td></tr>)}
                <tr className="rc-total"><td colSpan={6}>{d.totalLabel}</td><td>{d.totalFee}</td><td>{d.totalSelfPay}</td></tr>
              </tbody>
            </table>
            <div className="rc-foot">
              <div>{d.certifyText}</div>
              <div>{d.date}</div>
              <div className="rc-site">{d.siteName}<img src={`${LEGACY_SITE_ROOT}/images/company_stamp.png`} alt="" aria-hidden="true" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /></div>
            </div>
          </section>
        </div>
      ) : null}
    </AdminPage>
  );
}

export default function ReceiptPrintPage() {
  const [sp] = useSearchParams();
  const params: Record<string, string> = {}; sp.forEach((v, k) => { if (v) params[k] = v; });
  return <ReceiptPrint params={params} />;
}
