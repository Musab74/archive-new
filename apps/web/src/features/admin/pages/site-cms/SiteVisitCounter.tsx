import { useSiteVisitCounter } from './useSiteVisitCounter';

/**
 * Drop-in for the public (learner) shells: renders nothing and counts one visit per browser session into Sta
 * (POST /v1/visits), like the 접속 통계 block at the end of include/include_bottom.php and m/m_include/include_bottom.php.
 * Mount it once inside every public layout (not the admin console, the manager console or the player).
 */
export function SiteVisitCounter({ enabled = true }: { enabled?: boolean }) {
  useSiteVisitCounter(enabled);
  return null;
}

export default SiteVisitCounter;
