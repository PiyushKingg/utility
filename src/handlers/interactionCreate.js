const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField
} = require('discord.js');

const { PERM_OPTIONS, permissionNameToFlag } = require('../lib/permissions');
const { storeUndo, getUndo, consumeUndo } = require('../lib/undoCache');

module.exports = async function interactionHandler(interaction, client) {
  // Chat input commands
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return interaction.reply({ content: 'Unknown command', ephemeral: true });
    return cmd.execute(interaction, client);
  }

  // Button clicks
  if (interaction.isButton()) {
    const cid = interaction.customId;

    // Entry buttons for role perms flow
    if (cid === 'rolep:init_add') {
      const embed = new EmbedBuilder()
        .setTitle('Role Permissions — Add')
        .setDescription('Select the role you want to edit from the dropdown below.')
        .setColor(0x2b2d31);

      const row = new ActionRowBuilder()
        .addComponents(new RoleSelectMenuBuilder().setCustomId('rolep:select_role_add').setPlaceholder('Select a role').setMinValues(1).setMaxValues(1));

      await interaction.update({ embeds: [embed], components: [row], content: null });
      return;
    }

    if (cid === 'rolep:init_remove') {
      const embed = new EmbedBuilder()
        .setTitle('Role Permissions — Remove')
        .setDescription('Select the role you want to edit (remove permissions).')
        .setColor(0x2b2d31);
      const row = new ActionRowBuilder()
        .addComponents(new RoleSelectMenuBuilder().setCustomId('rolep:select_role_remove').setPlaceholder('Select a role').setMinValues(1).setMaxValues(1));
      await interaction.update({ embeds: [embed], components: [row], content: null });
      return;
    }

    // Undo button (format: rolep:undo:<actionId>)
    if (cid.startsWith('rolep:undo:')) {
      const actionId = cid.split(':')[2];
      const saved = consumeUndo(actionId);
      if (!saved) {
        await interaction.reply({ content: 'Undo window expired or invalid action.', ephemeral: true });
        return;
      }
      // Demo revert: we only restored the beforeState in memory; a full implementation would apply the beforeState
      await interaction.reply({ content: `Undo applied (demo). Was: ${JSON.stringify(saved.beforeState)}`, ephemeral: true });
      return;
    }
  }

  // Role select (after clicking Add or Remove)
  if (interaction.isRoleSelectMenu()) {
    const cid = interaction.customId;
    // rolep:select_role_add
    if (cid === 'rolep:select_role_add') {
      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.update({ content: 'Role not found.', components: [], embeds: [] });

      // Validate bot permissions and hierarchy
      const me = await interaction.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.update({ content: 'I need Manage Roles permission to edit roles.', components: [], embeds: [] });
      }
      if (me.roles.highest.position <= role.position) {
        return interaction.update({ content: 'I cannot edit this role because my role is not high enough. Move my role higher.', components: [], embeds: [] });
      }

      // Present permission multi-select (as string select due to builder limitations)
      const permOptions = PERM_OPTIONS.map(p => ({ label: p.label, value: p.value }));
      const select = new StringSelectMenuBuilder()
        .setCustomId(`rolep:select_perms_add:${roleId}`)
        .setPlaceholder('Select permissions to ADD (max 25)')
        .addOptions(permOptions)
        .setMinValues(1)
        .setMaxValues(Math.min(25, permOptions.length));

      const embed = new EmbedBuilder()
        .setTitle(`Add permissions — ${role.name}`)
        .setDescription('Choose the permissions you want to add, then confirm.')
        .setColor(0x2b2d31);

      const row = new ActionRowBuilder().addComponents(select);
      await interaction.update({ embeds: [embed], components: [row], content: null });
      return;
    }

    if (cid === 'rolep:select_role_remove') {
      const roleId = interaction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.update({ content: 'Role not found.', components: [], embeds: [] });

      const me = await interaction.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.update({ content: 'I need Manage Roles permission to edit roles.', components: [], embeds: [] });
      }
      if (me.roles.highest.position <= role.position) {
        return interaction.update({ content: 'I cannot edit this role because my role is not high enough. Move my role higher.', components: [], embeds: [] });
      }

      const permOptions = PERM_OPTIONS.map(p => ({ label: p.label, value: p.value }));
      const select = new StringSelectMenuBuilder()
        .setCustomId(`rolep:select_perms_remove:${roleId}`)
        .setPlaceholder('Select permissions to REMOVE (max 25)')
        .addOptions(permOptions)
        .setMinValues(1)
        .setMaxValues(Math.min(25, permOptions.length));

      const embed = new EmbedBuilder()
        .setTitle(`Remove permissions — ${role.name}`)
        .setDescription('Choose the permissions you want to remove, then confirm.')
        .setColor(0x2b2d31);

      const row = new ActionRowBuilder().addComponents(select);
      await interaction.update({ embeds: [embed], components: [row], content: null });
      return;
    }
  }

  // String select (permissions chosen)
  if (interaction.isStringSelectMenu()) {
    const parts = interaction.customId.split(':');
    // rolep:select_perms_add:<roleId>
    if (parts[0] === 'rolep' && (parts[1] === 'select_perms_add' || parts[1] === 'select_perms_remove')) {
      const mode = parts[1] === 'select_perms_add' ? 'add' : 'remove';
      const roleId = parts[2];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.update({ content: 'Role missing. Please retry.', components: [], embeds: [] });

      // Compute bit operations
      let deltaBits = 0n;
      for (const val of interaction.values) {
        deltaBits |= BigInt(permissionNameToFlag(val));
      }

      // current mask
      const currentMask = BigInt(role.permissions.bitfield);

      let newMask;
      if (mode === 'add') newMask = currentMask | deltaBits;
      else newMask = currentMask & ~deltaBits;

      // Build preview lists
      const beforeList = role.permissions.toArray();
      const afterPF = new PermissionsBitField(newMask);
      const afterList = afterPF.toArray();

      const embed = new EmbedBuilder()
        .setTitle('Preview Permission Change')
        .addFields(
          { name: 'Target Role', value: `${role.name}`, inline: true },
          { name: 'Before', value: beforeList.length ? beforeList.join(', ') : '—', inline: false },
          { name: 'After', value: afterList.length ? afterList.join(', ') : '—', inline: false }
        )
        .setColor(0x2b2d31)
        .setFooter({ text: 'Press Confirm to apply. Undo will be available briefly.' });

      const confirmBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rolep:confirm_${mode}:${roleId}:${Date.now()}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('rolep:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      // store the computed newMask and delta on ephemeral message components would require server-side storage.
      // For this simple skeleton we rely on re-computing on confirm and assume no race for demo.

      await interaction.update({ embeds: [embed], components: [confirmBtn], content: null });
      return;
    }
  }

  // Confirm apply button
  if (interaction.isButton()) {
    const cid = interaction.customId;
    if (cid.startsWith('rolep:confirm_add:') || cid.startsWith('rolep:confirm_remove:')) {
      // parts: rolep:confirm_add:<roleId>:<timestamp>
      const parts = cid.split(':');
      const mode = parts[1] === 'confirm_add' ? 'add' : 'remove';
      const roleId = parts[2];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.update({ content: 'Role missing at confirm time.', components: [], embeds: [] });

      const me = await interaction.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.update({ content: 'I need Manage Roles permission to perform this action.', components: [], embeds: [] });
      }
      if (me.roles.highest.position <= role.position) {
        return interaction.update({ content: 'I cannot edit this role because my role hierarchy is not high enough.', components: [], embeds: [] });
      }

      // *** NOTE ***
      // For a full implementation you would persist the selected permission choices between steps.
      // Here we will simply acknowledge and store a demo "before state" in undo cache.
      const before = role.permissions.bitfield;
      const actionId = storeUndo(interaction.guild.id, { type: 'role_perms_demo', roleId, before });

      const embed = new EmbedBuilder()
        .setTitle('Permissions Applied (demo)')
        .setDescription(`Demo applied for ${role.name}. Undo available for a short period.`)
        .setColor(0x00aa00);

      const undoRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rolep:undo:${actionId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ embeds: [embed], components: [undoRow], content: null });
      return;
    }

    // cancel button
    if (interaction.customId === 'rolep:cancel') {
      await interaction.update({ content: 'Cancelled.', embeds: [], components: [] });
      return;
    }
  }
};
