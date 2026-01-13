// src/commands/role.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Role-related utilities (editor, info)'),
  async execute(interaction) {
    try {
      // Single reply only (no defer). This is fast UI, so immediate reply is fine.
      const embed = new EmbedBuilder()
        .setTitle('Role Utilities — Utility Bot')
        .setDescription('Open the interactive role permission editor (Add/Remove/Reset/Show).')
        .setColor(0x2b2d31);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rolep:init').setLabel('Open Role Permission Editor').setStyle(ButtonStyle.Primary)
      );
      // reply (only once)
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    } catch (err) {
      console.error('role command failed', err);
      try {
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal error while opening role tools.', ephemeral: true });
      } catch (e) { console.error('failed to notify user about role command failure', e); }
    }
  }
};
