require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { setupDatabase } = require('./lib/db');
const interactionHandler = require('./handlers/interactionCreate');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// Load command modules
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath)) {
  if (!file.endsWith('.js')) continue;
  const cmd = require(path.join(commandsPath, file));
  if (cmd && cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await setupDatabase();
  // Optionally register commands automatically in dev guild by environment variable
  if (process.env.DEV_GUILD_ID) {
    try {
      console.log('Registering commands to DEV_GUILD_ID');
      await require('./register-commands')(client);
    } catch (err) {
      console.error('Failed to register commands', err);
    }
  }
});

client.on('interactionCreate', interaction => interactionHandler(interaction, client));

client.login(process.env.DISCORD_TOKEN);
