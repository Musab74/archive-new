import styles from './Legal.module.css';
import { LegalDoc } from './LegalDoc';
import { legal } from '../../shared/strings/ko';

export default function PrivacyPage() {
  const t = legal.privacy.table;
  return (
    <LegalDoc docKey="privacy" title={legal.privacy.title} sections={legal.privacy.sections}
      extra={
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">개인정보 수집·이용 내역</caption>
            <thead><tr>{t.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{t.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      } />
  );
}
