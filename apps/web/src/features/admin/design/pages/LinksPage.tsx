import { AInput, Callout, Card, FieldRow } from '../../../../shared/ui/admin';
import { useDesignStudio } from '../DesignStudioContext';
import { adm } from '../../strings';

const KEYS = ['axisUrl', 'liveClassUrl', 'kakaoUrl'] as const;
export const isUrlOrEmpty = (v: string): boolean => v === '' || /^https?:\/\/[^\s]+$/i.test(v);

export default function LinksPage() {
  const { draft, update, canWrite } = useDesignStudio();
  if (!draft) return null;
  const t = adm.design.links;
  return (
    <Card title={adm.design.nav.links}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
        {KEYS.map((k) => <FieldRow key={k} label={t[k]} htmlFor={`lk-${k}`} error={!isUrlOrEmpty(draft.links[k]) ? 'https:// 로 시작하는 URL이어야 합니다.' : undefined}><AInput id={`lk-${k}`} type="url" value={draft.links[k]} onChange={(e) => update((d) => ({ ...d, links: { ...d.links, [k]: e.target.value.trim() } }))} placeholder="https://" invalid={!isUrlOrEmpty(draft.links[k])} disabled={!canWrite} /></FieldRow>)}
        <Callout>{t.hint}</Callout>
      </div>
    </Card>
  );
}
