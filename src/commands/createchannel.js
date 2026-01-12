// src/commands/createchannel.js
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createchannel')
    .setDescription('Create a channel quickly')
    .addStringOption(opt => opt.setName('type').setDescription('text|vc|forum').setRequired(false)),

  // showModal must be immediate, so prevent auto-defer in index.js
  noDefer: true,

  async execute(interaction) {
    const type = (interaction.options.getString('type') || 'text').toLowerCase();
    if (type === 'text') {
      const modal = new ModalBuilder().setCustomId('create:text:modal').setTitle('Create Text Channel');
      const nameInput = new TextInputBuilder().setCustomId('name_input').setLabel('Channel name').setStyle(TextInputStyle.Short).setRequired(true);
      const topicInput = new TextInputBuilder().setCustomId('topic_input').setLabel('Topic (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false);
      // Modal needs components wrapper objects
      modal.addComponents(
        { type: 1, components: [nameInput] },
        { type: 1, components: [topicInput] }
      );
      await interaction.showModal(modal);
      return;
    }
    await interaction.reply({ content: 'Only quick text creation supported via modal in this version.', ephemeral: true });
  }
};
