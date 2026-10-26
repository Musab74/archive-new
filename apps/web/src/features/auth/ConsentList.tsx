import { useState } from 'react';
import styles from './Auth.module.css';
import type { Consents } from './signupState';
import { Button } from '../../shared/ui/Button';
import { Checkbox } from '../../shared/ui/Form';
import { LegacyHtml } from '../../shared/ui/LegacyHtml';
import { MARKETING_TEXT, PRIVACY_LEAD, PRIVACY_SECTIONS, SENDING_TEXT, TERMS_SECTIONS, THIRD_PARTY_HTML, fillLegal } from '../legal/legalText';
import { useLegalInfo } from '../legal/useLegalInfo';
import { auth as copy } from '../../shared/strings/ko';

type ItemKey = 'terms' | 'privacy' | 'thirdParty' | 'sending' | 'marketing';

/** The full text behind each 보기 (public/etc/include/*.html and the join_terms.html notes). */
function docHtml(key: ItemKey): string {
  switch (key) {
    case 'terms': return TERMS_SECTIONS.map((s) => `<h4>${s.title}</h4>${s.html}`).join('');
    case 'privacy': return PRIVACY_LEAD + PRIVACY_SECTIONS.map((s) => `<h4>${s.title}</h4>${s.html}`).join('');
    case 'thirdParty': return THIRD_PARTY_HTML;
    case 'sending': return `<p>${SENDING_TEXT}</p>`;
    default: return `<p>${MARKETING_TEXT}</p>`;
  }
}

/** First unchecked required item's PHP alert (function.js JoinStep / termsAgree order), or ''. */
export function consentError(c: Consents): string {
  const missing = copy.consent.items.find((it) => it.required && !c[it.key as 'terms' | 'privacy' | 'thirdParty']);
  return missing?.error ?? '';
}

const checked = (c: Consents, key: ItemKey) => (key === 'marketing' ? c.marketingEmail || c.marketingSms : c[key]);

/**
 * 약관 동의 list of join_terms.html / after_join_terms.html: 모두 동의, 3 required + 수강확인 SMS·알림톡·메일 + 마케팅 (이메일 / SMS).
 * Items start unchecked (AR-20 06). 마케팅 checks both channels; a channel alone keeps 마케팅 checked (JoinAgreeCheckA).
 */
export function ConsentList({ value, onChange }: { value: Consents; onChange: (next: Consents) => void }) {
  const info = useLegalInfo();
  const [open, setOpen] = useState<ItemKey | null>(null);
  const all = value.terms && value.privacy && value.thirdParty && value.sending && value.marketingEmail && value.marketingSms;
  const set = (key: ItemKey, on: boolean) => onChange(key === 'marketing' ? { ...value, marketingEmail: on, marketingSms: on } : { ...value, [key]: on });
  return (
    <div>
      <div className={styles.consentAll}>
        <Checkbox label={copy.consent.all} checked={all} onChange={(e) => { const on = e.target.checked; onChange({ terms: on, privacy: on, thirdParty: on, sending: on, marketingEmail: on, marketingSms: on }); }} />
      </div>
      {copy.consent.items.map((it) => {
        const key = it.key as ItemKey;
        return (
          <div key={key}>
            <div className={styles.consentRow}>
              <Checkbox label={<>{it.label} <b>({it.required ? '필수' : '선택'})</b></>} checked={checked(value, key)} onChange={(e) => set(key, e.target.checked)} />
              <Button variant="text" size="xs" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>{copy.consent.view}</Button>
            </div>
            {key === 'sending' ? <p className={styles.consentWarn}>*{copy.consent.sendingWarn}</p> : null}
            {key === 'marketing' ? (
              <div className={styles.consentSub}>
                <Checkbox label={copy.consent.marketingEmail} checked={value.marketingEmail} onChange={(e) => onChange({ ...value, marketingEmail: e.target.checked })} />
                <Checkbox label={copy.consent.marketingSms} checked={value.marketingSms} onChange={(e) => onChange({ ...value, marketingSms: e.target.checked })} />
              </div>
            ) : null}
            {open === key ? <div className={styles.docBox}><LegacyHtml html={fillLegal(docHtml(key), info)} /></div> : null}
          </div>
        );
      })}
    </div>
  );
}
