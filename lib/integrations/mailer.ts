import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env, integrations } from '@/lib/env';
import { renderMarkdown } from '@/lib/guards/markdown';

let transporter: Transporter | null = null;

function mailer(): Transporter | null {
  if (!integrations().smtp) return null;
  if (!transporter) {
    const e = env();
    transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export function replyToAddress(trackingId: string): string {
  const e = env();
  return `${e.MAIL_REPLY_LOCALPART}+${trackingId}@${e.MAIL_REPLY_DOMAIN}`;
}

const SECURITY_FOOTER =
  'Conceal staff will never ask for your seed phrase, private keys or wallet password. ' +
  'If someone claiming to be Conceal support asks for these, it is a scam.';

type MailInput = {
  to: string;
  subject: string;
  heading: string;
  bodyMd: string;
  trackingId?: string;
  link?: { label: string; url: string };
};

/** Simple branded text+HTML email using the wallet palette inline styles. */
export function renderEmail(input: MailInput): { html: string; text: string } {
  const text = `${input.heading}\n\n${input.bodyMd.replace(/<[^>]*>/g, '')}${input.link ? `\n\n${input.link.label}: ${input.link.url}` : ''}\n\n—\n${SECURITY_FOOTER}`;
  const cta = input.link
    ? `<a href="${input.link.url}" style="display:inline-block;background:#ffa500;color:#000;font-weight:600;border-radius:9999px;padding:10px 22px;text-decoration:none;">${input.link.label}</a>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#1a1715;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;color:#fff;">
    <p style="font-family:monospace;font-size:11px;letter-spacing:.18em;color:#ffa500;margin:0 0 18px;">CONCEAL SUPPORT</p>
    <h1 style="font-size:22px;margin:0 0 12px;">${input.heading}</h1>
    <div style="font-size:14px;line-height:1.65;color:#e0e0e0;">${renderMarkdown(input.bodyMd)}</div>
    ${cta ? `<div style="margin:24px 0;">${cta}</div>` : ''}
    ${input.trackingId ? `<p style="font-family:monospace;font-size:13px;color:#b0b0b0;">Ticket <span style="color:#ffa500;font-weight:bold;">${input.trackingId}</span></p>` : ''}
    <hr style="border:none;border-top:1px solid #322d28;margin:24px 0;" />
    <p style="font-size:12px;color:#757575;margin:0;">${SECURITY_FOOTER}</p>
  </div></body></html>`;
  return { html, text };
}

export async function sendMail(input: MailInput): Promise<boolean> {
  const t = mailer();
  if (!t) return false;
  const { html, text } = renderEmail(input);
  try {
    await t.sendMail({
      from: env().MAIL_FROM,
      to: input.to,
      subject: input.subject,
      text,
      html,
      replyTo: input.trackingId ? replyToAddress(input.trackingId) : undefined,
    });
    return true;
  } catch (err) {
    console.error('[mailer] send failed', err);
    return false;
  }
}

export async function sendTrackingIdReminder(email: string, tickets: { trackingId: string; subject: string; status: string }[]): Promise<boolean> {
  if (tickets.length === 0) return false;
  const lines = tickets.map((t) => `- ${t.trackingId} — ${t.subject} (${t.status.replaceAll('_', ' ')})`).join('\n');
  return sendMail({
    to: email,
    subject: `Your Conceal Support tickets`,
    heading: 'Your tickets',
    bodyMd: `Here are the tickets associated with your email address:\n\n${lines}`,
  });
}
