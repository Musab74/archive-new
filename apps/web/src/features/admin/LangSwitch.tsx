import styles from './Admin.module.css';
import { cx } from '../../shared/utils/format';
import { Icon } from '../../shared/ui/Icon';
import { getAdminLang, setAdminLang, type AdminLang } from '../../shared/i18n/adminLang';

const OPTIONS: { value: AdminLang; label: string; short: string; name: string }[] = [
  { value: 'ko', label: '한국어', short: 'KO', name: '한국어' },
  { value: 'en', label: 'EN', short: 'EN', name: 'English' },
];

/** 한국어 | EN segmented switch for the admin console. Choosing the other language reloads the page in it. */
export function LangSwitch({ className }: { className?: string }) {
  const current = getAdminLang();
  return (
    <div className={cx(styles.langSwitch, className)} role="group" aria-label="언어 · Language">
      <Icon name="languages" size={16} className={styles.langIcon} />
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" lang={o.value} aria-pressed={current === o.value} title={o.name} aria-label={o.name} onClick={() => setAdminLang(o.value)}><span className={styles.langLong}>{o.label}</span><span className={styles.langShort} aria-hidden="true">{o.short}</span></button>
      ))}
    </div>
  );
}
