const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Get info about a user')
    .addUserOption(opt => opt.setName('target').setDescription('User to lookup (leave blank for yourself)').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('target') || interaction.user;
    const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;

    const embed = new EmbedBuilder()
      .setTitle(`User Info — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ forceStatic: false }))
      .addFields(
        { name: 'User ID', value: `${target.id}`, inline: true },
        { name: 'Account Created', value: `${target.createdAt.toUTCString()}`, inline: true }
      )
      .setColor(0x2b2d31);

    if (member) {
      embed.addFields(
        { name: 'Joined Server', value: `${member.joinedAt ? member.joinedAt.toUTCString() : 'Unknown'}`, inline: true },
        { name: 'Nickname', value: `${member.nickname || '—'}`, inline: true },
        { name: 'Roles', value: member.roles.cache.map(r => r.name).join(', ').slice(0, 1000) || '—', inline: false }
      );
    }

    await interaction.reply({ embeds: [embed] });
  }
};
