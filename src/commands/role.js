// src/commands/role.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder().setName('role').setDescription('Role utilities')
    .addSubcommand(s => s.setName('create').setDescription('Create a role').addStringOption(o => o.setName('name').setRequired(true)).addStringOption(o => o.setName('color').setDescription('Hex color (e.g. #ff0000)')))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a role').addRoleOption(o => o.setName('role').setRequired(true)).addStringOption(o => o.setName('name')).addStringOption(o => o.setName('color')).addBooleanOption(o => o.setName('hoist')).addBooleanOption(o => o.setName('mentionable')))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a role').addRoleOption(o => o.setName('role').setRequired(true)))
    .addSubcommand(s => s.setName('info').setDescription('Role info').addRoleOption(o => o.setName('role').setRequired(true)))
    .addSubcommand(s => s.setName('assign').setDescription('Assign role to user').addRoleOption(o => o.setName('role').setRequired(true)).addUserOption(o => o.setName('user').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove role from user').addRoleOption(o => o.setName('role').setRequired(true)).addUserOption(o => o.setName('user').setRequired(true)))
    .addSubcommand(s => s.setName('clone').setDescription('Clone a role').addRoleOption(o => o.setName('role').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'create') {
        const name = interaction.options.getString('name', true);
        const color = interaction.options.getString('color') || undefined;
        const created = await interaction.guild.roles.create({ name, color, reason: `Created by ${interaction.user.tag}` });
        const embed = new EmbedBuilder().setTitle('Role Created').setDescription(`**${created.name}**`).addFields({ name: 'ID', value: created.id }).setColor(created.color || 0x00AA00);
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === 'edit') {
        const role = interaction.options.getRole('role', true);
        // minimal permission check
        if (!interaction.memberPermissions.has('ManageRoles')) return interaction.reply({ content: 'You need Manage Roles permission.', ephemeral: true });
        const updates = {};
        const name = interaction.options.getString('name');
        const color = interaction.options.getString('color');
        const hoist = interaction.options.getBoolean('hoist');
        const mentionable = interaction.options.getBoolean('mentionable');
        if (name) updates.name = name;
        if (typeof color === 'string') updates.color = color;
        if (typeof hoist === 'boolean') updates.hoist = hoist;
        if (typeof mentionable === 'boolean') updates.mentionable = mentionable;

        await role.edit(updates, `Edited by ${interaction.user.tag}`);
        return interaction.reply({ content: `Role ${role.name} updated.` });
      }

      if (sub === 'delete') {
        const role = interaction.options.getRole('role', true);
        if (!interaction.memberPermissions.has('ManageRoles')) return interaction.reply({ content: 'You need Manage Roles permission.', ephemeral: true });

        // write payload to data file for confirm
        const payloadKey = `delrole-${Date.now()}`;
        const dir = path.join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${payloadKey}.json`), JSON.stringify({ action: 'delete-role', roleId: role.id }));

        const embed = new EmbedBuilder().setTitle('Confirm Role Delete').setDescription(`Are you sure you want to delete **${role.name}**? This action can be undone (limited).`).setColor(0xff5500);
        const row = { type: 1, components: [
          { type: 2, style: ButtonStyle.Danger, label: 'Confirm', custom_id: `confirm:delete-role:${payloadKey}` },
          { type: 2, style: ButtonStyle.Secondary, label: 'Cancel', custom_id: `cancel:${payloadKey}` }
        ]};

        return interaction.reply({ embeds: [embed], components: [row] });
      }

      if (sub === 'info') {
        const role = interaction.options.getRole('role', true);
        const members = role.members.size;
        const embed = new EmbedBuilder()
          .setTitle(`Role — ${role.name}`)
          .addFields(
            { name: 'ID', value: role.id, inline: true },
            { name: 'Members', value: String(members), inline: true },
            { name: 'Position', value: String(role.position), inline: true },
            { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
            { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }
          )
          .setColor(role.color || 0x2b2d31);
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === 'assign' || sub === 'remove') {
        const role = interaction.options.getRole('role', true);
        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'Member not found in this guild.', ephemeral: true });
        if (!interaction.memberPermissions.has('ManageRoles')) return interaction.reply({ content: 'You need Manage Roles permission.', ephemeral: true });

        if (sub === 'assign') {
          await member.roles.add(role, `Assigned by ${interaction.user.tag}`);
          return interaction.reply({ content: `Assigned ${role.name} to ${member.user.tag}.` });
        } else {
          await member.roles.remove(role, `Removed by ${interaction.user.tag}`);
          return interaction.reply({ content: `Removed ${role.name} from ${member.user.tag}.` });
        }
      }

      if (sub === 'clone') {
        const role = interaction.options.getRole('role', true);
        const cloned = await interaction.guild.roles.create({
          name: `${role.name} (clone)`,
          color: role.color,
          hoist: role.hoist,
          mentionable: role.mentionable,
          reason: `Cloned by ${interaction.user.tag}`
        });
        return interaction.reply({ content: `Cloned role as ${cloned.name}.` });
      }

      return interaction.reply({ content: 'Unknown role subcommand.', ephemeral: true });
    } catch (err) {
      console.error('role command failed', err);
      try { return interaction.reply({ content: 'Internal error when running role command.', ephemeral: true }); } catch {}
    }
  }
};
