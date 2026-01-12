// src/index.js
require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID || null;

if (!TOKEN) {
  console.error('FATAL: DISCORD_TOKEN missing in env');
  process.exit(1);
}

// tiny HTTP server so Render web service sees a bound port
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Utility Bot alive\n');
}).listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// load commands from src/commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  for (const f of fs.readdirSync(commandsPath).filter(x => x.endsWith('.js'))) {
    try {
      const cmd = require(path.join(commandsPath, f));
      if (cmd && cmd.data && cmd.execute) {
        client.commands.set(cmd.data.name, cmd);
        console.log(`Loaded command: ${cmd.data.name}`);
      } else {
        console.warn(`Skipped loading ${f} — missing data/execute`);
      }
    } catch (err) {
      console.error(`Error loading command ${f}:`, err);
    }
  }
} else {
  console.warn('No commands folder found at', commandsPath);
}

// ready handling + auto-register
let _readyHandled = false;
async function handleReady() {
  if (_readyHandled) return;
  _readyHandled = true;
  console.log(`✅ Logged in as ${client.user.tag}`);

  const GUILD_ID = process.env.GUILD_ID;
  if (GUILD_ID) {
    try {
      const { registerCommands } = require('../deploy-commands');
      console.log('GUILD_ID set — auto-registering commands to guild...');
      const res = await registerCommands();
      console.log('Auto-register result:', res);
    } catch (err) {
      console.warn('Auto-register failed:', err && err.message ? err.message : err);
    }
  } else {
    console.log('GUILD_ID not set — skipping auto register.');
  }
}
client.once('ready', handleReady);
client.once('clientReady', handleReady); // forward-compat

// Central interactionCreate:
// - For chat input commands: auto-defer unless command sets noDefer = true
// - For other interactions (buttons/selects/modals) delegate to handlers/interactionCreate
client.on('interactionCreate', async (interaction) => {
  try {
    // Chat input command
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) {
        // If unknown command, respond gracefully
        if (!interaction.replied && !interaction.deferred) {
          try { await interaction.reply({ content: 'Command not found.', ephemeral: true }); } catch {}
        }
        return;
      }

      // If command exports `noDefer = true`, skip automatic defer (useful for showModal)
      const shouldDefer = !cmd.noDefer;
      if (shouldDefer && !interaction.deferred && !interaction.replied) {
        try {
          await interaction.deferReply({ ephemeral: false });
        } catch (err) {
          // failing to defer is not fatal; continue
          console.warn('Failed to defer interaction:', err && err.message ? err.message : err);
        }
      }

      // Execute command
      await cmd.execute(interaction, client);
      return;
    }

    // Non-chat interactions (buttons, selects, modals) go to handler
    const handlerPath = path.join(__dirname, 'handlers', 'interactionCreate.js');
    if (fs.existsSync(handlerPath)) {
      const handler = require(handlerPath);
      await handler(interaction, client);
      return;
    } else {
      // nothing to handle
      return;
    }
  } catch (err) {
    console.error('Error processing interaction:', err);
    // Try to reply/followup safely
    try {
      if (interaction && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Internal error occurred.', ephemeral: true });
      } else if (interaction && (interaction.replied || interaction.deferred)) {
        await interaction.followUp({ content: 'Internal error occurred.', ephemeral: true });
      }
    } catch (e) {
      // ignore
    }
  }
});

// global error logging
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Login
client.login(TOKEN).catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});
