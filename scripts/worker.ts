import { integrations } from '../lib/env.ts';
import { startBot, registerCommands } from '../lib/integrations/discord/bot.ts';
import { pollMailbox } from '../lib/integrations/imap.ts';
import { ensureBucket } from '../lib/integrations/minio.ts';

/**
 * Long-running sidecar: Discord gateway bot + IMAP poller + bucket bootstrap.
 * Runs next to the Next.js app (see docker-compose worker service).
 */
async function main() {
  const i = integrations();
  console.log('[worker] integrations:', Object.entries(i).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none');

  if (i.minio) {
    await ensureBucket().then(() => console.log('[worker] minio bucket ready')).catch((e) => console.error('[worker] minio', e.message));
  }

  if (i.discordBot) {
    await registerCommands().catch((e) => console.error('[worker] discord register', e.message));
    await startBot().catch((e) => console.error('[worker] discord bot', e.message));
  }

  if (i.imap) {
    const seconds = Number(process.env.IMAP_POLL_SECONDS ?? 60);
    const loop = async () => {
      try {
        const n = await pollMailbox();
        if (n > 0) console.log(`[worker] imap processed ${n}`);
      } catch (err) {
        console.error('[worker] imap poll failed', err instanceof Error ? err.message : err);
      }
      setTimeout(loop, seconds * 1000);
    };
    setTimeout(loop, 5000);
  }
}

main();
