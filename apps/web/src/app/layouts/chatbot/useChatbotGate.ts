import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { chromeApi } from '../../../shared/api/endpoints/chrome';

type Bot = 'ruby' | 'kobe';

/**
 * include/ruby_rollout.php / kobe_rollout.php order: `?ruby=1|0` (and `?kobe=…`) wins and is remembered in the
 * hrde_<bot>_rollout cookie for QA sessions, then that cookie, then the server flag (GET /chatbot/config).
 */
export function rolloutOverride(bot: Bot, search: string, cookie: string): boolean | null {
  const q = new URLSearchParams(search).get(bot);
  if (q === '1' || q === '0') return q === '1';
  const c = cookie.split('; ').find((x) => x.startsWith(`hrde_${bot}_rollout=`))?.split('=')[1];
  return c ? c === '1' : null;
}

export function useChatbotGate(): { ruby: boolean; kobe: boolean } {
  const { search } = useLocation();
  const cfg = useQuery({ queryKey: ['chatbot', 'config'], queryFn: ({ signal }) => chromeApi.chatbotConfig(signal), staleTime: 10 * 60_000, retry: false });
  return useMemo(() => {
    const cookie = typeof document === 'undefined' ? '' : document.cookie;
    const pick = (bot: Bot) => {
      const q = new URLSearchParams(search).get(bot);
      if ((q === '1' || q === '0') && typeof document !== 'undefined') document.cookie = `hrde_${bot}_rollout=${q}; path=/; SameSite=Lax`;
      return rolloutOverride(bot, search, cookie) ?? cfg.data?.[bot] === true;
    };
    return { ruby: pick('ruby'), kobe: pick('kobe') };
  }, [search, cfg.data]);
}
