// src/commands/server.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

function toISTString(date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour12: true, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function getGuildConfigPath(guildId) {
  const dir = path.join(__dirname, '..', '..', 'data', 'guilds');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${guildId}.json`);
}

function readGuildConfig(guildId) {
  const p = getGuildConfigPath(guildId);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return {}; }
}

function writeGuildConfig(guildId, data) {
  const p = getGuildConfigPath(guildId);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) {
    console.error('safeReply failed:', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Server utilities')
    .addSubcommand(s => s.setName('info').setDescription('Show server information'))
    .addSubcommand(s => s.setName('edit').setDescription('Edit server name/icon/description/timezone/language')
      .addStringOption(o => o.setName('name').setDescription('New server name').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('New server description').setRequired(false))
      .addStringOption(o => o.setName('icon_url').setDescription('URL for new server icon').setRequired(false))
      .addStringOption(o => o.setName('timezone').setDescription('Display timezone').setRequired(false))
      .addStringOption(o => o.setName('language').setDescription('Display language').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'info') {
      const g = interaction.guild;
      const owner = await g.fetchOwner();
      const boosts = g.premiumSubscriptionCount || 0;
      const created = toISTString(g.createdAt);
      const embed = new EmbedBuilder()
        .setTitle(`${g.name} — Server Info`)
        .setThumbnail(g.iconURL({ size: 512 }))
        .addFields(
          { name: 'ID', value: g.id, inline: true },
          { name: 'Owner', value: `${owner.user.tag}`, inline: true },
          { name: 'Members', value: `${g.memberCount}`, inline: true },
          { name: 'Boosts', value: `${boosts}`, inline: true },
          { name: 'Created', value: created, inline: true }
        ).setColor(0x2b2d31);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === 'edit') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return safeReply(interaction, { content: 'You need Manage Server permission to edit server.', ephemeral: true });
      }
      const name = interaction.options.getString('name');
      const desc = interaction.options.getString('description');
      const iconUrl = interaction.options.getString('icon_url');
      const tz = interaction.options.getString('timezone');
      const lang = interaction.options.getString('language');

      try {
        await interaction.guild.edit({ name: name || undefined, description: desc || undefined });
        if (iconUrl) {
          const res = await fetch(iconUrl);
          if (!res.ok) throw new Error('Failed to fetch icon URL');
          const arr = await res.arrayBuffer();
          const buf = Buffer.from(arr);
          await interaction.guild.setIcon(buf);
        }
      } catch (err) {
        console.error('server edit error:', err);
        return safeReply(interaction, { content: 'Failed to edit server: ' + (err.message || err), ephemeral: true });
      }

      // persist cfg
      const cfg = readGuildConfig(interaction.guild.id);
      if (tz) cfg.timezone = tz;
      if (lang) cfg.language = lang;
      writeGuildConfig(interaction.guild.id, cfg);

      const embed = new EmbedBuilder().setTitle('Server Updated').setDescription('Server updated successfully.').setColor(0x00AA00);
      return safeReply(interaction, { embeds: [embed] });
    }
  }
};
