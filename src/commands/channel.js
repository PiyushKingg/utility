// src/commands/channel.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Channel utilities (permission editor, create, edit)'),
  async execute(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('Channel Utilities — Utility Bot')
        .setDescription('Click to choose a channel to configure (permission overwrites etc).')
        .setColor(0x2b2d31);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('chanp:choose').setLabel('Select Channel').setStyle(ButtonStyle.Primary)
      );
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    } catch (err) {
      console.error('channel command failed', err);
      try { if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal error while opening channel tools.', ephemeral: true }); } catch (e) {}
    }
  }
};
