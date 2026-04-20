'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith('@liverpool.ac.uk')) {
      setClientError('Please use a @liverpool.ac.uk email address.');
      return;
    }

    setLoading(true);
    try {
      await signIn('resend', { email: trimmed, redirectTo: '/' });
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Sign-in failed');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-group" style={{ marginBottom: 20 }}>
        <label className="field-label" htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@liverpool.ac.uk"
          autoComplete="email"
          autoFocus
          required
          className="input mono"
        />
        <span className="field-hint">Must be a @liverpool.ac.uk address</span>
      </div>

      {clientError && (
        <div className="alert-error" style={{ marginBottom: 20 }}>
          {clientError}
        </div>
      )}

      <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
        {loading ? (
          <>
            <span className="spinner" />
            <span>SENDING...</span>
          </>
        ) : (
          <span>SEND SIGN-IN LINK &rarr;</span>
        )}
      </button>
    </form>
  );
}
