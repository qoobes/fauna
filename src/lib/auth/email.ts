import { Resend } from 'resend';
import { env } from '@/env';

// Lazy client — Resend's constructor throws if API key is undefined, and env.ts
// returns undefined during Next.js build-time module evaluation.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

interface SendVerificationParams {
  identifier: string;
  url: string;
  provider?: unknown;
  token?: string;
  expires?: Date;
  request?: Request;
  theme?: unknown;
}

export async function sendVerificationRequest(params: SendVerificationParams) {
  const { identifier, url } = params;
  const host = new URL(url).host;

  const result = await getResend().emails.send({
    from: env.EMAIL_FROM,
    to: identifier,
    subject: `Sign in to FAUNA`,
    text: `Sign in to ${host}\n\n${url}\n\nThis link expires in 10 minutes. If you did not request this, ignore this email.`,
    html: renderMagicLinkHtml({ url, host }),
  });

  if (result.error) {
    throw new Error(`Failed to send verification email: ${result.error.message}`);
  }
}

function renderMagicLinkHtml({ url, host }: { url: string; host: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Sign in to FAUNA</title>
  </head>
  <body style="margin:0;padding:0;background:#fafaf7;font-family:ui-monospace,'IBM Plex Mono','SFMono-Regular',Consolas,monospace;color:#1a1a17">
    <div style="max-width:520px;margin:0 auto;padding:48px 24px">
      <div style="background:#ffffff;border:1px solid #d5d1c5;padding:40px 32px;position:relative">

        <div style="font-family:'IBM Plex Sans','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:14px;letter-spacing:0.24em;color:#1e4a8c;margin-bottom:32px">
          <span style="color:#143568">[</span>&nbsp;FAUNA&nbsp;<span style="color:#143568">]</span>
        </div>

        <div style="font-family:ui-monospace,'IBM Plex Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.10em;color:#1e4a8c;margin-bottom:20px">
          [ MAGIC_LINK / SIGN_IN ]
        </div>

        <h1 style="font-family:'IBM Plex Serif',Georgia,serif;font-weight:500;font-size:22px;margin:0 0 16px;color:#1a1a17;letter-spacing:-0.01em">
          Sign in to ${host}
        </h1>

        <p style="line-height:1.6;color:#3d3b33;margin:0 0 28px;font-family:'IBM Plex Sans','Helvetica Neue',Arial,sans-serif;font-size:14px">
          Click the button below to sign in. This link expires in 10 minutes.
        </p>

        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#1e4a8c;color:#ffffff;text-decoration:none;font-family:ui-monospace,'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.10em;text-transform:uppercase;border:1px solid #1e4a8c">
          SIGN_IN &rarr;
        </a>

        <div style="margin:32px 0 0;padding-top:20px;border-top:1px solid #e8e5dd">
          <p style="line-height:1.6;color:#9b9788;font-size:11px;margin:0;font-family:ui-monospace,'IBM Plex Mono',monospace;letter-spacing:0.04em">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
