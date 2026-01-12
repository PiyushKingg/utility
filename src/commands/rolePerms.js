// src/commands/rolePerms.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) { console.error('safeReply failed:', err); }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Role utilities')
    .addSubcommand(sub => sub.setName('perms').setDescription('Interactive role permission editor'))
    .addSubcommand(sub => sub.setName('info').setDescription('Show role info').addRoleOption(opt => opt.setName('role').setDescription('Role to inspect'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'perms') {
      const embed = new EmbedBuilder().setTitle('Role Permission Editor').setDescription('Open the editor to add/remove/reset/show role permissions.').setColor(0x2b2d31);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rolep:init').setLabel('Open Editor').setStyle(ButtonStyle.Primary)
      );
      await safeReply(interaction, { embeds: [embed], components: [row] });
      return;
    }

    if (sub === 'info') {
      const role = interaction.options.getRole('role') || interaction.guild.roles.everyone;
      const members = role.members.map(m => `${m.user.tag}`).slice(0, 30).join('\n') || 'No members';
      const embed = new EmbedBuilder()
        .setTitle(`Role Info — ${role.name}`)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Members (sample)', value: members, inline: false },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }
        )
        .setColor(role.color || 0x2b2d31);
      await safeReply(interaction, { embeds: [embed] });
      return;
    }
  }
};
