'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      type="button"
      className="btn btn-danger"
      onClick={() => signOut({ redirectTo: '/sign-in' })}
    >
      SIGN_OUT
    </button>
  );
}
