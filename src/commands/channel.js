// src/commands/channel.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder } = require('discord.js');

async function safeReply(interaction, payload) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply(payload);
    }
    if (interaction.deferred) {
      return await interaction.editReply(payload);
    }
    if (interaction.replied) {
      return await interaction.followUp(payload);
    }
  } catch (err) {
    try { if (interaction.deferred || interaction.replied) return await interaction.editReply(payload); } catch {}
    try { return await interaction.followUp(payload); } catch (e) { console.error('safeReply final fallback failed:', err, e); }
  }
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Channel utilities')
    .addSubcommand(s => s.setName('perms').setDescription('Interactive channel permission editor')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'perms') {
      const embed = new EmbedBuilder().setTitle('Channel Permission Editor').setDescription('Select a channel to configure permission overwrites').setColor(0x2b2d31);
      const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('chanp:select_channel').setPlaceholder('Select channel'));
      return safeReply(interaction, { embeds: [embed], components: [row] });
    }
    return safeReply(interaction, { content: 'Unknown subcommand', ephemeral: true });
  }
};
