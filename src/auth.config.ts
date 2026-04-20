import type { NextAuthConfig } from 'next-auth';
import { isAllowedEmail } from '@/lib/auth/domain-gate';

export const authConfig = {
  pages: {
    signIn: '/sign-in',
    verifyRequest: '/sign-in/verify',
    error: '/sign-in',
  },
  callbacks: {
    async signIn({ user }) {
      // Runs both when a magic-link is requested AND when it is consumed.
      // Gate the domain on both so only @liverpool.ac.uk ever receives or uses a link.
      return isAllowedEmail(user?.email);
    },
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      if (pathname.startsWith('/sign-in') || pathname.startsWith('/api/auth')) {
        return true;
      }
      return isLoggedIn;
    },
  },
  providers: [], // filled in auth.ts
} satisfies NextAuthConfig;
