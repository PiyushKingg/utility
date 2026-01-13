// src/commands/role.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

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
    .setDescription('Role management and permissions')
    .addSubcommand(s => s.setName('perms').setDescription('Open the interactive role permission editor'))
    .addSubcommand(s => s.setName('create').setDescription('Create a role')
      .addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('Hex color (e.g. #ff0000)').setRequired(false))
      .addBooleanOption(o => o.setName('hoist').setDescription('Hoist role').setRequired(false))
      .addBooleanOption(o => o.setName('mentionable').setDescription('Make role mentionable').setRequired(false))
    )
    .addSubcommand(s => s.setName('delete').setDescription('Delete a role').addRoleOption(o => o.setName('role').setDescription('Role to delete').setRequired(true)))
    .addSubcommand(s => s.setName('assign').setDescription('Assign a role to a member').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)).addUserOption(u => u.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a role from a member').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)).addUserOption(u => u.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('clone').setDescription('Clone a role').addRoleOption(o => o.setName('role').setDescription('Role to clone').setRequired(true)).addStringOption(o => o.setName('name').setDescription('New name').setRequired(false)))
    .addSubcommand(s => s.setName('info').setDescription('Show role information').addRoleOption(o => o.setName('role').setDescription('Role to inspect').setRequired(true)))
    .addSubcommand(s => s.setName('bulkassign').setDescription('Bulk-assign a role by filter (hasRole:NAME)').addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)).addStringOption(o => o.setName('filter').setDescription('Filter (e.g., hasRole:member)').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'perms') {
      const embed = new EmbedBuilder().setTitle('Role Permissions').setDescription('Open the permission editor.').setColor(0x2b2d31);
      // button triggers handler flow
      return safeReply(interaction, { embeds: [embed], components: [{ type: 1, components: [{ type: 2, custom_id: 'rolep:init', label: 'Open Editor', style: 1 }]}] });
    }

    // other subcommands require ManageRoles
    if (![ 'info' ].includes(sub) && !interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return safeReply(interaction, { content: 'You need Manage Roles permission to use this subcommand.', ephemeral: true });
    }

    try {
      if (sub === 'create') {
        const name = interaction.options.getString('name');
        const color = interaction.options.getString('color') || undefined;
        const hoist = interaction.options.getBoolean('hoist') || false;
        const mentionable = interaction.options.getBoolean('mentionable') || false;
        const role = await interaction.guild.roles.create({ name, color, hoist, mentionable });
        const embed = new EmbedBuilder().setTitle('Role Created').setDescription(`${role}`).setColor(role.color || 0x2b2d31);
        return safeReply(interaction, { embeds: [embed] });
      }

      if (sub === 'delete') {
        const role = interaction.options.getRole('role');
        await role.delete('Deleted via bot');
        return safeReply(interaction, { content: `Deleted role ${role.name}` });
      }

      if (sub === 'assign') {
        const role = interaction.options.getRole('role');
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(role);
        return safeReply(interaction, { content: `Assigned ${role} to ${member.user.tag}` });
      }

      if (sub === 'remove') {
        const role = interaction.options.getRole('role');
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.remove(role);
        return safeReply(interaction, { content: `Removed ${role} from ${member.user.tag}` });
      }

      if (sub === 'clone') {
        const role = interaction.options.getRole('role');
        const newName = interaction.options.getString('name') || `${role.name}-clone`;
        const clone = await interaction.guild.roles.create({ name: newName, color: role.color, hoist: role.hoist, mentionable: role.mentionable, permissions: role.permissions });
        return safeReply(interaction, { content: `Cloned role as ${clone}` });
      }

      if (sub === 'info') {
        const role = interaction.options.getRole('role');
        const members = role.members.map(m => m.user.tag).slice(0, 30).join('\n') || 'No members';
        const embed = new EmbedBuilder().setTitle(`Role Info — ${role.name}`).setColor(role.color || 0x2b2d31).addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Color', value: role.hexColor || '—', inline: true },
          { name: 'Position', value: `${role.position}`, inline: true },
          { name: 'Members (sample)', value: members, inline: false },
          { name: 'Permissions', value: role.permissions.toArray().slice(0,50).join(', ') || '—', inline: false }
        );
        return safeReply(interaction, { embeds: [embed] });
      }

      if (sub === 'bulkassign') {
        const role = interaction.options.getRole('role');
        const filter = interaction.options.getString('filter');
        if (filter.startsWith('hasRole:')) {
          const rname = filter.split(':')[1];
          const target = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === rname.toLowerCase());
          if (!target) return safeReply(interaction, { content: 'Filter role not found', ephemeral: true });
          await interaction.deferReply();
          let count = 0;
          const members = await interaction.guild.members.fetch();
          for (const m of members.values()) {
            if (m.roles.cache.has(target.id)) {
              try { await m.roles.add(role); count++; } catch {}
            }
          }
          return safeReply(interaction, { content: `Assigned ${role} to ${count} members` });
        }
        return safeReply(interaction, { content: 'Unsupported filter. Use hasRole:ROLE_NAME', ephemeral: true });
      }
    } catch (err) {
      console.error('role command error:', err);
      return safeReply(interaction, { content: 'Action failed: ' + (err.message || err), ephemeral: true });
    }
  }
};
