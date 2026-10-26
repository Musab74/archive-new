import type { LearnerSession } from '@ainex/contracts';

export type Role = 'learner' | 'manager' | 'admin';

/** Roles derived from the learner session. Admin access uses a separate staff session (future admin app slice). */
export function rolesOf(user: LearnerSession | null, admin?: { id: string } | null): Role[] {
  const roles: Role[] = [];
  if (user) roles.push('learner');
  if (user?.eduManager) roles.push('manager');
  if (admin) roles.push('admin');
  return roles;
}

/** Where to send the learner after POST /auth/login, by the `next` field. */
export function routeForNext(next: string, fallback = '/home'): string {
  switch (next) {
    case 'terms': return '/auth/first-terms';
    case 'password': return '/auth/password-change';
    case 'assessment-grant': return '/my/assessment';
    case 'pre-assessment': return '/assessment/pre';
    case 'classroom': return '/my'; // login_ok.php:81-82 테스트 아이디 → 나의 학습실
    case 'home': return fallback;
    default: return fallback;
  }
}

/** Only same-origin relative paths are accepted as a post-login redirect. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return null;
  return raw;
}
