/** Signup consent is kept in sessionStorage between /auth/signup/terms and /auth/signup/info (join_terms.html → join_info.html). */
const KEY = 'signup.consent.v2';
export interface Consents { terms: boolean; privacy: boolean; thirdParty: boolean; sending: boolean; marketingEmail: boolean; marketingSms: boolean }
export const emptyConsents = (): Consents => ({ terms: false, privacy: false, thirdParty: false, sending: false, marketingEmail: false, marketingSms: false });
export const requiredAgreed = (c: Consents) => c.terms && c.privacy && c.thirdParty;
export const readConsent = (): Consents | null => { try { const raw = sessionStorage.getItem(KEY); return raw ? { ...emptyConsents(), ...(JSON.parse(raw) as Partial<Consents>) } : null; } catch { return null; } };
export const writeConsent = (c: Consents) => { try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ } };
export const clearConsent = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
