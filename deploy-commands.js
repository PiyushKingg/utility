require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

async function registerCommands() {
  const TOKEN = process.env.DISCORD_TOKEN;
  const GUILD_ID = process.env.GUILD_ID;
  const CLIENT_ID = process.env.CLIENT_ID || null;

  if (!TOKEN) {
    throw new Error('DISCORD_TOKEN is not set in environment variables.');
  }
  if (!GUILD_ID) {
    throw new Error('GUILD_ID is not set in environment variables. Set it to the guild where you want commands registered.');
  }

  const commandsDir = path.join(__dirname, 'src', 'commands');
  if (!fs.existsSync(commandsDir)) {
    throw new Error(`Commands folder not found at ${commandsDir}`);
  }

  const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  const commands = [];

  for (const file of commandFiles) {
    const fp = path.join(commandsDir, file);
    try {
      const cmd = require(fp);
      if (cmd && cmd.data && typeof cmd.data.toJSON === 'function') {
        commands.push(cmd.data.toJSON());
      } else {
        console.warn(`Skipping ${file}: missing exported 'data' (SlashCommandBuilder).`);
      }
    } catch (err) {
      console.warn(`Failed to load command ${file}:`, err.message || err);
    }
  }

  if (commands.length === 0) {
    console.log('No commands found to register. Exiting.');
    return { registered: 0 };
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  // Determine clientId if not provided
  let clientId = CLIENT_ID;
  if (!clientId) {
    console.log('CLIENT_ID not provided. Detecting application id from token...');
    const appInfo = await rest.get(Routes.oauth2CurrentApplication());
    if (!appInfo || !appInfo.id) throw new Error('Unable to determine application id from token. Provide CLIENT_ID if auto-detect fails.');
    clientId = appInfo.id;
    console.log('Detected application id:', clientId);
  }

  console.log(`Registering ${commands.length} command(s) to guild ${GUILD_ID} (instant).`);
  await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), { body: commands });
  console.log('Successfully registered application commands for guild:', GUILD_ID);

  return { registered: commands.length, guild: GUILD_ID };
}

// If run directly, execute and exit.
if (require.main === module) {
  registerCommands()
    .then(res => {
      console.log('Done:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('Failed to register commands:', err);
  
