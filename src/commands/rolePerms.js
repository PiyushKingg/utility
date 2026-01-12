// src/commands/rolePerms.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) { console.error('safeReply failed:', err); }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleperms')
    .setDescription('Interactive role permission editor'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Role Permission Editor')
      .setDescription('Choose an action to edit role permissions. (All messages are public embeds.)')
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rolep:init').setLabel('Open Editor').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    await safeReply(interaction, { embeds: [embed], components: [row] });
  }
};
