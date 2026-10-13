import type { CSSProperties } from 'react';
import type { DesignConfig } from '@ainex/contracts';
import styles from '../Admin.module.css';
import { scopedVars } from './designHelpers';

/** Miniature site rendered with the config's tokens as scoped CSS variables (no :root changes). */
export function MiniSite({ config, siteName }: { config: DesignConfig; siteName?: string }) {
  const vars = scopedVars(config) as unknown as CSSProperties;
  return (
    <div className={styles.mini} style={vars} aria-hidden="true">
      <div className={styles.miniHeader}><i /><u /><u /><u /><span style={{ marginLeft: 'auto', color: 'var(--c-primary)', fontWeight: 700 }}>{siteName ?? config.branding.siteName}</span></div>
      <div className={styles.miniHero}>
        <div style={{ flex: 1 }}>
          <h4>필요한 배움을,<br />필요한 순간에.</h4>
          <p>AI ZONE · 직무 · 리더십</p>
          <span className={styles.miniBtn}>콘텐츠 둘러보기</span><span className={styles.miniBtn2}>로그인</span>
        </div>
        <div style={{ width: 54, height: 40, borderRadius: 6, background: 'var(--c-surface-soft, var(--c-soft))', border: '1px solid var(--c-line-2)' }} />
      </div>
      <div className={styles.miniBand} />
      <div className={styles.miniCards}><span /><span /><span /></div>
      <div className={styles.miniDark}>AXIS 자격검정 · 다음 도전</div>
    </div>
  );
}

export function Swatches({ theme }: { theme: DesignConfig['theme'] }) {
  const keys = ['primary', 'primaryDeep', 'accent', 'accentWarm', 'ink', 'text', 'surfaceSoft', 'background'] as const;
  return <div className={styles.swatches}>{keys.map((k) => <span key={k} title={`${k} ${theme[k]}`} style={{ background: theme[k] }} />)}</div>;
}
