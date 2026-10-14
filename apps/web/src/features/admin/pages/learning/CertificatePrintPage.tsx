import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi, type CertificateSheet } from '../../../../shared/api/endpoints/admin-learning';
import { AButton, AdminPage, Callout } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { tr } from '../../../../shared/i18n/adminLang';
import { LEGACY_SITE_ROOT } from './learningShared';
import { adm } from '../../strings';

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

/** Printable 수료증 / 이수증 (certificate_pdf02.php, study_end2_user_pdf.php) — rendered as HTML and printed with the browser (no PDF library). */
export default function CertificatePrintPage() {
  const [sp] = useSearchParams();
  const kind = sp.get('kind') === 'subject' ? 'subject' : 'completion';
  const params = useMemo(() => { const o: Record<string, string> = {}; sp.forEach((v, k) => { if (k !== 'kind' && v) o[k] = v; }); return o; }, [sp]);
  const q = useQuery({ queryKey: ['admin', 'learning', 'certificate', kind, params], queryFn: ({ signal }) => (kind === 'subject' ? adminLearningApi.subjectCertificatePrint(params, signal) : adminLearningApi.closingCertificates(params, signal)), enabled: kind === 'subject' ? !!params.id : !!(params.companyCode && params.lectureStart && params.lectureEnd) });
  const d = q.data;
  const title = kind === 'subject' ? tr('이수증 출력', 'Certificate (content) print') : tr('수료증 출력', 'Certificate of completion print');
  return (
    <AdminPage title={title} lead={tr('브라우저 인쇄(Ctrl+P / ⌘P)로 출력하거나 PDF로 저장하세요. 한 장 = 수료자 1명(이수증은 콘텐츠 1개).', 'Use the browser print dialog (Ctrl+P / ⌘P) or save as PDF. One page per learner (per content for 이수증).')}
      actions={<AButton variant="primary" icon="file" onClick={() => window.print()} disabled={!d?.items.length}>{tr('인쇄 / PDF 저장', 'Print / Save PDF')}</AButton>}>
      <style>{PRINT_CSS}</style>
      {!q.isFetched && !q.isFetching ? <Callout tone="warn">{kind === 'subject' ? tr('이름/ID를 입력하세요.', 'An ID is required.') : tr('CompanyCode, LectureStart, LectureEnd는 필수입니다.', 'companyCode, lectureStart and lectureEnd are required.')}</Callout> : null}
      {q.isPending && q.isFetching ? <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>{adm.common.loading}</p> : null}
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : null}
      {d && d.items.length === 0 ? <Callout tone="warn">{kind === 'subject' ? tr('이수증을 출력할 데이터가 없습니다. (진도 100% 필요)', 'Nothing to print (progress 100% required).') : tr('수료(PassOK=Y) 대상자가 없습니다.', 'No learner with PassOK=Y.')}</Callout> : null}
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
        {subject ? <><dt>훈련시간 :</dt><dd>{item.contentsTime ?? ''}시간</dd></> : null}
      </dl>
      <div className="cert-body">{sheet.body.map((line, i) => <div key={i}>{line}</div>)}</div>
      <div className="cert-date">{sheet.issueDateLabel}</div>
      <div className="cert-site">{sheet.siteName}<img src={`${LEGACY_SITE_ROOT}/images/company_stamp.png`} alt="" aria-hidden="true" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /></div>
    </section>
  );
}
