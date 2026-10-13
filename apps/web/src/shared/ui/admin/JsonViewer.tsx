import { useState } from 'react';
import styles from './admin.module.css';

function Value({ value, depth }: { value: unknown; depth: number }) {
  if (value === null) return <span className={styles.jsonNull}>null</span>;
  if (value === undefined) return <span className={styles.jsonNull}>undefined</span>;
  if (typeof value === 'string') return <span className={styles.jsonStr}>"{value}"</span>;
  if (typeof value === 'number') return <span className={styles.jsonNum}>{String(value)}</span>;
  if (typeof value === 'boolean') return <span className={styles.jsonBool}>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>[]</span>;
    return (
      <details open={depth < 2}>
        <summary>Array({value.length})</summary>
        {value.map((v, i) => <div key={i}><span className={styles.jsonKey}>{i}</span>: <Value value={v} depth={depth + 1} /></div>)}
      </details>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{'{}'}</span>;
    return (
      <details open={depth < 2}>
        <summary>{`{…} ${entries.length} keys`}</summary>
        {entries.map(([k, v]) => <div key={k}><span className={styles.jsonKey}>{k}</span>: <Value value={v} depth={depth + 1} /></div>)}
      </details>
    );
  }
  return <span>{String(value)}</span>;
}

/** Collapsible JSON tree with a copy button. */
export function JsonViewer({ value, label = 'JSON', maxHeight }: { value: unknown; label?: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className={styles.json} role="region" aria-label={label} style={maxHeight ? { maxHeight } : undefined}>
      <button type="button" className={styles.jsonCopy} onClick={() => void copy()}>{copied ? '복사됨' : '복사'}</button>
      <Value value={value} depth={0} />
    </div>
  );
}
