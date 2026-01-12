const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createchannel')
    .setDescription('Create a channel (quick or advanced)')
    .addStringOption(opt => opt.setName('type').setDescription('text|vc|forum (quick create)').setRequired(false)),

  async execute(interaction) {
    const type = (interaction.options.getString('type') || 'text').toLowerCase();
    if (type === 'text') {
      const modal = new ModalBuilder().setCustomId('create:quick_text_modal').setTitle('Quick Create Text Channel');
      const nameInput = new TextInputBuilder().setCustomId('name').setLabel('Channel name').setStyle(TextInputStyle.Short).setRequired(true);
      const topicInput = new TextInputBuilder().setCustomId('topic').setLabel('Topic (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(topicInput));
      await interaction.showModal(modal);
      return;
    }

    await interaction.reply({ content: 'Other quick flows (vc/forum) are TODO in this skeleton. Use type=text for now.', ephemeral: true });
  }
};
