import { useContext } from 'react';
import { DesignContext } from '../../shared/design/useDesign';

/** SiteInfomation values the PHP legal texts print ($SiteName, $SitePersonalInformationManager, $SitePhone, $SiteEmail). */
export function useLegalInfo(): { siteName?: string; privacyManager?: string; phone?: string; email?: string } {
  const d = useContext(DesignContext);
  return { siteName: d?.company.companyName, privacyManager: d?.company.privacyManager, phone: d?.company.phone, email: d?.company.email };
}
