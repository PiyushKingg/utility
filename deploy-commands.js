require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
if (!TOKEN) {
  console.error('FATAL: DISCORD_TOKEN is not set in environment variables.');
  process.exit(1);
}
if (!GUILD_ID) {
  console.error('FATAL: GUILD_ID is not set. Set GUILD_ID to the Discord server id where you want commands registered.');
  process.exit(1);
}

(async () => {
  try {
    const commands = [];
    const commandsPath = path.join(__dirname, 'src', 'commands');
    if (!fs.existsSync(commandsPath)) {
      console.error(`Commands folder not found at ${commandsPath}`);
      process.exit(1);
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if (!command || !command.data) {
        console.warn(`Skipping ${file} — no exported 'data' (SlashCommandBuilder) found.`);
        continue;
      }
      commands.push(command.data.toJSON());
    }

    if (commands.length === 0) {
      console.warn('No commands found to register. Exiting.');
      process.exit(0);
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    // Determine application (client) id: prefer CLIENT_ID env var, otherwise fetch via API
    let clientId = process.env.CLIENT_ID;
    if (!clientId) {
      console.log('CLIENT_ID not provided. Fetching application info to determine client id...');
      const appInfo = await rest.get(Routes.oauth2CurrentApplication());
      if (!appInfo || !appInfo.id) {
        console.error('Unable to determine application id from token. Provide CLIENT_ID env var if automatic detection fails.');
        process.exit(1);
      }
      clientId = appInfo.id;
      console.log('Detected application id:', clientId);
    }

    console.log(`Registering ${commands.length} command(s) to guild ${GUILD_ID} (this is instant).`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, GUILD_ID),
      { body: commands },
    );
    console.log('Successfully registered application commands for guild:', GUILD_ID);
    process.exit(0);
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
})();
