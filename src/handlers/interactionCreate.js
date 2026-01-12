const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  PermissionsBitField
} = require('discord.js');

const { PERM_OPTIONS, nameToFlag } = require('../lib/permissions');
const { storeUndo, consumeUndo } = require('../lib/undoCache');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// helper: safe update/editReply/reply/followUp for component interactions
async function safeRespond(interaction, payload) {
  try {
    // For component interactions prefer update() to keep components replaced
    if (typeof interaction.update === 'function' && (interaction.isButton?.() || interaction.isStringSelectMenu?.() || interaction.isRoleSelectMenu?.() || interaction.isChannelSelectMenu?.())) {
      try { return await interaction.update(payload); } catch (err) { /* fallthrough to reply/edit */ }
    }
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) {
    console.error('safeRespond failed:', err && err.message ? err.message : err);
    try { if (!interaction.replied) await interaction.followUp({ content: 'Failed to respond (interaction may have expired).', ephemeral: true }); } catch {}
  }
}

// build permission select (max 25 options)
function buildPermSelect(customId) {
  const options = PERM_OPTIONS.slice(0, 25).map(o => ({ label: o.label, value: o.value }));
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Select permissions (max 25)')
    .addOptions(options)
    .setMinValues(1)
    .setMaxValues(Math.min(25, options.length));
}

