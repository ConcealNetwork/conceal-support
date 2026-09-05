import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { env, integrations } from '@/lib/env';
import { excerpt, mdToPlainText } from '@/lib/guards/markdown';
import {
  getTicketByTrackingId,
  getTicketById,
  addMessage,
  addNote,
  setTicketStatus,
  setTicketPriority,
  assignTicket,
  logEvent,
} from '@/lib/tickets/service';
import { findStaffByDiscordId } from '@/lib/auth/staff';
import { normalizeTrackingId } from '@/lib/guards/tickets';

let client: Client | null = null;

export function discordClient(): Client | null {
  if (!integrations().discordBot) return null;
  return client;
}

export const COMMANDS = [
  new SlashCommandBuilder().setName('ticket')
    .setDescription('Conceal support ticket actions')
    .addSubcommand((s) => s.setName('view').setDescription('Show a ticket').addStringOption((o) => o.setName('id').setDescription('Tracking ID, e.g. CCX-XXXX-XXXX').setRequired(true)))
    .addSubcommand((s) => s.setName('assign').setDescription('Assign a ticket to yourself').addStringOption((o) => o.setName('id').setDescription('Tracking ID').setRequired(true)))
    .addSubcommand((s) => s.setName('status').setDescription('Set ticket status').addStringOption((o) => o.setName('id').setDescription('Tracking ID').setRequired(true))
      .addStringOption((o) => o.setName('status').setDescription('New status').setRequired(true)
        .addChoices(
          { name: 'open', value: 'open' }, { name: 'waiting_customer', value: 'waiting_customer' },
          { name: 'waiting_staff', value: 'waiting_staff' }, { name: 'on_hold', value: 'on_hold' },
          { name: 'resolved', value: 'resolved' }, { name: 'closed', value: 'closed' })))
    .addSubcommand((s) => s.setName('priority').setDescription('Set ticket priority').addStringOption((o) => o.setName('id').setDescription('Tracking ID').setRequired(true))
      .addStringOption((o) => o.setName('priority').setDescription('Priority').setRequired(true)
        .addChoices(
          { name: 'low', value: 'low' }, { name: 'medium', value: 'medium' },
          { name: 'high', value: 'high' }, { name: 'critical', value: 'critical' })))
    .addSubcommand((s) => s.setName('reply').setDescription('Reply to a ticket (customer-visible)').addStringOption((o) => o.setName('id').setDescription('Tracking ID').setRequired(true))
      .addStringOption((o) => o.setName('text').setDescription('Reply text (markdown)').setRequired(true)))
    .addSubcommand((s) => s.setName('note').setDescription('Add an internal note (not visible to the customer)').addStringOption((o) => o.setName('id').setDescription('Tracking ID').setRequired(true))
      .addStringOption((o) => o.setName('text').setDescription('Note text').setRequired(true)))
    .toJSON(),
] as const;

export async function registerCommands(): Promise<void> {
  if (!integrations().discordBot) return;
  const e = env();
  const rest = new REST().setToken(e.DISCORD_BOT_TOKEN!);
  await rest.put(Routes.applicationGuildCommands(e.DISCORD_CLIENT_ID!, e.DISCORD_GUILD_ID!), { body: COMMANDS });
  console.log('[discord] guild commands registered');
}

export async function startBot(): Promise<void> {
  if (!integrations().discordBot || client) return;
  const e = env();
  client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (c) => console.log(`[discord] bot ready as ${c.user.tag}`));
  client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    try {
      await handleCommand(i);
    } catch (err) {
      console.error('[discord] command failed', err);
      if (i.deferred || i.replied) return;
      await i.reply({ content: 'That failed — check the logs.', flags: MessageFlags.Ephemeral });
    }
  });

  await client.login(e.DISCORD_BOT_TOKEN);
}

function staffRoleId(): string | null {
  return env().DISCORD_STAFF_ROLE_ID ?? null;
}

/** Only members holding the support-staff role may use the commands. */
async function requireStaff(i: ChatInputCommandInteraction): Promise<{ id: string; name: string } | null> {
  const member = await i.guild?.members.fetch(i.user.id);
  const roleId = staffRoleId();
  if (roleId && !member?.roles.cache.has(roleId)) {
    await i.reply({ content: 'You need the support-staff role for that.', flags: MessageFlags.Ephemeral });
    return null;
  }
  return { id: i.user.id, name: i.user.displayName ?? i.user.username };
}

