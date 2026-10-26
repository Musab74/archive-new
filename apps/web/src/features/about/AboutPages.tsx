import { NavLink } from 'react-router-dom';
import styles from './AboutPages.module.css';
import { useDesign } from '../../shared/design/useDesign';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { about as copy, nav } from '../../shared/strings/ko';

function AboutNav() {
  return (
    <nav className={styles.tabs} aria-label={copy.crumb}>
      {copy.nav.map((n) => <NavLink key={n.to} to={n.to} end>{n.label}</NavLink>)}
    </nav>
  );
}

/** archive/introduce/archive.html (훈련제도 안내): the training-system facts, support rates, process and refund guide. */
export function AboutArchivePage() {
  const a = copy.archive;
  return (
    <article>
      <section className={`band ${styles.head}`}>
        <Breadcrumb items={[{ label: nav.archive, to: '/' }, { label: copy.crumb }, { label: copy.nav[0]!.label }]} />
        <h1>{a.title}</h1>
        <p>{a.lead}</p>
        <AboutNav />
      </section>
      <div className={styles.body}>
        <dl className={styles.facts}>
          {a.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
        </dl>
        <div className={styles.support}>
          {a.support.map((s) => (
            <section key={s.label} className={styles.card} aria-label={s.label}>
              <h2>{s.label}</h2>
              <ul>{s.rows.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>
            </section>
          ))}
        </div>
        <p className={styles.note}>{a.supportNote}</p>
        <p className={styles.note}><b>{a.applyPeriod}</b></p>

        <section className={styles.block} aria-labelledby="about-process">
          <h2 id="about-process">{a.processTitle}</h2>
          <ol className={styles.process}>
            {a.process.map((p) => <li key={p.n}><small>{p.n}</small><strong>{p.title}</strong><em>{p.when}</em><span>{p.desc}</span></li>)}
          </ol>
          <ul className={styles.cycle}>{a.cycle.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>

        <section className={styles.block} aria-labelledby="about-refund">
          <h2 id="about-refund">{a.refundTitle}</h2>
          <p>{a.refundLead}</p>
          <div className={styles.refund}>
            {a.refundBlocks.map((b) => (
              <section key={b.title} className={styles.card}>
                <h3>{b.title}</h3>
                <ul className={styles.bullets}>{b.items.map((t) => <li key={t}>{t}</li>)}</ul>
              </section>
            ))}
          </div>
        </section>

        <section className={styles.block} aria-labelledby="about-steps">
          <h2 id="about-steps">{a.stepsTitle}</h2>
          <ol className={styles.steps}>{a.steps.map((s, i) => <li key={s}><small>step {String(i + 1).padStart(2, '0')}</small><strong>{s}</strong></li>)}</ol>
          <ul className={styles.bullets}>{a.stepsNotes.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
        <div className="action-row"><Button square to="/support/inquiry/new" iconRight={<Icon name="arrow" size={15} />}>{a.cta}</Button></div>
      </div>
    </article>
  );
}

/** archive/introduce/company.html (회사소개): the three pillars, vision and location; contact values come from 사이트 정보 when set. */
export function AboutCompanyPage() {
  const c = copy.company;
  const { company } = useDesign();
  const address = company.address || c.fallback.address;
  const phone = company.phone || c.fallback.phone;
  const email = company.email || c.fallback.email;
  return (
    <article>
      <section className={`band ${styles.head}`}>
        <Breadcrumb items={[{ label: nav.archive, to: '/' }, { label: copy.crumb }, { label: copy.nav[1]!.label }]} />
        <h1>{c.title}</h1>
        <p>{c.lead}</p>
        <AboutNav />
      </section>
      <div className={styles.body}>
        <div className={styles.pillars}>
          {c.pillars.map((p) => <section key={p.title} className={styles.card}><h2>{p.title}</h2><p>{p.desc}</p></section>)}
        </div>
        <section className={styles.block} aria-labelledby="about-vision">
          <h2 id="about-vision">{c.vision}</h2>
          <p className={styles.vision}>{c.visionText}</p>
        </section>
        <section className={styles.block} aria-labelledby="about-location">
          <h2 id="about-location">{c.location}</h2>
          <dl className={styles.facts}>
            <div><dt>{c.address}</dt><dd>{address}</dd></div>
            <div><dt>{c.phone}</dt><dd><a href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>{phone}</a></dd></div>
            <div><dt>{c.email}</dt><dd><a href={`mailto:${email}`}>{email}</a></dd></div>
          </dl>
          <h3>{c.transit}</h3>
          <dl className={styles.facts}>
            <div><dt>{c.bus}</dt><dd>{c.busLines}</dd></div>
            <div><dt>{c.express}</dt><dd>{c.expressLines}</dd></div>
          </dl>
        </section>
      </div>
    </article>
  );
}
