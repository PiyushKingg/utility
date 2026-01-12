require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID || null;

if (!TOKEN) {
  console.error('FATAL: DISCORD_TOKEN is not set in environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// Load all commands from src/commands
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  console.warn(`Warning: commands folder not found at ${commandsPath}`);
} else {
  for (const file of fs.readdirSync(commandsPath)) {
    if (!file.endsWith('.js')) continue;
    try {
      const cmd = require(path.join(commandsPath, file));
      if (cmd && cmd.data && cmd.execute) {
        client.commands.set(cmd.data.name, cmd);
        console.log(`Loaded command: ${cmd.data.name}`);
      } else {
        console.log(`Skipped ${file} — missing expected exports (data, execute).`);
      }
    } catch (err) {
      console.error(`Error loading command ${file}:`, err);
    }
  }
}

// READY handling (v14/v15 compatibility)
let _readyHandled = false;
async function handleReady() {
  if (_readyHandled) return;
  _readyHandled = true;
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Auto-register slash commands on startup if GUILD_ID present.
  // This allows Render free (no shell) to register commands automatically.
  try {
    const { registerCommands } = require('../deploy-commands'); // root deploy script
    const GUILD_ID = process.env.GUILD_ID;
    if (GUILD_ID) {
      console.log('GUILD_ID detected — attempting to register slash commands automatically at startup.');
      try {
        const result = await registerCommands();
        console.log('Auto-register result:', result);
      } catch (err) {
        console.warn('Auto-register failed (will not crash):', err.message || err);
      }
    } else {
      console.log('No GUILD_ID provided — skipping automatic registration. Provide GUILD_ID to register to a test guild on startup.');
    }
  } catch (err) {
    console.warn('No deploy-commands module found or failed to load. If you want auto-registration, ensure deploy-commands.js exists at project root.');
  }

  console.log('Tip: If automatic registration fails, you can run `node deploy-commands.js` locally or in a shell to register commands to a guild.');
}

client.once('ready', handleReady);
client.once('clientReady', handleReady); // future-proofing for discord.js v15 rename

// Interaction handling
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) {
        await interaction.reply({ content: 'Command not found or not loaded.', ephemeral: true });
        return;
      }
      await cmd.execute(interaction, client);
      return;
    }

    // For buttons/selects/modals - forward to handler if exists
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isRoleSelectMenu() || interaction.isModalSubmit()) {
      const handlerPath = path.join(__dirname, 'handlers', 'interactionCreate.js');
      if (fs.existsSync(handlerPath)) {
        const handler = require(handlerPath);
        await handler(interaction, client);
      } else {
        if (!interaction.replied) await interaction.reply({ content: 'No interaction handler installed.', ephemeral: true });
      }
      return;
    }
  } catch (err) {
    console.error('Error processing interaction:', err);
    try {
      if (!interaction.replied) await interaction.reply({ content: 'Internal error occurred.', ephemeral: true });
      else await interaction.followUp({ content: 'Internal error occurred.', ephemeral: true });
    } catch {}
  }
});

// Global error handlers for better logs on Render
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Login
client.login(TOKEN).catch(err => {
  console.error('Failed to login with provided token:', err);
  process.exit(1);
});
