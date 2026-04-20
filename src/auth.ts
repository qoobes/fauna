import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { authConfig } from './auth.config';
import { sendVerificationRequest } from '@/lib/auth/email';
import { env } from '@/env';

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  providers: [
    Resend({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      maxAge: 10 * 60, // 10 minutes
      sendVerificationRequest,
    }),
  ],
  secret: env.AUTH_SECRET,
});
