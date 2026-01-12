require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || null;
const devGuildId = process.env.DEV_GUILD_ID || null;

if (!token) {
  console.error('DISCORD_TOKEN is required to register commands.');
  process.exit(1);
}

(async () => {
  try {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    for (const file of fs.readdirSync(commandsPath)) {
      if (!file.endsWith('.js')) continue;
      const cmd = require(path.join(commandsPath, file));
      if (cmd && cmd.data) commands.push(cmd.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(token);

    if (devGuildId && clientId) {
      console.log('Registering commands to dev guild:', devGuildId);
      await rest.put(Routes.applicationGuildCommands(clientId, devGuildId), { body: commands });
      console.log('Registered commands to dev guild.');
      process.exit(0);
    }

    if (clientId) {
      console.log('Registering global commands (may take up to 1 hour to propagate)...');
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Registered global commands.');
      process.exit(0);
    }

    console.log('CLIENT_ID not set. Skipping automatic registration. You can register commands manually or set CLIENT_ID/DEV_GUILD_ID env vars.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to register commands', err);
    process.exit(1);
  }
})();
