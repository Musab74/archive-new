import { LegalDoc } from './LegalDoc';
import { legal } from '../../shared/strings/ko';

export default function TermsPage() {
  return <LegalDoc docKey="terms" title={legal.terms.title} sections={legal.terms.sections} />;
}
