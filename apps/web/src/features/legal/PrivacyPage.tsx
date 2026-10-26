import { LegalDoc } from './LegalDoc';
import { PRIVACY_EFFECTIVE, PRIVACY_LEAD, PRIVACY_SECTIONS } from './legalText';
import { legal } from '../../shared/strings/ko';

/**
 * 개인정보처리방침 = public/etc/privacy.html (privacy_include.html, current version, with the 제3자 제공 / 수강확인 SMS / 마케팅
 * consent texts at the end), plus the 법적고지 and 이메일무단수집거부 notes of AR-20 (the footer links to #legal / #email).
 */
export default function PrivacyPage() {
  return <LegalDoc docKey="privacy" title={legal.privacy.title} lead={PRIVACY_LEAD} sections={[...PRIVACY_SECTIONS, ...legal.privacy.extra]} effectiveDate={PRIVACY_EFFECTIVE} />;
}
