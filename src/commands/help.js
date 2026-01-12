// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) {
    console.error('safeReply failed:', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help and list of all commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Utility Bot — Help')
      .setDescription('All commands grouped by category')
      .setColor(0x2b2d31)
      .addFields(
        { name: 'Core & Configuration', value: '`/help` — this\n`/server info` — show server info\n`/server edit` — edit server name/icon/desc\n`/owner restart` — owner-only restart', inline: false },
        { name: 'Roles', value: '`/role perms` — interactive role permission editor\n`/rolemanage create|delete|assign|remove|clone|info|bulkassign` — role management', inline: false },
        { name: 'Channels', value: '`/createchannel` — quick create text channel\n`/channel perms` — interactive channel permission editor', inline: false },
        { name: 'User & Info', value: '`/userinfo` — user info', inline: false },
        { name: 'Utilities', value: '`/role perms` — permission editor\n`/channel perms` — channel overwrites editor', inline: false }
      )
      .setFooter({ text: 'All major actions show preview + confirmation. Time shown in IST where applicable.' });

    await safeReply(interaction, { embeds: [embed] });
  }
};
