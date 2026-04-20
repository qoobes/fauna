export default function VerifyRequestPage() {
  return (
    <div className="instrument-panel fade-in">
      <span className="ip-c-bl" aria-hidden />
      <span className="ip-c-br" aria-hidden />
      <div className="ip-label">[ 02 / MAIL_SENT ]</div>

      <h1 className="ty-page-title" style={{ fontSize: 20, marginBottom: 12 }}>
        Check your email
      </h1>
      <p className="ty-body" style={{ marginBottom: 16 }}>
        A sign-in link has been sent to your @liverpool.ac.uk address.
      </p>
      <p className="ty-body" style={{ marginBottom: 24 }}>
        The link expires in 10 minutes. If you do not see it, check your spam folder.
      </p>

      <div className="tick-divider" style={{ margin: '24px 0' }} />

      <a href="/sign-in" className="ty-label" style={{ color: 'var(--accent)' }}>
        &larr; BACK TO SIGN_IN
      </a>
    </div>
  );
}
