// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Show help and command list'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Utility Bot — Help')
      .setColor(0x2b2d31)
      .setDescription('This bot provides utility commands for server management. Use them responsibly.')
      .addFields(
        { name: 'Server', value: '/server info — view server info\n/server edit — edit server name/description', inline: false },
        { name: 'Role', value: '/role create — create a role\n/role info — role info\n/role edit — edit role\n/role delete — delete role\n/role assign — assign role to user\n/role remove — remove role from user', inline: false },
        { name: 'Channel', value: '/channel create — create channel\n/channel info — view channel\n/channel edit — edit channel\n/channel delete — delete channel', inline: false },
        { name: 'User', value: '/userinfo — inspect a user', inline: false },
        { name: 'Owner', value: '/owner restart — restart the bot (owner only)', inline: false }
      )
      .setFooter({ text: 'Utility Bot — simple, clean, stable' });

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
