import { SignInForm } from './SignInForm';

const ALLOWED_DOMAIN = 'liverpool.ac.uk';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="instrument-panel fade-in">
      <span className="ip-c-bl" aria-hidden />
      <span className="ip-c-br" aria-hidden />
      <div className="ip-label">[ 01 / SIGN_IN ]</div>

      <h1 className="ty-page-title" style={{ fontSize: 20, marginBottom: 8 }}>
        Sign in to FAUNA
      </h1>
      <p className="ty-body" style={{ marginBottom: 24 }}>
        Enter your <span style={{ color: 'var(--accent)' }}>@{ALLOWED_DOMAIN}</span> email
        address and we will send you a one-time sign-in link.
      </p>

      <SignInForm />

      {params.error && (
        <div className="alert-error" style={{ marginTop: 20 }}>
          {params.error === 'AccessDenied' || params.error === 'Verification'
            ? `Only @${ALLOWED_DOMAIN} email addresses are permitted.`
            : `Sign-in failed: ${params.error}`}
        </div>
      )}
    </div>
  );
}
