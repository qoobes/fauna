import { env } from '@/env';

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.trim().toLowerCase().split('@')[1];
  return domain === env.ALLOWED_EMAIL_DOMAIN;
}
