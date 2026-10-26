import { Link } from 'react-router-dom';
import styles from './Footer.module.css';
import { Icon } from './Icon';
import { useAssetUrl, useDesign } from '../design/useDesign';
import { brand, common, footer as copy, home } from '../strings/ko';
import { cx } from '../utils/format';

function Ext({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<Icon name="arrow-up-right" size={14} /><span className="sr-only"> ({common.external})</span></a>;
}

/**
 * Site footer (AR-20): brand + tagline + contact, link groups (학습 / 고객지원 / 관련 사이트), the company info block
 * from design.company, then legal links + copyright. `compact` keeps only the brand row and the bottom bar.
 */
export function Footer() {
  const { config, company } = useDesign();
  const logo = useAssetUrl(config.branding.logoAssetId);
  const compact = config.layout.footerVariant === 'compact';
  const year = new Date().getFullYear();
  const info: { label?: string; value: string }[] = [];
  if (company.companyName) info.push({ value: company.companyName });
  if (company.ceo) info.push({ label: copy.labels.ceo, value: company.ceo });
  if (company.companyNumber) info.push({ label: copy.labels.companyNumber, value: company.companyNumber });
  if (company.salesReportNumber) info.push({ label: copy.labels.salesReport, value: company.salesReportNumber });
  if (company.fax) info.push({ label: copy.labels.fax, value: company.fax });
  if (company.privacyManager) info.push({ label: copy.labels.privacyManager, value: company.privacyManager });
  // archive/include/footer.html: 문의전화 · 이메일 (SiteInfomation.Email) — AR-01 '학습문의 …'
  if (company.email) info.push({ label: copy.labels.email, value: company.email });
  if (company.address) info.push({ value: company.address });
  const copyright = company.copyright || `© ${year} ${company.companyName || config.branding.siteName}.`;
  const phone = company.phone || home.editorial.cta.phone;
  const phoneHref = `tel:${phone.replace(/[^0-9+]/g, '')}`;
  const related = [
    config.links.liveClassUrl ? <Ext key="academy" href={config.links.liveClassUrl}>{copy.links.academy}</Ext> : null,
    config.links.axisUrl ? <Ext key="axis" href={config.links.axisUrl}>{copy.links.axis}</Ext> : null,
    <Link key="manager" to="/manager">{copy.links.manager}</Link>,
    company.kakaoUrl || config.links.kakaoUrl ? <Ext key="kakao" href={company.kakaoUrl || config.links.kakaoUrl}>카카오톡 상담</Ext> : null,
  ].filter(Boolean);

  return (
    <footer className={cx(styles.footer, compact && styles.compact)} role="contentinfo">
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <Link to="/" className={styles.brand} aria-label={config.branding.siteName}>
              {logo ? <img src={logo} alt={config.branding.logoAlt || config.branding.siteName} />
                : <><span className={styles.badge} aria-hidden="true">{brand.wordmark.charAt(0)}</span><b className={styles.name} aria-hidden="true">{brand.wordmark} <span>{brand.archive}</span></b></>}
            </Link>
            {!compact ? <p className={styles.tagline}>{config.branding.tagline || home.heroTitle.replace('\n', ' ')}</p> : null}
            {!compact ? (
              <a className={styles.contact} href={phoneHref}>
                <span className={styles.contactIcon} aria-hidden="true"><Icon name="phone" size={16} /></span>
                <span><small>{copy.contact}</small><b>{phone}</b></span>
              </a>
            ) : null}
          </div>
          {!compact ? (
            <div className={styles.groups}>
              {copy.groups.map((g) => (
                <nav key={g.title} className={styles.group} aria-label={g.title}>
                  <h2>{g.title}</h2>
                  {g.links.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
                </nav>
              ))}
              <nav className={styles.group} aria-label={copy.related}>
                <h2>{copy.related}</h2>
                {related}
              </nav>
            </div>
          ) : null}
        </div>
        {info.length ? <p className={styles.info}>{info.map((s) => <span key={s.value}>{s.label ? <em>{s.label}</em> : null}{s.value}</span>)}</p> : null}
        <div className={styles.bottom}>
          <nav className={styles.legal} aria-label="약관 및 정책">
            <Link to="/terms">{copy.legal.terms}</Link>
            <Link to="/privacy" className={styles.privacy}>{copy.legal.privacy}</Link>
            <Link to="/privacy#legal">{copy.legal.notice}</Link>
            <Link to="/privacy#email">{copy.legal.email}</Link>
          </nav>
          <span>{copyright}</span>
        </div>
      </div>
    </footer>
  );
}
