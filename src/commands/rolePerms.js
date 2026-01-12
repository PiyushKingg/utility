const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Role utilities')
    .addSubcommand(sub => sub.setName('perms').setDescription('Interactive role permission editor')),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'perms') {
      const embed = new EmbedBuilder()
        .setTitle('Role Permissions')
        .setDescription('Choose an action below. All follow-up steps will be interactive (single-message flow).')
        .setColor(0x2b2d31);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rolep:init_add').setLabel('Add').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rolep:init_remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('rolep:init_reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('rolep:init_show').setLabel('Show').setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }
  }
};
