'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const localPart = email.split('@')[0];
  const domainPart = '@' + (email.split('@')[1] ?? '');

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-menu-email">
          <span>{localPart}</span>
          <span className="user-menu-domain">{domainPart}</span>
        </span>
        <span className="user-menu-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-email-full">
            <span className="readout-label">[ SIGNED_IN_AS ]</span>
            <span className="ty-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{email}</span>
          </div>
          <div className="user-menu-divider" />
          <Link href="/account" className="user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            ACCOUNT
          </Link>
          <button
            type="button"
            className="user-menu-item user-menu-item-danger"
            role="menuitem"
            onClick={() => signOut({ redirectTo: '/sign-in' })}
          >
            SIGN_OUT
          </button>
        </div>
      )}
    </div>
  );
}
