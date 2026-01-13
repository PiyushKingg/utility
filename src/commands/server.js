// src/commands/server.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('server').setDescription('Server utilities')
    .addSubcommand(s => s.setName('info').setDescription('Show server info'))
    .addSubcommand(s => s.setName('edit').setDescription('Edit server (name/description)').addStringOption(o => o.setName('name').setDescription('New server name')).addStringOption(o => o.setName('description').setDescription('New description'))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'info') {
      const g = interaction.guild;
      const owner = await g.fetchOwner().catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle(`${g.name} — Info`)
        .setThumbnail(g.iconURL({ size: 256 }) || null)
        .addFields(
          { name: 'ID', value: g.id, inline: true },
          { name: 'Owner', value: owner ? `${owner.user.tag}` : 'Unknown', inline: true },
          { name: 'Members', value: `${g.memberCount}`, inline: true },
          { name: 'Created', value: g.createdAt.toUTCString(), inline: true },
        )
        .setColor(0x2b2d31);

      return interaction.reply({ embeds: [embed], ephemeral: false });
    } else if (sub === 'edit') {
      if (!interaction.memberPermissions.has('ManageGuild')) return interaction.reply({ content: 'You need Manage Server permission to edit the server.', ephemeral: true });
      const newName = interaction.options.getString('name');
      const newDescription = interaction.options.getString('description');

      try {
        if (newName) await interaction.guild.setName(newName, `Edited by ${interaction.user.tag}`);
        if (typeof newDescription === 'string') {
          try { await interaction.guild.setDescription(newDescription); } catch {}
        }
        return interaction.reply({ content: 'Server updated (where allowed).', ephemeral: false });
      } catch (err) {
        console.error('server edit failed', err);
        return interaction.reply({ content: 'Failed to update server: ' + (err.message || err), ephemeral: true });
      }
    }
  }
};