async function handleCommand(i: ChatInputCommandInteraction): Promise<void> {
  const staff = await requireStaff(i);
  if (!staff) return;
  const sub = i.options.getSubcommand();
  const id = normalizeTrackingId(i.options.getString('id', true));

  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const ticket = await getTicketByTrackingId(id);
  if (!ticket) {
    await i.editReply(`No ticket ${id}.`);
    return;
  }

  switch (sub) {
    case 'view': {
      const embed = await ticketEmbed(ticket.id);
      await i.editReply({ content: `Ticket **${ticket.trackingId}**`, embeds: [embed] });
      return;
    }
    case 'assign': {
      const me = await findStaffByDiscordId(staff.id);
      await assignTicket(ticket.id, me?.id ?? null);
      await logEvent(ticket.id, 'assigned', { by: 'discord', staff: staff.name }, 'staff', me?.id);
      await postToThread(ticket.id, `✏️ Assigned to **${staff.name}**`);
      await i.editReply(`Assigned ${ticket.trackingId} to you.`);
      return;
    }
    case 'status': {
      const status = i.options.getString('status', true) as never;
      await setTicketStatus(ticket.id, status);
      await logEvent(ticket.id, 'status_changed', { status, by: 'discord' }, 'staff');
      await postToThread(ticket.id, `🔧 Status set to **${status}** by ${staff.name}`);
      await i.editReply(`${ticket.trackingId} → ${status}`);
      return;
    }
    case 'priority': {
      const priority = i.options.getString('priority', true) as never;
      await setTicketPriority(ticket.id, priority);
      await logEvent(ticket.id, 'priority_changed', { priority, by: 'discord' }, 'staff');
      await postToThread(ticket.id, `🔺 Priority set to **${priority}** by ${staff.name}`);
      await i.editReply(`${ticket.trackingId} priority → ${priority}`);
      return;
    }
    case 'reply': {
      const text = i.options.getString('text', true);
      const me = await findStaffByDiscordId(staff.id);
      if (!me) {
        await i.editReply('Your Discord account is not linked to a staff profile in the support app.');
        return;
      }
      const messageId = await addMessage({
        ticketId: ticket.id,
        authorType: 'staff',
        authorName: me.displayName,
        authorStaffId: me.id,
        bodyMd: text,
        via: 'discord',
      });
      await logEvent(ticket.id, 'staff_replied', { via: 'discord' }, 'staff', me.id);
      await postCustomerMessage(ticket.id, messageId, me.displayName, text);
      await i.editReply(`Reply posted on ${ticket.trackingId}.`);
      return;
    }
    case 'note': {
      const text = i.options.getString('text', true);
      const me = await findStaffByDiscordId(staff.id);
      if (!me) {
        await i.editReply('Your Discord account is not linked to a staff profile in the support app.');
        return;
      }
      await addNote(ticket.id, me.id, me.displayName, text);
      await i.editReply(`Note added to ${ticket.trackingId}.`);
      return;
    }
  }
}

function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xffa500)
    .setFooter({ text: 'Conceal Support' })
    .setTimestamp(new Date());
}

export async function ticketEmbed(ticketId: string): Promise<EmbedBuilder> {
  const t = await getTicketById(ticketId);
  const embed = baseEmbed().setTitle(`${t!.trackingId} — ${t!.subject}`).setURL(`${env().APP_URL}/staff/ticket/${t!.id}`);
  embed.addFields(
    { name: 'Status', value: t!.status.replaceAll('_', ' '), inline: true },
    { name: 'Priority', value: t!.priority, inline: true },
    { name: 'Requester', value: t!.isConfidential ? '*(confidential)*' : t!.requesterName, inline: true },
  );
  return embed;
}

/** Create the per-ticket forum thread in #support-queue and mirror the opening message. */
export async function announceTicket(ticketId: string, openingMd: string): Promise<{ threadId?: string; messageId?: string }> {
  const c = discordClient();
  const e = env();
  if (!c) return {};
  try {
    const t = await getTicketById(ticketId);
    const channelId = t!.isConfidential ? e.DISCORD_SECURITY_CHANNEL_ID : e.DISCORD_QUEUE_CHANNEL_ID;
    if (!channelId) return {};
    const channel = await c.channels.fetch(channelId);
    if (!channel || !('threads' in channel)) return {};

    const embed = await ticketEmbed(ticketId);
    const first = await (channel as import('discord.js').TextChannel).send({
      embeds: [embed],
      content: t!.isConfidential ? '🔒 Confidential security ticket — admin visibility only.' : undefined,
    });
    // If the channel is a forum, start a thread from the message; otherwise use a public thread.
    let threadId: string | undefined;
    if ('startThread' in first) {
      const thread = await (first as import('discord.js').Message).startThread({
        name: `${t!.trackingId} — ${t!.subject}`.slice(0, 100),
        autoArchiveDuration: 60 * 24 * 7,
      });
      threadId = thread.id;
    }
    await dbPatchThread(ticketId, threadId, first.id);
    await postToThread(ticketId, excerpt(openingMd, 800));
    return { threadId, messageId: first.id };
  } catch (err) {
    console.error('[discord] announceTicket failed', err);
    return {};
  }
}

async function dbPatchThread(ticketId: string, threadId?: string, messageId?: string): Promise<void> {
  await db
    .update(schema.tickets)
    .set({ discordThreadId: threadId, discordMessageId: messageId })
    .where(eq(schema.tickets.id, ticketId));
}

/** Post a line into the ticket's thread (best-effort). */
export async function postToThread(ticketId: string, bodyMd: string): Promise<void> {
  const c = discordClient();
  const t = await getTicketById(ticketId);
  if (!c || !t?.discordThreadId) return;
  try {
    const thread = await c.channels.fetch(t.discordThreadId);
    if (thread && thread.isTextBased() && 'send' in thread) {
      await (thread as import('discord.js').TextChannel).send(mdToPlainText(bodyMd).slice(0, 1900));
    }
  } catch (err) {
    console.error('[discord] postToThread failed', err);
  }
}

/** Mirror a customer-visible staff reply into the thread with content preview. */
export async function postCustomerMessage(ticketId: string, messageId: string, staffName: string, bodyMd: string): Promise<void> {
  void messageId;
  await postToThread(ticketId, `**${staffName}** replied:\n${excerpt(bodyMd, 600)}`);
}

/** Announce to a private channel (security reports). */
export async function postSecurityNotice(ticketId: string, note: string): Promise<void> {
  const c = discordClient();
  const e = env();
  if (!c || !e.DISCORD_SECURITY_CHANNEL_ID) return;
  try {
    const channel = await c.channels.fetch(e.DISCORD_SECURITY_CHANNEL_ID);
    if (channel && channel.isTextBased() && 'send' in channel) {
      await (channel as import('discord.js').TextChannel).send(`🔒 ${note} — <${env().APP_URL}/staff/ticket/${ticketId}>`);
    }
  } catch (err) {
    console.error('[discord] postSecurityNotice failed', err);
  }
}
