import { auth } from '@/auth';
import { SignOutButton } from './SignOutButton';

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email ?? 'unknown';
  const id = session?.user?.id ?? 'unknown';

  return (
    <div className="app-shell" style={{ paddingTop: 64, paddingBottom: 80 }}>
      <div className="ty-label" style={{ marginBottom: 16 }}>[ ACCOUNT ]</div>
      <h1 className="ty-page-title" style={{ marginBottom: 32 }}>Your account</h1>

      <div className="instrument-panel" style={{ maxWidth: 560 }}>
        <span className="ip-c-bl" aria-hidden />
        <span className="ip-c-br" aria-hidden />
        <div className="ip-label">[ SESSION / READOUT ]</div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div className="readout">
            <span className="readout-label">[ EMAIL ]</span>
            <span className="readout-value" style={{ fontSize: 14 }}>{email}</span>
          </div>
          <div className="readout">
            <span className="readout-label">[ USER_ID ]</span>
            <span className="readout-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{id}</span>
          </div>
        </div>

        <div className="tick-divider" style={{ margin: '28px 0 20px' }} />

        <SignOutButton />
      </div>
    </div>
  );
}
