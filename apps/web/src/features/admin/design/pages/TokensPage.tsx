import { useState } from 'react';
import styles from '../../Admin.module.css';
import { AButton, AInput, Callout, Card, StatusBadge } from '../../../../shared/ui/admin';
import { cx } from '../../../../shared/utils/format';
import { useDesignStudio } from '../DesignStudioContext';
import { IssueList } from '../PublishDialog';
import { GRADIENT_TOKENS, TOKEN_GROUPS, isHex, issuesForToken, normalizeHex, presetThemeFor, type ColorTokenKey, type GradientTokenKey } from '../designHelpers';
import { MiniSite } from '../ThemePreviewCard';
import { adm } from '../../strings';

function ColorRow({ token, label, hint, value, presetValue, onChange, disabled, issueLevel }: { token: ColorTokenKey; label: string; hint: string; value: string; presetValue: string; onChange: (v: string) => void; disabled: boolean; issueLevel: 'error' | 'warning' | null }) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : value;
  const commit = (raw: string) => { const n = normalizeHex(raw); if (n) onChange(n); else setText(value); };
  return (
    <div className={cx(styles.tokenRow, issueLevel === 'error' && styles.hasError, issueLevel === 'warning' && styles.hasWarn)}>
      <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={`${label} 색상`} disabled={disabled} />
      <div className={styles.tokenName}><b>{label}</b><small title={hint}>{hint}</small></div>
      <AInput aria-label={`${label} HEX`} value={shown} onFocus={() => { setText(value); setFocused(true); }} onBlur={() => { setFocused(false); commit(text); }} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(text); (e.target as HTMLInputElement).blur(); } }} invalid={!isHex(value)} className="mono" maxLength={7} disabled={disabled} />
      <AButton size="xs" variant="ghost" onClick={() => onChange(presetValue)} disabled={disabled || value === presetValue} title={`${adm.design.tokens.reset} ${presetValue}`}>↺</AButton>
    </div>
  );
}

export default function TokensPage() {
  const { draft, update, canWrite, issues, server } = useDesignStudio();
  if (!draft) return null;
  const preset = presetThemeFor(draft.presetId);
  const setToken = (key: ColorTokenKey | GradientTokenKey, value: string) => update((d) => ({ ...d, theme: { ...d.theme, [key]: value } }));
  const serverIssues = server?.issues ?? [];
  const errors = issues.filter((i) => i.level === 'error').length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 12, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TOKEN_GROUPS.map((g) => (
          <Card key={g.key} title={adm.design.tokens.groups[g.key as keyof typeof adm.design.tokens.groups] ?? g.label}>
            <div className={styles.tokenGrid}>
              {g.tokens.map((t) => { const ti = issuesForToken(issues, t.key); const level = ti.some((i) => i.level === 'error') ? 'error' : ti.length ? 'warning' : null; return <ColorRow key={t.key} token={t.key} label={t.label} hint={t.hint} value={draft.theme[t.key]} presetValue={preset[t.key]} onChange={(v) => setToken(t.key, v)} disabled={!canWrite} issueLevel={level} />; })}
            </div>
          </Card>
        ))}
        <Card title={adm.design.tokens.groups.gradient}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GRADIENT_TOKENS.map((t) => (
              <div key={t.key} className={styles.gradRow}>
                <div className={styles.tokenName} style={{ gap: 4 }}><b>{t.label} <span className="muted" style={{ fontWeight: 400 }}>— {t.hint}</span></b><AInput aria-label={t.label} value={draft.theme[t.key]} onChange={(e) => setToken(t.key, e.target.value)} className="mono" maxLength={400} disabled={!canWrite} /></div>
                <div className={styles.gradSwatch} style={{ background: draft.theme[t.key] }} aria-hidden="true" />
                <AButton size="xs" variant="ghost" onClick={() => setToken(t.key, preset[t.key])} disabled={!canWrite || draft.theme[t.key] === preset[t.key]} title={adm.design.tokens.reset}>↺</AButton>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div style={{ position: 'sticky', top: 72, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card title={adm.design.actions.preview}><MiniSite config={draft} /></Card>
        <Card title={adm.design.tokens.issues} aside={errors ? <StatusBadge tone="danger">{adm.design.overview.errors(errors)}</StatusBadge> : <StatusBadge tone="ok">OK</StatusBadge>}>
          <IssueList issues={issues} />
          {serverIssues.length && !issues.length ? <Callout className="u-mt-8">서버 검증(저장본): {serverIssues.map((i) => i.path).join(', ')}</Callout> : null}
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>기준: 본문/배경 ≥ 3:1(권장 4.5), 흰 글자/primary ≥ 3:1. 오류가 있으면 게시할 수 없습니다.</p>
        </Card>
      </div>
    </div>
  );
}
