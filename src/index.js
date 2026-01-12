require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('FATAL: DISCORD_TOKEN is not set in environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// load commands
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath)) {
  if (!file.endsWith('.js')) continue;
  const cmd = require(path.join(commandsPath, file));
  if (cmd && cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`Loaded command: ${cmd.data.name}`);
  }
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  // Print quick hint about registering commands:
  console.log('Tip: run `npm run register-commands` (if you set CLIENT_ID/DEV_GUILD_ID) to register slash commands.');
});

client.on('interactionCreate', async (interaction) => {
  try {
    const handler = require('./handlers/interactionCreate');
    await handler(interaction, client);
  } catch (err) {
    console.error('Error handling interaction', err);
    if (interaction.replied || interaction.deferred) {
      try { await interaction.followUp({ content: 'An internal error occurred.', ephemeral: true }); } catch {}
    } else {
      try { await interaction.reply({ content: 'An internal error occurred.', ephemeral: true }); } catch {}
    }
  }
});

client.login(TOKEN);
