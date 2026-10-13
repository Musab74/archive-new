import { Link } from 'react-router-dom';
import styles from './Footer.module.css';
import { useAssetUrl, useDesign } from '../design/useDesign';
import { brand, common, footer as copy } from '../strings/ko';
import { cx } from '../utils/format';

function Ext({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children} <span aria-hidden="true">↗</span><span className="sr-only"> ({common.external})</span></a>;
}

/** Site footer (AR-20): brand, external/partner links, company info line from design.company, legal links + copyright. */
export function Footer() {
  const { config, company } = useDesign();
  const logo = useAssetUrl(config.branding.logoAssetId);
  const editorial = config.layout.heroVariant === 'visual-right';
  const year = new Date().getFullYear();
  const info: string[] = [];
  if (company.companyName) info.push(company.companyName);
  if (company.ceo) info.push(`${copy.labels.ceo} ${company.ceo}`);
  if (company.companyNumber) info.push(`${copy.labels.companyNumber} ${company.companyNumber}`);
  if (company.salesReportNumber) info.push(`${copy.labels.salesReport} ${company.salesReportNumber}`);
  if (company.phone) info.push(`${copy.labels.phone} ${company.phone}`);
  if (company.fax) info.push(`${copy.labels.fax} ${company.fax}`);
  if (company.email) info.push(`${copy.labels.email} ${company.email}`);
  if (company.privacyManager) info.push(`${copy.labels.privacyManager} ${company.privacyManager}`);
  if (company.address) info.push(company.address);
  const copyright = company.copyright || `© ${year} ${company.companyName || config.branding.siteName}.`;

  return (
    <footer className={cx(styles.footer, config.layout.footerVariant === 'compact' && styles.compact)} role="contentinfo">
      <div className={styles.inner}>
        <div className={styles.top}>
          <Link to="/" className={cx(styles.brand, !logo && editorial && styles.inline)} aria-label={config.branding.siteName}>
            {logo ? <img src={logo} alt={config.branding.logoAlt || config.branding.siteName} />
              : editorial ? <><span className={styles.badge} aria-hidden="true">{brand.wordmark.charAt(0)}</span><b className={styles.name} aria-hidden="true">{brand.wordmark} <span>{brand.archive}</span></b></>
              : <><b aria-hidden="true">{brand.wordmark}</b><span aria-hidden="true">{brand.archive}</span></>}
          </Link>
          <nav className={styles.links} aria-label="관련 사이트">
            {config.links.liveClassUrl ? <Ext href={config.links.liveClassUrl}>{copy.links.academy}</Ext> : null}
            {config.links.axisUrl ? <Ext href={config.links.axisUrl}>{copy.links.axis}</Ext> : null}
            <Link to="/manager">{copy.links.manager}</Link>
            <Link to="/support/guide">{copy.support}</Link>
            {company.kakaoUrl || config.links.kakaoUrl ? <Ext href={company.kakaoUrl || config.links.kakaoUrl}>카카오톡 상담</Ext> : null}
          </nav>
        </div>
        <p className={styles.info}>{info.map((s) => <span key={s}>{s}</span>)}</p>
        <div className={styles.bottom}>
          <div>
            <Link to="/terms">{copy.legal.terms}</Link>
            <Link to="/privacy">{copy.legal.privacy}</Link>
            <Link to="/privacy#legal">{copy.legal.notice}</Link>
            <Link to="/privacy#email">{copy.legal.email}</Link>
          </div>
          <span>{copyright}</span>
        </div>
      </div>
    </footer>
  );
}
