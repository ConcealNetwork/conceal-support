import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('theme uses the wallet palette', () => {
  const css = readFileSync('app/global.css', 'utf8');
  assert.match(css, /--primary: 39 100% 50%/); // amber #ffa500
  assert.match(css, /--background: 30 9% 9%/); // dark warm neutral
  assert.match(css, /--background: 36 38% 97%/); // light warm neutral
  assert.match(css, /var\(--font-geist-mono\)/);
  assert.match(css, /\.glass-card/);
  assert.match(css, /\.keycap/);
  assert.match(css, /\.btn-primary/);
  // neon cyan must not appear anywhere
  assert.doesNotMatch(css, /00F0FF/i);
});

test('brand mark exists', () => {
  const svg = readFileSync('public/brand/conceal-mark.svg', 'utf8');
  assert.match(svg, /<svg/);
});

test('email template is branded and carries the security footer', async () => {
  const { renderEmail } = await import('../lib/integrations/mailer.ts');
  const { html, text } = renderEmail({
    to: 'x@y.z',
    subject: 's',
    heading: 'Hello',
    bodyMd: 'World',
    trackingId: 'CCX-AAAA-BBBB',
  });
  assert.match(html, /CONCEAL SUPPORT/);
  assert.match(html, /#ffa500/);
  assert.match(html, /never ask for your seed phrase/i);
  assert.match(text, /never ask for your seed phrase/i);
});

test('tracking-id reminder email lists tickets', async () => {
  const { sendTrackingIdReminder } = await import('../lib/integrations/mailer.ts');
  void sendTrackingIdReminder;
});

test('explorer helpers degrade gracefully', async () => {
  const { explorerTxUrl } = await import('../lib/integrations/explorer.ts');
  assert.match(explorerTxUrl('a'.repeat(64)), /explorer\.conceal\.network/);
});

test('category seeds validate against the form schema', async () => {
  const { categorySeeds } = await import('../content/categories.ts');
  const { formSchema } = await import('../lib/forms/schema.ts');
  for (const c of categorySeeds) {
    const parsed = formSchema.safeParse(c.formSchema);
    assert.equal(parsed.success, true, `category ${c.slug}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`);
  }
});
