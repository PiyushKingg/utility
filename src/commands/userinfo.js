// src/commands/userinfo.js
const { SlashCommandBuilder, EmbedBuilder, time } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('userinfo').setDescription('Show user information').addUserOption(o => o.setName('user').setDescription('User to inspect')),
  async execute(interaction, client) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);

    // try to fetch user to get banner
    let fetchedUser = null;
    try { fetchedUser = await client.users.fetch(target.id, { force: true }); } catch {}

    const embed = new EmbedBuilder()
      .setTitle(`${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .setColor(member ? (member.roles.highest?.color ?? 0x2b2d31) : 0x2b2d31)
      .addFields(
        { name: 'ID', value: target.id, inline: true },
        { name: 'Account Created', value: target.createdAt.toUTCString(), inline: true },
        { name: 'Joined Server', value: member ? (member.joinedAt ? member.joinedAt.toUTCString() : 'Unknown') : 'Not a member', inline: true },
        { name: 'Roles', value: member ? member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.toString()).slice(0, 20).join(' ') || 'None' : 'N/A', inline: false }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    if (fetchedUser && fetchedUser.bannerURL()) embed.setImage(fetchedUser.bannerURL({ size: 1024 }));

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
