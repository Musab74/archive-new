import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Select } from '../../shared/ui/Form';
import { my as copy } from '../../shared/strings/ko';

const c = copy.company;

/**
 * AR-15 기업자체교육. The API has no company-training listing endpoint (checked ai-trainer.md), so the page renders
 * the storyboard structure (hero, search/type filters, company panel from GET /members/me/company) with the EMPTY state.
 */
export default function MyCompanyTraining() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const company = useQuery({ queryKey: ['members', 'company'], queryFn: ({ signal }) => myRoomApi.company(signal) });
  if (company.isError && isAppError(company.error) && company.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      <section className={`${styles.card} ${styles.soft}`}><h2 style={{ whiteSpace: 'pre-line', fontSize: 20 }}>{c.heroTitle}</h2><p className={styles.note} style={{ fontSize: 13 }}>{c.heroBody}</p></section>
      {company.isPending ? <Skeleton height={60} /> : company.isError ? <StateBlock code="ACCESS_ERROR" title={copy.profile.companyFail} onRetry={() => void company.refetch()} /> : !company.data ? (
        <StateBlock code="NO_ACCESS" title={c.noCompanyTitle} body={c.noCompanyBody} actions={<Button square size="sm" to="/my/profile">{copy.nav.profile}</Button>} />
      ) : (
        <>
          <dl className={styles.kv}><div><dt>{c.companyLabel}</dt><dd>{company.data.companyName ?? company.data.companyCode}</dd></div></dl>
          <div className={styles.filters}>
            <label style={{ flex: 1, minWidth: 200 }}>{c.search}<input type="search" value={q} placeholder={c.search} onChange={(e) => setQ(e.target.value)} /></label>
            <label>{c.type}<Select value={type} options={c.types.map((t, i) => ({ value: i === 0 ? '' : t, label: t }))} onValueChange={setType} /></label>
          </div>
          <StateBlock code="EMPTY" symbol="briefcase" title={c.emptyTitle} body={c.emptyBody} actions={<Button variant="secondary" square size="sm" to="/support/counsel">{c.inquiry}</Button>} />
        </>
      )}
      <p className={styles.note}>{c.note}</p>
    </div>
  );
}