module.exports = async function interactionHandler(interaction, client) {
  try {
    // ---------- BUTTONS ----------
    if (interaction.isButton?.()) {
      const id = interaction.customId;

      // ==== Role perms: open initial actions ====
      if (id === 'rolep:init') {
        const embed = new EmbedBuilder().setTitle('Role Permission Editor').setDescription('Choose action: Add / Remove / Reset / Show').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rolep:action:add').setLabel('Add').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rolep:action:remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('rolep:action:reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rolep:action:show').setLabel('Show').setStyle(ButtonStyle.Secondary)
        );
        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }

      // Cancel
      if (id === 'common:cancel') {
        return await safeRespond(interaction, { content: 'Cancelled.', embeds: [], components: [] });
      }

      // Undo
      if (id.startsWith('undo:')) {
        const undoId = id.split(':')[1];
        const entry = consumeUndo(undoId);
        if (!entry) return await safeRespond(interaction, { content: 'Undo expired or invalid.', ephemeral: true });
        try {
          await entry.applyUndoFn(entry.beforeState);
          return await safeRespond(interaction, { content: 'Undo applied successfully.', ephemeral: true });
        } catch (err) {
          return await safeRespond(interaction, { content: 'Undo failed: ' + (err.message || err), ephemeral: true });
        }
      }

      // Role perms: after choosing Add/Remove/Reset/Show -> show role select
      if (id.startsWith('rolep:action:')) {
        const mode = id.split(':')[2]; // add/remove/reset/show
        // show a role select component
        const select = new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId(`rolep:select:${mode}`).setPlaceholder('Select a role to configure')
        );
        const embed = new EmbedBuilder().setTitle(`Select a role — ${mode.toUpperCase()}`).setDescription('Choose a role to continue').setColor(0x2b2d31);
        return await safeRespond(interaction, { embeds: [embed], components: [select], content: null });
      }

      // Role perms: confirm apply button (customId rolep:confirm:<mode>:<payloadKey>)
      if (id.startsWith('rolep:confirm:')) {
        const [, , mode, payloadKey] = id.split(':'); // rolep:confirm:add:payload-...
        const tmpPath = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmpPath)) return await safeRespond(interaction, { content: 'Pending data missing.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
        // payload contains: { roleId, addMaskStr, removeMaskStr }
        try {
          const role = await interaction.guild.roles.fetch(payload.roleId);
          if (!role) throw new Error('Role not found');
          const before = BigInt(role.permissions.bitfield);
          let newMask = before;
          if (mode === 'add') newMask = before | BigInt(payload.addMaskStr);
          if (mode === 'remove') newMask = before & ~BigInt(payload.removeMaskStr);
          if (mode === 'reset') newMask = BigInt(payload.resetMaskStr || 0n);
          await role.edit({ permissions: newMask });
          // store undo
          const undoId = storeUndo(interaction.guild.id, { roleId: role.id, before: before.toString() }, async (beforeState) => {
            const r = await interaction.guild.roles.fetch(beforeState.roleId || beforeState.roleId);
            if (r) await r.edit({ permissions: BigInt(beforeState.before) });
          }, 45);
          // cleanup temp file
          try { fs.unlinkSync(tmpPath); } catch {}
          const embed = new EmbedBuilder().setTitle('Permissions Updated').setDescription(`Applied ${mode} to role ${role.name}`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          return await safeRespond(interaction, { embeds: [embed], components: [undoRow], content: null });
        } catch (err) {
          return await safeRespond(interaction, { content: 'Failed to apply permissions: ' + (err.message || err), ephemeral: true });
        }
      }

      // ---- Channel perms buttons ----
      // Show channel actions after channel selected (handled in channel select)
      if (id.startsWith('chanp:action:')) {
        // e.g. chanp:action:addrole:<channelId>
        const parts = id.split(':');
        const action = parts[2];
        const channelId = parts[3];
        if (action === 'addrole' || action === 'addmember') {
          // ask to select role (or member via role select? For member we would use user selection; here role only)
          const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`chanp:select_role:${action}:${channelId}`).setPlaceholder('Select role to modify channel overwrite'));
          const embed = new EmbedBuilder().setTitle('Select Role').setDescription('Choose role to add overwrite for').setColor(0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
        }
        if (action === 'view') {
          const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
          if (!ch) return await safeRespond(interaction, { content: 'Channel not found', ephemeral: true });
          const overwrites = ch.permissionOverwrites.cache.map(o => {
            const allow = new PermissionsBitField(BigInt(o.allow?.bitfield || o.allow || 0n)).toArray().join(', ') || '—';
            const deny = new PermissionsBitField(BigInt(o.deny?.bitfield || o.deny || 0n)).toArray().join(', ') || '—';
            return `**${o.id}** (type ${o.type})\nAllow: ${allow}\nDeny: ${deny}`;
          }).join('\n\n') || 'No overwrites';
          const embed = new EmbedBuilder().setTitle(`Overwrites for ${ch.name}`).setDescription(overwrites).setColor(0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [] });
        }
        if (action === 'change') {
          // show channel select again
          const embed = new EmbedBuilder().setTitle('Change Channel').setDescription('Select a new channel to continue').setColor(0x2b2d31);
          const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('chanp:select_channel').setPlaceholder('Select channel'));
          return await safeRespond(interaction, { embeds: [embed], components: [row] });
        }
      }

      // Confirm channel apply button: chanp:confirm:<mode>:<targetId>:<payloadKey>
      if (id.startsWith('chanp:confirm:')) {
        const [, , mode, targetId, payloadKey] = id.split(':');
        const tmpPath = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmpPath)) return await safeRespond(interaction, { content: 'Pending data missing.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
        try {
          const ch = await interaction.guild.channels.fetch(payload.channelId);
          if (!ch) throw new Error('Channel not found');
          // payload contains: { channelId, targetId (role or user), allowMask, denyMask }
          const beforeOverwrite = ch.permissionOverwrites.cache.get(payload.targetId);
          const beforeAllow = BigInt(beforeOverwrite?.allow?.bitfield || beforeOverwrite?.allow || 0n);
          const beforeDeny = BigInt(beforeOverwrite?.deny?.bitfield || beforeOverwrite?.deny || 0n);
          // Apply overwrite: set allow/deny as provided
          const allow = BigInt(payload.allowMask || 0n);
          const deny = BigInt(payload.denyMask || 0n);
          await ch.permissionOverwrites.edit(payload.targetId, { allow, deny });
          // store undo that restores previous allow/deny
          const undoId = storeUndo(interaction.guild.id, { channelId: ch.id, targetId: payload.targetId, beforeAllow: beforeAllow.toString(), beforeDeny: beforeDeny.toString() }, async (beforeState) => {
            const c = await interaction.guild.channels.fetch(beforeState.channelId);
            if (!c) return;
            await c.permissionOverwrites.edit(beforeState.targetId, { allow: BigInt(beforeState.beforeAllow), deny: BigInt(beforeState.beforeDeny) });
          }, 45);
          try { fs.unlinkSync(tmpPath); } catch {}
          const embed = new EmbedBuilder().setTitle('Channel Overwrite Applied').setDescription(`Applied ${mode} for <#${ch.id}> target ${payload.targetId}`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          return await safeRespond(interaction, { embeds: [embed], components: [undoRow], content: null });
        } catch (err) {
          return await safeRespond(interaction, { content: 'Failed to apply channel overwrite: ' + (err.message || err), ephemeral: true });
        }
      }
    }

    // ---------- ROLE SELECT MENU ----------
    if (interaction.isRoleSelectMenu?.()) {
      const cid = interaction.customId;
      // rolep flow: rolep:select:<mode>
      if (cid.startsWith('rolep:select:')) {
        const mode = cid.split(':')[2];
        const roleId = interaction.values[0];
        if (mode === 'show') {
          const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
          if (!role) return await safeRespond(interaction, { content: 'Role not found', ephemeral: true });
          const permsArr = role.permissions.toArray();
          const embed = new EmbedBuilder().setTitle(`Permissions — ${role.name}`).setDescription(permsArr.length ? permsArr.join(', ') : 'No permissions').setColor(role.color || 0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [] });
        }

        if (mode === 'reset') {
          // For reset, we'll set permissions to 0 (strip). Show preview and confirm.
          const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
          if (!role) return await safeRespond(interaction, { content: 'Role not found', ephemeral: true });
          const beforeArr = role.permissions.toArray();
          const afterArr = [];
          const embed = new EmbedBuilder()
            .setTitle(`Preview — Reset Permissions for ${role.name}`)
            .addFields(
              { name: 'Before', value: beforeArr.length ? beforeArr.join(', ') : '—', inline: false },
              { name: 'After', value: afterArr.length ? afterArr.join(', ') : '—', inline: false }
            ).setColor(role.color || 0x2b2d31)
            .setFooter({ text: 'Confirm to apply. Undo available shortly.' });

          // store payload
          const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
          const payload = { mode: 'reset', roleId, resetMaskStr: '0' };
          fs.writeFileSync(path.join(DATA_DIR, `${payloadKey}.json`), JSON.stringify(payload));
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rolep:confirm:reset:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
          );
          return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
        }

        // add/remove mode -> show permission select
        const select = buildPermSelect(`rolep:perms:${mode}:${roleId}`);
        const row = new ActionRowBuilder().addComponents(select);
        const embed = new EmbedBuilder().setTitle(`${mode === 'add' ? 'Add' : 'Remove'} Permissions — Select perms`).setColor(0x2b2d31);
        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }

      // channel perms flow: chanp:select_role:<action>:<channelId>
      if (cid.startsWith('chanp:select_role:')) {
        // values[0] is roleId
        const parts = cid.split(':');
        const action = parts[2]; // addrole or addmember
        const channelId = parts[3];
        const roleId = interaction.values[0];
        // show permission select next
        const select = buildPermSelect(`chanp:perms:${action}:${channelId}:${roleId}`);
        const embed = new EmbedBuilder().setTitle('Select permissions to set for this role on the channel').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(select);
        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }
    }

    // ---------- STRING SELECT (permission picks) ----------
    if (interaction.isStringSelectMenu?.()) {
      const cid = interaction.customId;

      // role perms: rolep:perms:<mode>:<roleId>
      if (cid.startsWith('rolep:perms:')) {
        const [, , mode, roleId] = cid.split(':');
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) return await safeRespond(interaction, { content: 'Role not found', ephemeral: true });

        // compute mask(s)
        let addMask = 0n;
        let removeMask = 0n;
        for (const v of interaction.values) {
          const flag = BigInt(nameToFlag(v) || 0n);
          if (mode === 'add') addMask |= flag;
          else removeMask |= flag;
        }

        const beforeArr = role.permissions.toArray();
        let afterMask = BigInt(role.permissions.bitfield);
        if (mode === 'add') afterMask = afterMask | addMask;
        else afterMask = afterMask & ~removeMask;
        const afterPF = new PermissionsBitField(afterMask);
        const afterArr = afterPF.toArray();

        const embed = new EmbedBuilder()
          .setTitle(`Preview — ${mode === 'add' ? 'Add' : 'Remove'} for ${role.name}`)
          .addFields(
            { name: 'Before', value: beforeArr.length ? beforeArr.join(', ') : '—', inline: false },
            { name: 'After', value: afterArr.length ? afterArr.join(', ') : '—', inline: false }
          ).setColor(role.color || 0x2b2d31)
          .setFooter({ text: 'Confirm to apply. Undo available shortly.' });

        // persist payload to file
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        const payload = { mode, roleId, addMaskStr: addMask.toString(), removeMaskStr: removeMask.toString() };
        fs.writeFileSync(path.join(DATA_DIR, `${payloadKey}.json`), JSON.stringify(payload));

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`rolep:confirm:${mode}:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }

      // channel perms: chanp:perms:<action>:<channelId>:<roleId>
      if (cid.startsWith('chanp:perms:')) {
        // action addrole/addmember, channelId, roleId
        const [, , action, channelId, roleId] = cid.split(':');
        // gather mask values (selected permissions)
        let mask = 0n;
        for (const v of interaction.values) mask |= BigInt(nameToFlag(v) || 0n);

        // Next ask allow/deny/clear via buttons
        const embed = new EmbedBuilder().setTitle('Permission Mode').setDescription('Choose Allow / Deny / Clear for the selected permissions').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:mode:allow:${channelId}:${roleId}:${mask}`).setLabel('Allow').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`chanp:mode:deny:${channelId}:${roleId}:${mask}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`chanp:mode:clear:${channelId}:${roleId}:${mask}`).setLabel('Clear').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }
    }

    // ---------- CHANNEL SELECT MENU ----------
    if (interaction.isChannelSelectMenu?.()) {
      const cid = interaction.customId;
      if (cid === 'chanp:select_channel') {
        const channelId = interaction.values[0];
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return await safeRespond(interaction, { content: 'Channel not found', ephemeral: true });
        const embed = new EmbedBuilder().setTitle(`Configure Channel: ${ch.name}`).setDescription('Choose action').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:action:addrole:${channelId}`).setLabel('Add Role Overwrite').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`chanp:action:addmember:${channelId}`).setLabel('Add Member Overwrite').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`chanp:action:view:${channelId}`).setLabel('View Overwrites').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`chanp:action:change:${channelId}`).setLabel('Change Channel').setStyle(ButtonStyle.Secondary)
        );
        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }
    }

    // ---------- BUTTONS for chanp mode (allow/deny/clear) ----------
    if (interaction.isButton?.()) {
      const id = interaction.customId;
      if (id.startsWith('chanp:mode:')) {
        // chanp:mode:<mode>:<channelId>:<roleId>:<mask>
        const [, , mode, channelId, roleId, maskStr] = id.split(':');
        const mask = BigInt(maskStr || '0');
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return await safeRespond(interaction, { content: 'Channel not found', ephemeral: true });

        // compute current allow/deny bitfields
        const existing = ch.permissionOverwrites.cache.get(roleId);
        const currentAllow = BigInt(existing?.allow?.bitfield || existing?.allow || 0n);
        const currentDeny = BigInt(existing?.deny?.bitfield || existing?.deny || 0n);
        let newAllow = currentAllow;
        let newDeny = currentDeny;

        if (mode === 'allow') {
          // remove from deny, add to allow
          newDeny = newDeny & ~mask;
          newAllow = newAllow | mask;
        } else if (mode === 'deny') {
          newAllow = newAllow & ~mask;
          newDeny = newDeny | mask;
        } else if (mode === 'clear') {
          newAllow = newAllow & ~mask;
          newDeny = newDeny & ~mask;
        }

        // show preview embed with before/after permission names
        const beforeAllowArr = new PermissionsBitField(currentAllow).toArray();
        const beforeDenyArr = new PermissionsBitField(currentDeny).toArray();
        const afterAllowArr = new PermissionsBitField(newAllow).toArray();
        const afterDenyArr = new PermissionsBitField(newDeny).toArray();

        const embed = new EmbedBuilder()
          .setTitle(`Preview — ${mode.toUpperCase()} on ${ch.name}`)
          .addFields(
            { name: 'Before — Allow', value: beforeAllowArr.length ? beforeAllowArr.join(', ') : '—', inline: false },
            { name: 'Before — Deny', value: beforeDenyArr.length ? beforeDenyArr.join(', ') : '—', inline: false },
            { name: 'After — Allow', value: afterAllowArr.length ? afterAllowArr.join(', ') : '—', inline: false },
            { name: 'After — Deny', value: afterDenyArr.length ? afterDenyArr.join(', ') : '—', inline: false }
          ).setColor(0x2b2d31).setFooter({ text: 'Confirm to apply. Undo available shortly.' });

        // store payload to file
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        const payload = { channelId, targetId: roleId, allowMask: newAllow.toString(), denyMask: newDeny.toString() };
        fs.writeFileSync(path.join(DATA_DIR, `${payloadKey}.json`), JSON.stringify(payload));

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:confirm:${mode}:${roleId}:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }
    }

  } catch (err) {
    console.error('interactionHandler caught error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal error in handler', ephemeral: true });
      else await interaction.followUp({ content: 'Internal error in handler', ephemeral: true });
    } catch {}
  }
};
