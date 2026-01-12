// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
        { name: 'Roles', value: '`/role perms` — interactive role permission editor\n`/role info` — info on a role\n`/role manage create/delete/assign/remove/clone/bulk` — role management', inline: false },
        { name: 'Channels', value: '`/createchannel` — quick create text channel\n`/channel perms` — interactive channel permission editor\n`/channel manage` — (edit/clone/move) (coming)', inline: false },
        { name: 'Messages', value: '`/msg say` — bot say (coming)\n`/msg embed` — create embed (coming)', inline: false },
        { name: 'User & Info', value: '`/userinfo` — user info\n`/avatar <user>` — avatar viewer (coming)', inline: false },
        { name: 'Emojis & Stickers', value: '`/emoji add/remove/info` — (coming)', inline: false },
        { name: 'Utilities', value: '`/role perms` — permission editor\n`/channel perms` — channel overwrites editor', inline: false }
      )
      .setFooter({ text: 'Use commands responsibly. All major actions show preview + confirmation.' });

    await interaction.reply({ embeds: [embed] });
  }
};
