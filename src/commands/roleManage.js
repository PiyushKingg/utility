// src/commands/roleManage.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) { console.error('safeReply failed:', err); }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolemanage')
    .setDescription('Create/edit/delete/assign roles')
    .addSubcommand(s => s.setName('create')
      .setDescription('Create a role')
      .addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('Hex color (e.g. #ff0000)').setRequired(false))
      .addBooleanOption(o => o.setName('hoist').setDescription('Hoist role').setRequired(false))
      .addBooleanOption(o => o.setName('mentionable').setDescription('Mentionable').setRequired(false))
    )
    .addSubcommand(s => s.setName('delete').setDescription('Delete a role').addRoleOption(o => o.setName('role').setDescription('Role to delete').setRequired(true)))
    .addSubcommand(s => s.setName('assign').setDescription('Assign role to a member').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)).addUserOption(u => u.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove role from a member').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)).addUserOption(u => u.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('clone').setDescription('Clone a role').addRoleOption(o => o.setName('role').setDescription('Role to clone').setRequired(true)).addStringOption(o => o.setName('name').setDescription('New name').setRequired(false)))
    .addSubcommand(s => s.setName('info').setDescription('Show role info').addRoleOption(o => o.setName('role').setDescription('Role to inspect').setRequired(true)))
    .addSubcommand(s => s.setName('bulkassign').setDescription('Bulk assign roles by filter (skeleton)')
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
      .addStringOption(o => o.setName('filter').setDescription('Filter: e.g., hasRole:roleName'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return safeReply(interaction, { content: 'You need Manage Roles permission.', ephemeral: true });
      const name = interaction.options.getString('name');
      const color = interaction.options.getString('color') || undefined;
      const hoist = interaction.options.getBoolean('hoist') || false;
      const mentionable = interaction.options.getBoolean('mentionable') || false;
      try {
        const role = await interaction.guild.roles.create({ name, color, hoist, mentionable });
        const embed = new EmbedBuilder().setTitle('Role Created').setDescription(`${role}`).addFields({ name: 'ID', value: role.id }).setColor(role.color || 0x2b2d31);
        await safeReply(interaction, { embeds: [embed] });
      } catch (err) {
        await safeReply(interaction, { content: 'Failed to create role: ' + (err.message || err), ephemeral: true });
      }
      return;
    }

    if (sub === 'delete') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return safeReply(interaction, { content: 'You need Manage Roles permission.', ephemeral: true });
      const role = interaction.options.getRole('role');
      try {
        await role.delete('Deleted via rolemanage delete');
        await safeReply(interaction, { content: `Deleted role ${role.name}` });
      } catch (err) {
        await safeReply(interaction, { content: 'Failed to delete role: ' + (err.message || err), ephemeral: true });
      }
      return;
    }

    if (sub === 'assign') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return safeReply(interaction, { content: 'You need Manage Roles permission.', ephemeral: true });
      const role = interaction.options.getRole('role');
      const user = interaction.options.getUser('user');
      try {
        const m = await interaction.guild.members.fetch(user.id);
        await m.roles.add(role);
        await safeReply(interaction, { content: `Assigned ${role} to ${m.user.tag}` });
      } catch (err) {
        await safeReply(interaction, { content: 'Failed to assign role: ' + (err.message || err), ephemeral: true });
      }
      return;
    }

    if (sub === 'remove') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return safeReply(interaction, { content: 'You need Manage Roles permission.', ephemeral: true });
      const role = interaction.options.getRole('role');
      const user = interaction.options.getUser('user');
      try {
        const m = await interaction.guild.members.fetch(user.id);
        await m.roles.remove(role);
        await safeReply(interaction, { content: `Removed ${role} from ${m.user.tag}` });
      } catch (err) {
        await safeReply(interaction, { content: 'Failed to remove role: ' + (err.message || err), ephemeral: true });
      }
      return;
    }

    if (sub === 'clone') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return safeReply(interaction, { content: 'You need Manage Roles permission.', ephemeral: true });
      const role = interaction.options.getRole('role');
      const newName = interaction.options.getString('name') || `${role.name}-clone`;
      try {
        const clone = await interaction.guild.roles.create({
          name: newName,
          color: role.color,
          hoist: role.hoist,
          mentionable: role.mentionable,
          permissions: role.permissions
        });
        await safeReply(interaction, { content: `Cloned role: ${clone}` });
      } catch (err) {
        await safeReply(interaction, { content: 'Failed to clone role: ' + (err.message || err), ephemeral: true });
      }
      return;
    }

    if (sub === 'info') {
      const role = interaction.options.getRole('role');
      const members = role.members.map(m => m.user.tag).slice(0, 30).join('\n') || 'No members';
      const embed = new EmbedBuilder()
        .setTitle(`Role Info — ${role.name}`)
        .setColor(role.color || 0x2b2d31)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Color', value: role.hexColor || '—', inline: true },
          { name: 'Position', value: `${role.position}`, inline: true },
          { name: 'Members (sample)', value: members, inline: false },
          { name: 'Permissions', value: role.permissions.toArray().slice(0,50).join(', ') || '—', inline: false }
        );
      await safeReply(interaction, { embeds: [embed] });
      return;
    }

    if (sub === 'bulkassign') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return safeReply(interaction, { content: 'You need Manage Roles permission.', ephemeral: true });
      const role = interaction.options.getRole('role');
      const filter = interaction.options.getString('filter') || '';
      if (filter.startsWith('hasRole:')) {
        const roleName = filter.split(':')[1];
        const targetRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (!targetRole) return safeReply(interaction, { content: 'Filter role not found.', ephemeral: true });
        let count = 0;
        await interaction.deferReply();
        const members = await interaction.guild.members.fetch();
        for (const m of members.values()) {
          if (m.roles.cache.has(targetRole.id)) {
            try { await m.roles.add(role); count++; } catch {}
          }
        }
        await safeReply(interaction, { content: `Assigned ${role} to ${count} members matching filter` });
        return;
      }
      await safeReply(interaction, { content: 'Unsupported filter in this build. Use hasRole:ROLE_NAME', ephemeral: true });
      return;
    }
  }
};
