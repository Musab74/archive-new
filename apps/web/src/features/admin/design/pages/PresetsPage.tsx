import { useQuery } from '@tanstack/react-query';
import { THEME_PRESETS } from '@ainex/contracts';
import styles from '../../Admin.module.css';
import { designApi } from '../../../../shared/api/endpoints/design';
import { AButton, Callout, StatusBadge } from '../../../../shared/ui/admin';
import { cx } from '../../../../shared/utils/format';
import { useAdminMutation } from '../../useAdminMutation';
import { useDesignStudio } from '../DesignStudioContext';
import { MiniSite, Swatches } from '../ThemePreviewCard';
import { withTheme } from '../designHelpers';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';

export default function PresetsPage() {
  const { draft, canWrite, dirty, adopt } = useDesignStudio();
  const presets = useQuery({ queryKey: ['design', 'presets'], queryFn: ({ signal }) => designApi.presets(signal), staleTime: 10 * 60_000 });
  const apply = useAdminMutation({ fn: (id: string) => designApi.applyPreset(id), success: (res) => adm.design.presets.applied(res.config.presetId), onSuccess: (res) => adopt(res.config, res.baseVersion) });
  if (!draft) return null;
  const list = presets.data ?? THEME_PRESETS.map((p) => ({ id: p.id, name: p.name, description: p.description, theme: p.theme }));
  const current = list.find((p) => p.id === draft.presetId);
  const customised = !!current && JSON.stringify(current.theme) !== JSON.stringify(draft.theme);
  return (
    <div>
      {dirty ? <Callout tone="warn" className="u-mb-8">{tr('프리셋 적용은 서버 초안을 바로 바꿉니다. 저장하지 않은 로컬 변경은 덮어쓰입니다.', 'Applying a preset changes the server draft immediately. Unsaved local changes will be overwritten.')}</Callout> : null}
      {customised ? <Callout className="u-mb-8">{adm.design.presets.custom}</Callout> : null}
      <div className={styles.presetGrid}>
        {list.map((p) => {
          const active = p.id === draft.presetId;
          return (
            <div key={p.id} className={cx(styles.presetCard, active && styles.active)}>
              <MiniSite config={withTheme(draft, p.theme, p.id)} />
              <div className={styles.presetBody}>
                <h3>{p.name} {active ? <StatusBadge tone="ok">{adm.design.presets.current}</StatusBadge> : null}</h3>
                <p>{p.description}</p>
                <Swatches theme={p.theme} />
                <AButton size="sm" variant={active ? 'default' : 'primary'} disabled={!canWrite} title={canWrite ? undefined : adm.readOnly} loading={apply.isPending && apply.variables === p.id} onClick={() => apply.mutate(p.id)}>{adm.design.presets.apply}</AButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
