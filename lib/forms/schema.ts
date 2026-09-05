import { z } from 'zod';

/**
 * A category's form is a list of these. Stored in categories.form_schema so admins can
 * edit it from the staff console without a deploy.
 */
export const fieldSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('select'),
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string(),
    required: z.boolean().default(false),
    options: z.array(z.object({ value: z.string(), label: z.string() })),
    /** Fill options from a data source at render time (e.g. GitHub releases). */
    source: z.enum(['releases:conceal-desktop', 'releases:conceal-core', 'releases:conceal-wallet-cordova']).optional(),
    help: z.string().optional(),
  }),
  z.object({
    type: z.literal('text'),
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string(),
    required: z.boolean().default(false),
    placeholder: z.string().optional(),
    maxLength: z.number().int().positive().default(200),
    /** Built-in validators that also drive rendering (explorer links etc.). */
    format: z.enum(['ccx_tx_hash', 'evm_tx_hash', 'ccx_address', 'block_height', 'amount']).optional(),
    help: z.string().optional(),
  }),
  z.object({
    type: z.literal('textarea'),
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string(),
    required: z.boolean().default(false),
    placeholder: z.string().optional(),
    maxLength: z.number().int().positive().default(4000),
    help: z.string().optional(),
  }),
  z.object({
    type: z.literal('checkbox'),
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string(),
    help: z.string().optional(),
    /** Special behaviour hooks. */
    effect: z.enum(['confidential']).optional(),
  }),
]);

export type FormField = z.infer<typeof fieldSchema>;
export const formSchema = z.array(fieldSchema);

export const CCX_TX_HASH = /^[0-9a-f]{64}$/i;
export const EVM_TX_HASH = /^0x[0-9a-f]{64}$/i;
export const CCX_ADDRESS = /^ccx7[1-9A-HJ-NP-Za-km-z]{94}$/;

export function validateFormat(format: NonNullable<Extract<FormField, { type: 'text' }>['format']>, value: string) {
  const v = value.trim();
  switch (format) {
    case 'ccx_tx_hash':
      return CCX_TX_HASH.test(v) ? null : 'Expected a 64-character hex transaction hash.';
    case 'evm_tx_hash':
      return EVM_TX_HASH.test(v) ? null : 'Expected an EVM transaction hash (0x + 64 hex characters).';
    case 'ccx_address':
      return CCX_ADDRESS.test(v) ? null : 'Expected a CCX address starting with ccx7 (98 characters).';
    case 'block_height':
      return /^\d{1,9}$/.test(v) ? null : 'Expected a block height (digits only).';
    case 'amount':
      return /^\d+(\.\d{1,6})?$/.test(v) ? null : 'Expected an amount such as 12.5 (up to 6 decimals).';
  }
}

/** Validate submitted values against a category's schema. Returns { values, errors }. */
export function validateFields(fields: FormField[], input: Record<string, unknown>) {
  const values: Record<string, string | boolean> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = input[f.id];
    if (f.type === 'checkbox') {
      values[f.id] = raw === true || raw === 'on' || raw === 'true';
      continue;
    }
    const str = typeof raw === 'string' ? raw.trim() : '';
    if (!str) {
      if (f.required) errors[f.id] = `${f.label} is required.`;
      continue;
    }
    if (f.type === 'select') {
      const allowed = f.options.some((o) => o.value === str);
      if (!allowed && !f.source) {
        errors[f.id] = `Choose one of the listed options.`;
        continue;
      }
    } else if (str.length > f.maxLength) {
      errors[f.id] = `${f.label} is too long (max ${f.maxLength}).`;
      continue;
    } else if (f.type === 'text' && f.format) {
      const err = validateFormat(f.format, str);
      if (err) {
        errors[f.id] = err;
        continue;
      }
    }
    values[f.id] = str;
  }
  return { values, errors };
}
