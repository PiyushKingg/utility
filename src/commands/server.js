// src/commands/server.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Server utilities')
    .addSubcommand(s => s.setName('info').setDescription('Show server information'))
    .addSubcommand(s => s.setName('edit').setDescription('Edit server name/icon/description')
      .addStringOption(o => o.setName('name').setDescription('New server name').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('New server description').setRequired(false))
      .addStringOption(o => o.setName('icon_url').setDescription('URL for new server icon').setRequired(false))
      .addStringOption(o => o.setName('timezone').setDescription('Server timezone string (for display)').setRequired(false))
      .addStringOption(o => o.setName('language').setDescription('Server language code').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'info') {
      const g = interaction.guild;
      const owner = await g.fetchOwner();
      const boosts = g.premiumSubscriptionCount || 0;
      const created = toISTString(g.createdAt);
      const joined = toISTString((await g.members.fetch(interaction.user.id)).joinedAt || new Date());
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

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'edit') {
      if (!interaction.member.permissions.has('ManageGuild')) {
        await interaction.reply({ content: 'You need Manage Server permission to edit server.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name');
      const desc = interaction.options.getString('description');
      const iconUrl = interaction.options.getString('icon_url');
      const tz = interaction.options.getString('timezone');
      const lang = interaction.options.getString('language');

      const before = { name: interaction.guild.name, description: interaction.guild.description || '' };
      let applied = [];
      try {
        await interaction.guild.edit({ name: name || undefined, description: desc || undefined });
        applied.push('name/description');
        if (iconUrl) {
          const res = await fetch(iconUrl).then(r => r.arrayBuffer()).then(b => Buffer.from(b));
          await interaction.guild.setIcon(res);
          applied.push('icon');
        }
      } catch (err) {
        await interaction.reply({ content: 'Failed to edit server: ' + (err.message || err), ephemeral: true });
        return;
      }

      // store config in data/guilds
      const cfg = readGuildConfig(interaction.guild.id);
      if (tz) cfg.timezone = tz;
      if (lang) cfg.language = lang;
      writeGuildConfig(interaction.guild.id, cfg);

      const embed = new EmbedBuilder().setTitle('Server Updated').setDescription(`Applied: ${applied.join(', ')}`).setColor(0x00AA00);
      await interaction.reply({ embeds: [embed] });
      return;
    }
  }
};
