// src/commands/owner.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Owner-only tools')
    .addSubcommand(s => s.setName('restart').setDescription('Restart the bot (owner only)')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const ownerId = process.env.OWNER_ID;
    if (!ownerId) return interaction.reply({ content: 'OWNER_ID not configured.', ephemeral: true });
    if (interaction.user.id !== ownerId) return interaction.reply({ content: 'Only bot owner can run this.', ephemeral: true });

    if (sub === 'restart') {
      await interaction.reply({ content: 'Restarting...' });
      // allow the message to send, then exit process
      setTimeout(() => process.exit(0), 1000);
    }
  }
};
