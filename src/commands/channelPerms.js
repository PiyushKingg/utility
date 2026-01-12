const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Channel utilities')
    .addSubcommand(sub => sub.setName('perms').setDescription('Interactive channel permission editor')),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'perms') {
      const embed = new EmbedBuilder()
        .setTitle('Channel Permission Editor')
        .setDescription('Start the interactive channel permission flow. Use the slash command or follow prompts to select a channel then manage overwrites.')
        .setColor(0x2b2d31);

      // interactive components are handled in handler; this reply acts as entry point
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
