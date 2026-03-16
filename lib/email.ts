import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.vallelogic.com";
const FROM = "ValleLogic <hello@vallelogic.com>";

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your ValleLogic account",
    html: `
      <div style="font-family:monospace;background:#080c14;color:#e2e8f0;padding:40px;max-width:560px">
        <div style="color:#3b82f6;font-size:12px;letter-spacing:0.15em;margin-bottom:24px">VALLELOGIC / NETRUNNER</div>
        <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 16px">Verify your email address</h1>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 28px">
          Click below to verify your email and continue setting up your account.<br/>
          This link expires in <strong style="color:#f1f5f9">24 hours</strong>.
        </p>
        <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 32px;border-radius:3px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em">
          VERIFY EMAIL →
        </a>
        <div style="margin-top:24px;background:#0d1421;border:1px solid #1e2d40;border-radius:3px;padding:12px;font-size:11px;color:#475569;word-break:break-all">
          ${url}
        </div>
        <p style="margin-top:32px;font-size:11px;color:#334155">
          If you didn't create a ValleLogic account, ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, tenantName: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to ValleLogic",
    html: `
      <div style="font-family:monospace;background:#080c14;color:#e2e8f0;padding:40px;max-width:560px">
        <div style="color:#3b82f6;font-size:12px;letter-spacing:0.15em;margin-bottom:24px">VALLELOGIC / NETRUNNER</div>
        <h1 style="color:#f1f5f9;font-size:20px;margin:0 0 16px">You're in.</h1>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 28px">
          Your ValleLogic account for <strong style="color:#f1f5f9">${tenantName}</strong> is active.<br/>
          Head to your dashboard to claim your first NetRunner device.
        </p>
        <a href="${APP_URL}/devices" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 32px;border-radius:3px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em">
          OPEN DASHBOARD →
        </a>
      </div>
    `,
  });
}
