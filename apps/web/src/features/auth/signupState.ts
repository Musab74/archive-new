/** Signup consent is kept in sessionStorage between /auth/signup/terms and /auth/signup/info. */
const KEY = 'signup.consent.v1';
export interface SignupConsent { terms: boolean; privacy: boolean; marketing: boolean }
export const readConsent = (): SignupConsent | null => { try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as SignupConsent) : null; } catch { return null; } };
export const writeConsent = (c: SignupConsent) => { try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ } };
export const clearConsent = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
