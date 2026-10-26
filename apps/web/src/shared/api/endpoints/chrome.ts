import { api } from '../client';

/** Site chrome data: home popups (popup/include_popup.php) and the 러비 / 코비 chatbots (api/ruby/*, api/kobe/trigger.php). */

export interface PopupBox { imageUrl: string | null; width: number; height: number; left: number; top: number }
export interface SitePopup extends PopupBox { idx: number; title: string; endDate: string | null; mobile?: PopupBox; links: { num: number; area: string; url: string }[] }

export interface RubyCourseLink { label: string; url: string }
export interface RubyEscalation { userMessage: string; botContext: string; similarity: number; confidence: number }
export interface RubyReply {
  ok: boolean;
  reply: string;
  courseLinks: RubyCourseLink[];
  escalation: RubyEscalation | null;
  meta: { intent: string; source: string; fallbackCount: number; followupIntent: string; escalation: boolean };
}
export interface RubyTicketResult { created: boolean; pending: boolean; released: boolean; reply: string; ticketId: number | null }

export interface KobePayload {
  ok: boolean;
  show: boolean;
  module_id: number;
  message: string;
  cta: { label: string; url: string } | null;
  recommended_courses: { name: string; code: string; url: string }[];
  role: 'guest' | 'learner' | 'manager';
}

export const chromeApi = {
  /** GET /support/popups — active popups (UseYN=Y, EndDate ≥ today) with PC and mobile boxes and image-map links. */
  popups: (signal?: AbortSignal) => api.get<SitePopup[]>('/support/popups', { signal, auth: false }),
  /** GET /chatbot/config — RUBY_ROLLOUT_ENABLED / KOBE_ROLLOUT_ENABLED. */
  chatbotConfig: (signal?: AbortSignal) => api.get<{ ruby: boolean; kobe: boolean }>('/chatbot/config', { signal, auth: false }),
  rubyReply: (body: { message: string; fallbackCount: number; followupIntent: string }, signal?: AbortSignal) => api.post<RubyReply>('/chatbot/ruby/reply', body, { signal }),
  rubyTicket: (body: { message: string; escalation: RubyEscalation }) => api.post<RubyTicketResult>('/chatbot/ruby/tickets', body),
  kobeTrigger: (q: { page: string; event: string; pagePath: string; pageHash: string }, signal?: AbortSignal) => api.get<KobePayload>('/chatbot/kobe/trigger', { query: q, signal }),
};
