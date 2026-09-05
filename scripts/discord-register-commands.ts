import { registerCommands } from '../lib/integrations/discord/bot.ts';

await registerCommands();
console.log('discord slash commands registered');
process.exit(0);
