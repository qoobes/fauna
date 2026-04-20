import Link from 'next/link';
import { FaunaMark } from '@/components/brand/FaunaMark';
import { FaunaWordmark } from '@/components/brand/FaunaWordmark';
import { UserMenu } from './UserMenu';

export function TopNav({ userEmail }: { userEmail: string }) {
  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <Link href="/" className="top-nav-brand" aria-label="FAUNA home">
          <FaunaMark size={22} className="top-nav-mark" />
          <FaunaWordmark size={13} />
        </Link>

        <div className="top-nav-ruler" aria-hidden />

        <nav className="top-nav-links" aria-label="Primary">
          <Link href="/scans" className="top-nav-link">SCANS</Link>
          <Link href="/" className="top-nav-link">NEW_SCAN</Link>
        </nav>

        <UserMenu email={userEmail} />
      </div>
    </header>
  );
}
