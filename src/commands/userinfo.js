// src/commands/userinfo.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function toISTString(dt) {
  const opts = { timeZone: 'Asia/Kolkata', hour12: true, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return new Intl.DateTimeFormat('en-US', opts).format(dt);
}

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
    .setName('userinfo')
    .setDescription('Get info about a user')
    .addUserOption(opt => opt.setName('target').setDescription('User to lookup').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('target') || interaction.user;
    const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;

    const topRole = member ? member.roles.highest : null;
    const embedColor = topRole ? topRole.color || 0x2b2d31 : 0x2b2d31;

    const embed = new EmbedBuilder()
      .setTitle(`${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ forceStatic: false, size: 1024 }))
      .setColor(embedColor)
      .addFields(
        { name: 'User ID', value: `${target.id}`, inline: true },
        { name: 'Account Created (IST)', value: `${toISTString(target.createdAt)}`, inline: true }
      );

    if (member) {
      if (member.joinedAt) embed.addFields({ name: 'Joined Server (IST)', value: `${toISTString(member.joinedAt)}`, inline: true });
      embed.addFields({ name: 'Nickname', value: `${member.nickname || '—'}`, inline: true });

      const rolesList = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .sort((a,b) => b.position - a.position)
        .map(r => `${r}`)
        .join(' ');
      embed.addFields({ name: `Roles [${Math.max(0, member.roles.cache.size - 1)}]`, value: rolesList.length ? rolesList : '—', inline: false });

      const perms = member.permissions.toArray();
      const keyPerms = ['Administrator','ManageGuild','ManageRoles','ManageChannels','ManageMessages','KickMembers','BanMembers','ViewAuditLog'];
      const shown = perms.filter(p => keyPerms.includes(p)).slice(0, 20);
      embed.addFields({ name: 'Key Permissions', value: shown.length ? shown.join(', ') : 'None', inline: false });

      const presence = member.presence;
      if (presence) {
        const status = presence?.status || 'offline';
        embed.addFields({ name: 'Presence', value: `${status}`, inline: true });
        if (presence.activities && presence.activities.length) {
          const act = presence.activities[0];
          embed.addFields({ name: 'Activity', value: `${act.name || '—'}`, inline: true });
        }
      }
    }

    // Banner
    try {
      const user = await interaction.client.users.fetch(target.id, { force: true });
      const bannerURL = user.bannerURL({ size: 1024 });
      if (bannerURL) embed.setImage(bannerURL);
    } catch {}

    await safeReply(interaction, { embeds: [embed] });
  }
};
