import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // Exclude /api/* entirely — API routes handle auth with await auth() and return JSON 401s.
  // Also exclude Next.js internals and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
