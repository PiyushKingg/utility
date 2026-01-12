// src/commands/channelPerms.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder } = require('discord.js');

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) { console.error('safeReply failed:', err); }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelperms')
    .setDescription('Interactive channel permission editor'),

  async execute(interaction) {
    const embed = new EmbedBuilder().setTitle('Channel Permission Editor').setDescription('Select a channel to configure overwrites.').setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('chanp:select_channel').setPlaceholder('Select channel to configure')
    );

    await safeReply(interaction, { embeds: [embed], components: [row] });
  }
};
