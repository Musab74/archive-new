import { LegalDoc } from './LegalDoc';
import { TERMS_EFFECTIVE, TERMS_SECTIONS } from './legalText';
import { legal } from '../../shared/strings/ko';

/** 이용약관 = public/etc/agreement.html (agreement_include.html, current version). */
export default function TermsPage() {
  return <LegalDoc docKey="terms" title={legal.terms.title} sections={TERMS_SECTIONS} effectiveDate={TERMS_EFFECTIVE} />;
}
