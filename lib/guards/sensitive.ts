import { CRYPTONOTE_WORDS } from './cryptonote-words.ts';

const WORDS: ReadonlySet<string> = new Set(CRYPTONOTE_WORDS);

export type GuardVerdict = {
  /** hard → reject the submission entirely; warn → allow but show a caution */
  level: 'ok' | 'warn' | 'block';
  /** user-facing message */
  message: string | null;
};

const SEED_LENGTHS = new Set([25]); // CryptoNote seed; 24 words + 1 checksum word
const KEY_HEX = /\b[0-9a-f]{64}\b/gi;

function hasMnemonicRun(text: string): number {
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  let best = 0;
  let run = 0;
  for (const t of tokens) {
    run = WORDS.has(t) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Checks free text for material that must never reach the ticket system:
 * 25-word CryptoNote mnemonics (hard block), bare 64-hex keys (warn) and
 * password-ish phrases (warn). The block decision is reproducible server-side
 * so a tampered client cannot bypass it.
 */
export function checkSensitive(text: string): GuardVerdict {
  const words = hasMnemonicRun(text);
  if (SEED_LENGTHS.has(words)) {
    return {
      level: 'block',
      message:
        'This looks like a 25-word seed phrase. Never share it with anyone, including Conceal support — no legitimate responder will ever ask for it. Remove it and describe the problem in your own words instead.',
    };
  }

  const hex = text.match(KEY_HEX) ?? [];
  // A 64-hex string next to tx/hash context is a transaction hash — fine.
  const nearHash = /\b(?:tx|transaction|hash|txid)\b[^\n]{0,24}$/im.test(text);
  if (hex.length > 0 && !nearHash) {
    return {
      level: 'warn',
      message:
        'One or more 64-character hex strings were detected. Transaction hashes are fine to share, but spend or view keys look the same — double-check before submitting.',
    };
  }

  if (/\b(spend key|view key|mnemonic|seed phrase|private key|wallet password)\b/i.test(text)) {
    return {
      level: 'warn',
      message:
        'Your message mentions keys or passwords. You do not need to share them for any support request — remove them before submitting.',
    };
  }

  return { level: 'ok', message: null };
}
