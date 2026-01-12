// src/commands/owner.js
const { SlashCommandBuilder } = require('discord.js');

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) { console.error('safeReply failed:', err); }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Owner-only tools')
    .addSubcommand(s => s.setName('restart').setDescription('Restart the bot (owner only)')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const ownerId = process.env.OWNER_ID;
    if (!ownerId) return safeReply(interaction, { content: 'OWNER_ID not configured.', ephemeral: true });
    if (interaction.user.id !== ownerId) return safeReply(interaction, { content: 'Only bot owner can run this.', ephemeral: true });

    if (sub === 'restart') {
      await safeReply(interaction, { content: 'Restarting...' });
      setTimeout(() => process.exit(0), 1000);
    }
  }
};
