import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSensitive } from '../lib/guards/sensitive.ts';
import { newTrackingId, isValidTrackingId, signToken, verifyToken } from '../lib/guards/tickets.ts';
import { renderMarkdown, mdToPlainText, excerpt } from '../lib/guards/markdown.ts';
import { validateFields, validateFormat, type FormField } from '../lib/forms/schema.ts';

test('blocks a 25-word CryptoNote mnemonic', () => {
  const real = [
    'adult', 'adventure', 'aerial', 'afar', 'affair', 'afield', 'afloat', 'afoot',
    'afraid', 'after', 'against', 'agenda', 'aggravate', 'agile', 'aglow', 'agnostic',
    'agony', 'agreed', 'ahead', 'aided', 'ailments', 'aimless', 'airport', 'aisle', 'ajar',
  ].join(' ');
  assert.equal(checkSensitive(real).level, 'block');
  assert.equal(checkSensitive(`my seed is ${real} please help`).level, 'block');
  // non-dictionary tokens are not a mnemonic run
  assert.equal(checkSensitive('word0 word1 word2 word3').level, 'ok');
});

test('normal text passes the guard', () => {
  assert.equal(checkSensitive('My wallet will not sync after the update. Height 12345.').level, 'ok');
});

test('a transaction hash with context does not warn', () => {
  assert.equal(checkSensitive('My tx hash 3f1a'.padEnd(74, 'a4b2') + ' did not confirm').level !== 'block', true);
});

test('tracking ids', () => {
  for (let i = 0; i < 50; i++) {
    const id = newTrackingId();
    assert.match(id, /^CCX-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    assert.equal(isValidTrackingId(id), true);
  }
  assert.equal(isValidTrackingId('ccx-abcd-efg0'), true);
  assert.equal(isValidTrackingId('XXX-AAAA-BBBB'), false);
});

test('signed tokens round-trip and reject tampering', () => {
  const t = signToken('ticket:CCX-AAAA-BBBB:user@example.com', 'secret-secret-secret');
  assert.equal(verifyToken(t, 'secret-secret-secret'), 'ticket:CCX-AAAA-BBBB:user@example.com');
  assert.equal(verifyToken(t + 'x', 'secret-secret-secret'), null);
  assert.equal(verifyToken(t, 'other-secret-other-secret'), null);
});

test('markdown is sanitized', () => {
  const html = renderMarkdown('# hi\n\n<script>alert(1)</script>\n\n[link](https://x.com)');
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('rel="noopener noreferrer nofollow"'), true);
  assert.equal(mdToPlainText('<b>bold</b> &amp; more'), 'bold & more');
  assert.equal(excerpt('word '.repeat(200), 20).length, 20);
});

test('form field validation', () => {
  const fields: FormField[] = [
    { type: 'select', id: 'wallet', label: 'Wallet', required: true, options: [{ value: 'desktop', label: 'Desktop' }] },
    { type: 'text', id: 'tx', label: 'Tx hash', required: false, format: 'ccx_tx_hash', maxLength: 64 },
    { type: 'checkbox', id: 'confidential', label: 'Confidential' },
  ];
  const good = validateFields(fields, { wallet: 'desktop', tx: 'a'.repeat(64), confidential: 'on' });
  assert.deepEqual(good.errors, {});
  assert.equal(good.values.confidential, true);

  const bad = validateFields(fields, { wallet: 'nope', tx: 'zzz' });
  assert.equal(bad.errors.wallet !== undefined, true);
  assert.equal(bad.errors.tx !== undefined, true);

  assert.equal(validateFormat('ccx_tx_hash', 'a'.repeat(64)), null);
  assert.equal(validateFormat('evm_tx_hash', '0x' + 'a'.repeat(64)), null);
  assert.equal(validateFormat('ccx_address', 'ccx7' + 'V'.repeat(94)), null);
  assert.equal(validateFormat('amount', '12.5'), null);
  assert.equal(validateFormat('ccx_tx_hash', 'nothex'), 'Expected a 64-character hex transaction hash.');
});
