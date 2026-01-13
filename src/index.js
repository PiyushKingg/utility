// src/index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID; // optional, used for owner commands

if (!TOKEN) {
  console.error('FATAL: DISCORD_TOKEN is not set.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath)) {
  if (!file.endsWith('.js')) continue;
  const cmd = require(path.join(commandsPath, file));
  if (cmd && cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`Loaded command: ${cmd.data.name}`);
  }
}

// load handlers
const interactionHandler = require('./handlers/interactionCreate');
client.on('interactionCreate', async (interaction) => {
  try {
    await interactionHandler(interaction, client, { OWNER_ID });
  } catch (err) {
    console.error('top-level interaction handler error', err);
    try {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal error.', ephemeral: true });
    } catch {}
  }
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  if (process.env.GUILD_ID) {
    console.log('GUILD_ID detected — you can run `node deploy-commands.js` or rely on the register script.');
  } else {
    console.log('No GUILD_ID set — register commands globally with deploy-commands.js if desired.');
  }
});

// lightweight HTTP server for render
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => res.end('ok')).listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

client.login(TOKEN);
