import type { FormField } from '@/lib/forms/schema';

const DOCS = 'https://concealnetwork.github.io/conceal-wiki/docs';

export type CategorySeed = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  formSchema: FormField[];
  docLinks: { title: string; href: string }[];
};

const os = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos-apple', label: 'macOS (Apple silicon)' },
  { value: 'macos-intel', label: 'macOS (Intel)' },
  { value: 'linux', label: 'Linux' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'browser', label: 'Browser (web wallet)' },
  { value: 'other', label: 'Other' },
];

export const categorySeeds: CategorySeed[] = [
  {
    slug: 'wallets',
    name: 'Wallets',
    description: 'Desktop, Web, Android, Core CLI and paper wallets — sync, balance, sending, deposits, messaging, restore.',
    sortOrder: 1,
    defaultPriority: 'medium',
    formSchema: [
      {
        type: 'select',
        id: 'wallet',
        label: 'Wallet',
        required: true,
        options: [
          { value: 'desktop', label: 'Conceal Desktop' },
          { value: 'web', label: 'Web Wallet (wallet.conceal.network)' },
          { value: 'android', label: 'Android' },
          { value: 'core-cli', label: 'Core CLI (concealwallet)' },
          { value: 'paper', label: 'Paper wallet' },
          { value: 'other', label: 'Other / not sure' },
        ],
      },
      {
        type: 'text',
        id: 'version',
        label: 'Version',
        required: false,
        placeholder: 'e.g. 6.7.4',
        maxLength: 40,
        help: 'Shown in the wallet under About / Settings.',
      },
      { type: 'select', id: 'os', label: 'Operating system / device', required: true, options: os },
      {
        type: 'select',
        id: 'problem',
        label: 'What is happening?',
        required: true,
        options: [
          { value: 'sync', label: 'Wallet will not sync or is stuck' },
          { value: 'balance', label: 'Balance or history looks wrong' },
          { value: 'send', label: 'Cannot send / transaction failed' },
          { value: 'receive', label: 'Funds sent to me have not arrived' },
          { value: 'deposit', label: 'Deposit (earn) issue' },
          { value: 'messaging', label: 'Encrypted messaging' },
          { value: 'startup', label: 'App will not start / crashes' },
          { value: 'restore', label: 'Restore or import' },
          { value: 'other', label: 'Something else' },
        ],
      },
      {
        type: 'text',
        id: 'tx_hash',
        label: 'Transaction hash (optional)',
        required: false,
        format: 'ccx_tx_hash',
        maxLength: 64,
        help: 'Only the transaction hash — never a key.',
      },
      {
        type: 'text',
        id: 'wallet_height',
        label: 'Wallet block height (optional)',
        required: false,
        format: 'block_height',
        maxLength: 9,
      },
    ],
    docLinks: [
      { title: 'Troubleshooting', href: `${DOCS}/troubleshooting/` },
      { title: 'Wallets', href: `${DOCS}/wallets/` },
      { title: 'Backup and security', href: `${DOCS}/backup-and-security/` },
    ],
  },
  {
    slug: 'bridge',
    name: 'Bridge (wCCX)',
    description: 'Wrapping CCX to wCCX or unwrapping back on Ethereum, BSC or Polygon.',
    sortOrder: 2,
    defaultPriority: 'medium',
    formSchema: [
      {
        type: 'select',
        id: 'direction',
        label: 'Direction',
        required: true,
        options: [
          { value: 'ccx-to-wccx', label: 'CCX → wCCX (wrap)' },
          { value: 'wccx-to-ccx', label: 'wCCX → CCX (unwrap)' },
        ],
      },
      {
        type: 'select',
        id: 'chain',
        label: 'EVM chain',
        required: true,
        options: [
          { value: 'ethereum', label: 'Ethereum' },
          { value: 'bsc', label: 'BNB Smart Chain' },
          { value: 'polygon', label: 'Polygon' },
        ],
      },
      { type: 'text', id: 'ccx_tx_hash', label: 'CCX transaction hash', required: false, format: 'ccx_tx_hash', maxLength: 64 },
      { type: 'text', id: 'evm_tx_hash', label: 'EVM transaction hash', required: false, format: 'evm_tx_hash', maxLength: 66 },
      { type: 'text', id: 'amount', label: 'Amount', required: true, format: 'amount', maxLength: 20 },
      { type: 'text', id: 'when', label: 'Approximate date and time (UTC)', required: false, maxLength: 60 },
    ],
    docLinks: [
      { title: 'wCCX bridge', href: `${DOCS}/wccx-bridge/` },
      { title: 'How transactions move', href: `${DOCS}/transactions/` },
    ],
  },
  {
    slug: 'chain-security',
    name: 'Chain / Security',
    description: 'Nodes, mining, consensus questions and responsible security disclosures.',
    sortOrder: 3,
    defaultPriority: 'medium',
    formSchema: [
      {
        type: 'select',
        id: 'topic',
        label: 'Topic',
        required: true,
        options: [
          { value: 'node', label: 'Node / daemon' },
          { value: 'mining', label: 'Mining' },
          { value: 'consensus', label: 'Consensus / fork / chain data' },
          { value: 'deposits', label: 'Deposits protocol' },
          { value: 'security', label: 'Security report' },
        ],
      },
      { type: 'text', id: 'node_version', label: 'Core version', required: false, maxLength: 40, placeholder: 'e.g. 6.7.4' },
      { type: 'select', id: 'os', label: 'Operating system', required: false, options: os.filter((o) => !['android', 'ios', 'browser'].includes(o.value)) },
      {
        type: 'textarea',
        id: 'log_excerpt',
        label: 'Relevant log lines (optional)',
        required: false,
        maxLength: 6000,
        help: 'Remove wallet addresses and anything private before pasting.',
      },
      {
        type: 'checkbox',
        id: 'confidential',
        label: 'This is a responsible security disclosure — keep it confidential',
        effect: 'confidential',
        help: 'Only administrators will see this ticket and it is routed to a private channel.',
      },
    ],
    docLinks: [
      { title: 'Run a node', href: `${DOCS}/run-a-node/` },
      { title: 'Mining', href: `${DOCS}/mining/` },
      { title: 'Releases and verification', href: `${DOCS}/releases-and-verification/` },
    ],
  },
  {
    slug: 'general',
    name: 'General',
    description: 'Exchanges and listings, the marketplace, the website, documentation feedback, partnerships.',
    sortOrder: 4,
    defaultPriority: 'low',
    formSchema: [
      {
        type: 'select',
        id: 'topic',
        label: 'Topic',
        required: true,
        options: [
          { value: 'exchange', label: 'Exchange or listing' },
          { value: 'marketplace', label: 'Marketplace' },
          { value: 'website', label: 'Website' },
          { value: 'docs', label: 'Documentation feedback' },
          { value: 'partnership', label: 'Partnership / press' },
          { value: 'other', label: 'Other' },
        ],
      },
    ],
    docLinks: [
      { title: 'Start here', href: `${DOCS}/start-here/` },
      { title: 'Glossary', href: `${DOCS}/glossary/` },
    ],
  },
];
