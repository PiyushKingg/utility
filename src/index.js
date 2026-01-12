// src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID || null;

if (!TOKEN) {
  console.error('FATAL: DISCORD_TOKEN is not set in environment variables.');
  process.exit(1);
}
if (!OWNER_ID) {
  console.warn('Warning: OWNER_ID is not set. Owner-only commands may not be protected.');
}

// Create the client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// Load command modules from src/commands
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  console.warn(`Warning: commands folder not found at ${commandsPath}. Make sure your commands are at src/commands.`);
} else {
  for (const file of fs.readdirSync(commandsPath)) {
    if (!file.endsWith('.js')) continue;
    try {
      const cmd = require(path.join(commandsPath, file));
      if (cmd && cmd.data && cmd.execute) {
        client.commands.set(cmd.data.name, cmd);
        console.log(`Loaded command: ${cmd.data.name}`);
      } else {
        console.log(`Skipped loading ${file} — missing expected exports (data, execute).`);
      }
    } catch (err) {
      console.error(`Error loading command file ${file}:`, err);
    }
  }
}

// READY handling — support both v14 'ready' and v15 'clientReady' events.
// Ensure the ready handler runs only once.
let _readyHandled = false;
function handleReady() {
  if (_readyHandled) return;
  _readyHandled = true;

  console.log(`✅ Logged in as ${client.user.tag}`);

  // Helpful hint for registering slash commands:
  // If you use the provided deploy-commands.js (placed at repository root),
  // run it once to register commands for a specific guild:
  //    node deploy-commands.js
  // Or run: npm run register-commands (if you added that script to package.json)
  //
  // Note: registering to a guild (GUILD_ID) is instant. Global registrations can take up to 1 hour.
  console.log('Tip: run `node deploy-commands.js` (in your project root) to register slash commands to a guild instantly.');
}
client.once('ready', handleReady);
client.once('clientReady', handleReady); // for future compatibility with v15+

// Interaction handler
client.on('interactionCreate', async (interaction) => {
  try {
    // simple guard: commands only for chat input commands (slash)
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) {
        await interaction.reply({ content: 'Command not found or not loaded.', ephemeral: true });
        return;
      }
      await cmd.execute(interaction, client);
      return;
    }

    // non-command interactions (buttons/selects) — forward to a single handler module if you have one
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isRoleSelectMenu() || interaction.isModalSubmit()) {
      // require handler lazily to avoid startup ordering issues
      const handlerPath = path.join(__dirname, 'handlers', 'interactionCreate.js');
      if (fs.existsSync(handlerPath)) {
        const handler = require(handlerPath);
        await handler(interaction, client);
      } else {
        if (!interaction.replied) {
          await interaction.reply({ content: 'No interaction handler installed.', ephemeral: true });
        }
      }
      return;
    }
  } catch (err) {
    console.error('Error handling interaction:', err);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'An internal error occurred.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'An internal error occurred.', ephemeral: true });
      }
    } catch (e) {
      // ignore follow-up errors
    }
  }
});

// Global error handlers to capture crashes and promise rejections
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// Login
client.login(TOKEN).catch(err => {
  console.error('Failed to login with provided token:', err);
  process.exit(1);
});
