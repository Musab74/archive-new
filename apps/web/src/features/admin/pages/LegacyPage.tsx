import { Link, useParams } from 'react-router-dom';
import { ADMIN_MENU, legacyUrl, menuEntryForPath } from '../../../shared/auth/adminMenu';
import { AButton, AdminPage, Callout, Card } from '../../../shared/ui/admin';
import { Icon } from '../../../shared/ui/Icon';
import { NotFoundPage } from '../../../app/placeholders';
import { GrantGate } from '../GrantGate';
import { adm } from '../strings';

/**
 * /admin/legacy/:slug — a menu entry of the previous admin that is not rebuilt in this console yet. Keeps the old
 * navigation complete and hands the admin over to the existing PHP screen (new tab, its own login) in one click.
 */
export default function LegacyPage() {
  const { slug = '' } = useParams();
  const path = `/admin/legacy/${slug}`;
  const entry = slug === 'my_info'
    ? { group: null, item: { label: adm.top.profile, to: path, grant: '', legacy: 'my_info.php' } }
    : menuEntryForPath(path);
  const file = entry?.item.legacy;
  if (!entry || !file) return <NotFoundPage />;
  const { group, item } = entry;
  const url = legacyUrl(file);
  const siblings = group?.items.filter((i) => i.to !== item.to) ?? [];
  const body = (
    <AdminPage title={item.label} lead={adm.legacy.lead} crumbs={[{ label: adm.top.home, to: '/admin' }, ...(group ? [{ label: group.label }] : []), { label: item.label }]}
      actions={<AButton variant="primary" onClick={() => window.open(url, '_blank', 'noopener')}><Icon name="external" size={16} />{adm.legacy.open}</AButton>}>
      <Card>
        <Callout>{adm.legacy.note}</Callout>
        <p style={{ margin: '14px 0 6px', fontSize: 14 }}>{adm.legacy.target}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 14, wordBreak: 'break-all' }}>{url}</a>
        {siblings.length ? (
          <div style={{ marginTop: 22 }}>
            <h3 style={{ fontSize: 14, margin: '0 0 8px', color: 'var(--c-muted)' }}>{adm.legacy.others}</h3>
            <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
              {siblings.map((s) => <li key={s.to}><Link to={s.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--c-line)', borderRadius: 999, fontSize: 13, textDecoration: 'none', color: 'var(--c-text)' }}>{s.label}{s.legacy ? <Icon name="external" size={12} /> : null}</Link></li>)}
            </ul>
          </div>
        ) : null}
      </Card>
    </AdminPage>
  );
  return item.grant ? <GrantGate grant={item.grant}>{body}</GrantGate> : body;
}
