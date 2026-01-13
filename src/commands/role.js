// src/commands/role.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

function safeReplyFactory(interaction) {
  return async function safeReply(payload) {
    try {
      if (!interaction.replied && !interaction.deferred) return await interaction.reply(payload);
      if (interaction.deferred) return await interaction.editReply(payload);
      return await interaction.followUp(payload);
    } catch (err) {
      // fallback attempts
      try { if (!interaction.replied) return await interaction.reply({ ...payload, ephemeral: true }); } catch (e) {}
      try { return await interaction.followUp({ content: 'Failed to deliver response.', ephemeral: true }); } catch (e) {}
    }
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Role utilities (create, perms, info)')
    .addSubcommand(sub =>
      sub.setName('perms')
         .setDescription('Open the interactive role permission editor'))
    .addSubcommand(sub =>
      sub.setName('create')
         .setDescription('Create a new role')
         .addStringOption(opt => opt.setName('name').setDescription('Role name').setRequired(true))
         .addStringOption(opt => opt.setName('color').setDescription('Role color (hex, e.g. #ff0000)')))
    .addSubcommand(sub =>
      sub.setName('info')
         .setDescription('Show info about a role')
         .addRoleOption(opt => opt.setName('role').setDescription('Role to inspect').setRequired(true))
    ),
  async execute(interaction) {
    const safeReply = safeReplyFactory(interaction);
    try {
      const sub = interaction.options.getSubcommand();

      if (sub === 'perms') {
        // Open the role permission editor initial UI (Add/Remove/Reset/Show)
        const embed = new EmbedBuilder()
          .setTitle('Role Permission Editor')
          .setDescription('Pick an action to start: Add / Remove / Reset / Show\n\nYou will be guided through role selection and permission lists.')
          .setColor(0x2b2d31);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rolep:action:add').setLabel('Add').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rolep:action:remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('rolep:action:reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rolep:action:show').setLabel('Show').setStyle(ButtonStyle.Secondary)
        );

        return await safeReply({ embeds: [embed], components: [row], ephemeral: false });
      }

      if (sub === 'create') {
        const name = interaction.options.getString('name', true);
        const color = interaction.options.getString('color') || null;

        // Create role (basic)
        try {
          // attempt create
          const created = await interaction.guild.roles.create({
            name,
            color: color || undefined,
            reason: `Created via /role create by ${interaction.user.tag}`
          });

          const embed = new EmbedBuilder()
            .setTitle('Role Created')
            .setDescription(`Created role **${created.name}**`)
            .addFields(
              { name: 'ID', value: created.id, inline: true },
              { name: 'Color', value: created.color || 'Default', inline: true }
            )
            .setColor(created.color || 0x00AA00);

          return await safeReply({ embeds: [embed], ephemeral: false });
        } catch (err) {
          console.error('role create failed', err);
          return await safeReply({ content: `Failed to create role: ${err.message || err}`, ephemeral: false });
        }
      }

      if (sub === 'info') {
        const role = interaction.options.getRole('role', true);
        const members = role.members ? role.members.size : 0;
        const embed = new EmbedBuilder()
          .setTitle(`Role Info — ${role.name}`)
          .addFields(
            { name: 'ID', value: role.id, inline: true },
            { name: 'Members', value: `${members}`, inline: true },
            { name: 'Position', value: `${role.position}`, inline: true },
            { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
            { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }
          )
          .setColor(role.color || 0x2b2d31)
          .setFooter({ text: `Requested by ${interaction.user.tag}` });

        return await safeReply({ embeds: [embed], ephemeral: false });
      }

      // fallback
      return await safeReply({ content: 'Unknown subcommand.', ephemeral: true });
    } catch (err) {
      console.error('role command failed', err);
      try {
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal error while running role command.', ephemeral: true });
        else await interaction.editReply({ content: 'Internal error while running role command.' });
      } catch (e) { console.error('failed to report role command error', e); }
    }
  }
};
