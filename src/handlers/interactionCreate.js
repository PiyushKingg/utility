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

const {
  nameToFlag,
  permsForContext,
  partsForContext,
  allFlagsForContext
} = require('../lib/permissions');

const { storeUndo, consumeUndo } = require('../lib/undoCache');
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// HELPER: safe edit for message-components:
// - Immediately deferUpdate() to acknowledge the component interaction.
// - Then try editing the original message (interaction.message.edit).
// - If message editing fails, fallback to channel.send a normal message.
// Returns true if an acknowledgement+attempt to respond was made.
async function respondComponentByEditing(interaction, responsePayload) {
  try {
    // ack quickly
    await interaction.deferUpdate().catch(() => null);

    // If no original message (rare), fallback to channel send
    if (!interaction.message) {
      if (interaction.channel) {
        await interaction.channel.send(responsePayload).catch(() => null);
        return true;
      }
      return false;
    }

    // Try to edit the original message (this is the visible update behavior)
    try {
      await interaction.message.edit(responsePayload);
      return true;
    } catch (err) {
      // fallback: send a reply in the channel
      try {
        await interaction.channel.send(responsePayload);
        return true;
      } catch (err2) {
        console.error('respondComponentByEditing: both edit and channel.send failed', err, err2);
        return false;
      }
    }
  } catch (err) {
    console.error('respondComponentByEditing general failure', err);
    return false;
  }
}

// HELPER: safe responder for chat commands (ChatInputInteraction)
async function respondCommand(interaction, payload) {
  try {
    if (!interaction.deferred && !interaction.replied) return await interaction.reply(payload);
    if (interaction.deferred) return await interaction.editReply(payload);
    return await interaction.followUp(payload);
  } catch (err) {
    // If already acknowledged or expired, attempt an edit/followUp as fallback
    try { if (interaction.deferred || interaction.replied) return await interaction.editReply(payload); } catch {}
    try { return await interaction.followUp(payload); } catch (e) { console.error('respondCommand fallback failed', err, e); }
  }
  return null;
}

// BUILD SELECT OPTIONS (no emojis)
function buildOptions(arr) {
  return arr.map(p => ({ label: p.label, value: p.key }));
}

// Build 3 selects and "All Permissions" row for given context (role/channel)
function buildPermissionSelects(customBase, payloadKey, context = 'role') {
  const parts = partsForContext(context);
  const rows = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const idPart = ['a', 'b', 'c'][i];
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`${customBase}:${idPart}:${payloadKey}`)
      .setPlaceholder(`Permissions (${i + 1}/3)`)
      .addOptions(buildOptions(part))
      .setMinValues(0)
      .setMaxValues(Math.min(25, part.length));
    rows.push(new ActionRowBuilder().addComponents(menu));
  }

  const allBtnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`perm:all:${payloadKey}:${context}`).setLabel('All Permissions').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );

  return { rows, allBtnRow };
}

function persistSelections(payloadKey, part, values) {
  const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
  let data = {};
  if (fs.existsSync(tmp)) {
    try { data = JSON.parse(fs.readFileSync(tmp, 'utf8')); } catch {}
  }
  data.selections = data.selections || {};
  data.selections[part] = values;
  fs.writeFileSync(tmp, JSON.stringify(data));
}

function computeMaskFromPayload(payloadKey) {
  const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
  if (!fs.existsSync(tmp)) return 0n;
  const data = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const context = data.context || 'role';
  const selA = data.selections?.a || [];
  const selB = data.selections?.b || [];
  const selC = data.selections?.c || [];
  if (selA.includes('ALL') || selB.includes('ALL') || selC.includes('ALL') || data.all === true) {
    return allFlagsForContext(context);
  }
  let mask = 0n;
  for (const k of [...selA, ...selB, ...selC]) mask |= nameToFlag(k, context);
  return mask;
}

function formatEnabledPerms(mask, context = 'role') {
  const perms = permsForContext(context);
  const lines = [];
  for (const p of perms) {
    const f = nameToFlag(p.key, context);
    if (f && (BigInt(f) & BigInt(mask)) !== 0n) lines.push(`✅ ${p.label}`);
  }
  return lines.length ? lines.join('\n') : '—';
}

// Check whether bot can edit a specific role (ManageRoles permission + role position)
function botCanManageRole(guild, role) {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: 'Unable to fetch bot member object.' };
  if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return { ok: false, reason: 'Bot missing Manage Roles permission.' };
  // bot's highest role position must be greater than target role
  const botRole = me.roles.highest;
  if (!botRole) return { ok: false, reason: 'Bot has no roles.' };
  if (botRole.position <= role.position) return { ok: false, reason: `Bot role position (${botRole.position}) is not higher than target role (${role.position}).` };
  return { ok: true };
}

// Check whether bot can manage channel overwrites
function botCanManageChannel(guild, channel) {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: 'Unable to fetch bot member object.' };
  if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels) && !me.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return { ok: false, reason: 'Bot missing Manage Channels permission.' };
  }
  return { ok: true };
}

module.exports = async function interactionHandler(interaction, client) {
  try {
    // Handle message components (Buttons / Selects)
    if (interaction.isMessageComponent && interaction.isMessageComponent()) {
      const id = interaction.customId;

      // START: open role perms editor
      if (id === 'rolep:init') {
        const embed = new EmbedBuilder().setTitle('Role Permission Editor').setDescription('Choose action: Add / Remove / Reset / Show').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rolep:action:add').setLabel('Add').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rolep:action:remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('rolep:action:reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rolep:action:show').setLabel('Show').setStyle(ButtonStyle.Secondary)
        );
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }

      // Cancel button
      if (id === 'common:cancel') {
        await respondComponentByEditing(interaction, { content: 'Cancelled.', embeds: [], components: [] });
        return;
      }

      // All permissions button (marks payload as all)
      if (id.startsWith('perm:all:')) {
        const [, , payloadKey, context] = id.split(':');
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) {
          await respondComponentByEditing(interaction, { content: 'Payload expired or missing.', ephemeral: true });
          return;
        }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        payload.all = true;
        payload.context = context || payload.context || 'role';
        fs.writeFileSync(tmp, JSON.stringify(payload));
        await respondComponentByEditing(interaction, { content: 'All permissions selected. Click Preview to continue.' });
        return;
      }

      // Undo
      if (id.startsWith('undo:')) {
        const undoId = id.split(':')[1];
        const entry = consumeUndo(undoId);
        if (!entry) {
          await respondComponentByEditing(interaction, { content: 'Undo entry expired or invalid.', ephemeral: true });
          return;
        }
        try {
          await entry.applyUndoFn(entry.beforeState);
          await respondComponentByEditing(interaction, { content: 'Undo applied successfully.', ephemeral: true });
        } catch (err) {
          console.error('Undo failed', err);
          await respondComponentByEditing(interaction, { content: 'Undo failed: ' + (err.message || err), ephemeral: true });
        }
        return;
      }

      // role action -> ask to select a role
      if (id.startsWith('rolep:action:')) {
        const mode = id.split(':')[2];
        const embed = new EmbedBuilder().setTitle(`Select role — ${mode.toUpperCase()}`).setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`rolep:select:${mode}`).setPlaceholder('Select a role'));
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }

      // role preview: show before/after for role perms
      if (id.startsWith('rolep:preview:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) {
          await respondComponentByEditing(interaction, { content: 'Selections expired or missing. Re-run the editor.', ephemeral: true });
          return;
        }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const roleId = payload.roleId;
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          await respondComponentByEditing(interaction, { content: 'Role not found or was deleted.', ephemeral: true });
          return;
        }

        const mask = computeMaskFromPayload(payloadKey);
        let afterMask = BigInt(role.permissions.bitfield);
        if (payload.mode === 'add') afterMask = afterMask | mask;
        else if (payload.mode === 'remove') afterMask = afterMask & ~mask;
        else if (payload.mode === 'reset') afterMask = 0n;

        const beforeList = formatEnabledPerms(BigInt(role.permissions.bitfield), 'role');
        const afterList = formatEnabledPerms(afterMask, 'role');

        const embed = new EmbedBuilder()
          .setTitle(`Preview — ${payload.mode.toUpperCase()} — ${role.name}`)
          .addFields(
            { name: 'Before (enabled)', value: beforeList, inline: false },
            { name: 'After (enabled)', value: afterList, inline: false }
          )
          .setColor(role.color || 0x2b2d31)
          .setFooter({ text: '✅ = enabled (only enabled perms shown). Click Confirm to apply.' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`rolep:confirm:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }

      // role confirm: apply role permissions changes (with checks)
      if (id.startsWith('rolep:confirm:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) {
          await respondComponentByEditing(interaction, { content: 'Payload missing or expired.', ephemeral: true });
          return;
        }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const roleId = payload.roleId;
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          await respondComponentByEditing(interaction, { content: 'Role not found.', ephemeral: true });
          return;
        }

        // check bot can manage role
        const botCheck = botCanManageRole(interaction.guild, role);
        if (!botCheck.ok) {
          await respondComponentByEditing(interaction, { content: `Cannot apply role changes: ${botCheck.reason}`, ephemeral: true });
          return;
        }

        try {
          const before = BigInt(role.permissions.bitfield);
          const mask = computeMaskFromPayload(payloadKey);
          let newMask = before;
          if (payload.mode === 'add') newMask = before | mask;
          else if (payload.mode === 'remove') newMask = before & ~mask;
          else if (payload.mode === 'reset') newMask = 0n;

          await role.edit({ permissions: newMask, reason: 'Applied via role perms editor' });

          // store undo info
          const undoId = storeUndo(interaction.guild.id, { roleId: role.id, before: before.toString() }, async (beforeState) => {
            const r = await interaction.guild.roles.fetch(beforeState.roleId);
            if (r) await r.edit({ permissions: BigInt(beforeState.before) });
          }, 45);

          try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }

          const embed = new EmbedBuilder().setTitle('Permissions Updated').setDescription(`Applied changes to **${role.name}**`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          await respondComponentByEditing(interaction, { embeds: [embed], components: [undoRow] });
        } catch (err) {
          console.error('Failed to apply role edit', err);
          await respondComponentByEditing(interaction, { content: `Failed to apply role changes: ${err.message || err}`, ephemeral: true });
        }
        return;
      }

      // Channel permission preview and confirm handlers
      if (id.startsWith('chanp:preview:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) {
          await respondComponentByEditing(interaction, { content: 'Payload missing or expired.', ephemeral: true });
          return;
        }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const ch = await interaction.guild.channels.fetch(payload.channelId).catch(() => null);
        if (!ch) {
          await respondComponentByEditing(interaction, { content: 'Channel not found.', ephemeral: true });
          return;
        }

        const existing = ch.permissionOverwrites.cache.get(payload.targetId);
        const beforeAllow = BigInt(existing?.allow?.bitfield || existing?.allow || 0n);
        const beforeDeny = BigInt(existing?.deny?.bitfield || existing?.deny || 0n);
        const allow = BigInt(payload.allowMask || '0');
        const deny = BigInt(payload.denyMask || '0');

        const embed = new EmbedBuilder()
          .setTitle(`Preview — Channel Overwrite — ${ch.name}`)
          .addFields(
            { name: 'Before — Allowed (enabled)', value: formatEnabledPerms(beforeAllow, 'channel'), inline: false },
            { name: 'Before — Denied (enabled)', value: formatEnabledPerms(beforeDeny, 'channel'), inline: false },
            { name: 'After — Allowed (enabled)', value: formatEnabledPerms(allow, 'channel'), inline: false },
            { name: 'After — Denied (enabled)', value: formatEnabledPerms(deny, 'channel'), inline: false }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: '✅ = enabled (only enabled perms shown). Click Confirm to apply.' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:confirm:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }

      if (id.startsWith('chanp:confirm:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) {
          await respondComponentByEditing(interaction, { content: 'Payload missing or expired.', ephemeral: true });
          return;
        }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const ch = await interaction.guild.channels.fetch(payload.channelId).catch(() => null);
        if (!ch) {
          await respondComponentByEditing(interaction, { content: 'Channel not found.', ephemeral: true });
          return;
        }

        // check bot can manage channel
        const botCheck = botCanManageChannel(interaction.guild, ch);
        if (!botCheck.ok) {
          await respondComponentByEditing(interaction, { content: `Cannot apply channel overwrite: ${botCheck.reason}`, ephemeral: true });
          return;
        }

        try {
          const existing = ch.permissionOverwrites.cache.get(payload.targetId);
          const beforeAllow = BigInt(existing?.allow?.bitfield || existing?.allow || 0n);
          const beforeDeny = BigInt(existing?.deny?.bitfield || existing?.deny || 0n);
          const allow = BigInt(payload.allowMask || '0');
          const deny = BigInt(payload.denyMask || '0');

          await ch.permissionOverwrites.edit(payload.targetId, { allow, deny });

          const undoId = storeUndo(interaction.guild.id, { channelId: ch.id, targetId: payload.targetId, beforeAllow: beforeAllow.toString(), beforeDeny: beforeDeny.toString() }, async (beforeState) => {
            const c = await interaction.guild.channels.fetch(beforeState.channelId);
            if (!c) return;
            await c.permissionOverwrites.edit(beforeState.targetId, { allow: BigInt(beforeState.beforeAllow), deny: BigInt(beforeState.beforeDeny) });
          }, 45);

          try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }

          const embed = new EmbedBuilder().setTitle('Channel Overwrite Applied').setDescription(`Applied overwrite on <#${ch.id}>`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          await respondComponentByEditing(interaction, { embeds: [embed], components: [undoRow] });
        } catch (err) {
          console.error('Failed to apply channel overwrite', err);
          await respondComponentByEditing(interaction, { content: `Failed to apply channel overwrite: ${err.message || err}`, ephemeral: true });
        }
        return;
      }
    }

    // ROLE SELECT MENU handling
    if (interaction.isRoleSelectMenu && interaction.isRoleSelectMenu()) {
      const cid = interaction.customId;
      if (cid.startsWith('rolep:select:')) {
        const mode = cid.split(':')[2];
        const roleId = interaction.values[0];
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        const payload = { mode, roleId, selections: {}, context: 'role' };
        fs.writeFileSync(tmp, JSON.stringify(payload));

        const { rows, allBtnRow } = buildPermissionSelects(`rolep:sel:${mode}:${roleId}`, payloadKey, 'role');
        const previewRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rolep:preview:${payloadKey}`).setLabel('Preview').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        const embed = new EmbedBuilder().setTitle(`Select Permissions — ${mode.toUpperCase()}`).setDescription('Choose permissions across the lists (3). Use "All Permissions" to pick all. Then click Preview.').setColor(0x2b2d31);
        await respondComponentByEditing(interaction, { embeds: [embed], components: [allBtnRow, ...rows, previewRow] });
        return;
      }

      // channel perms role select (for channel overwrite)
      if (cid.startsWith('chanp:select_role:')) {
        const parts = cid.split(':');
        const action = parts[2];
        const channelId = parts[3];
        const roleId = interaction.values[0];
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        const payload = { channelId, targetId: roleId, action, selections: {}, context: 'channel' };
        fs.writeFileSync(tmp, JSON.stringify(payload));

        const { rows, allBtnRow } = buildPermissionSelects(`chanp:sel:${channelId}:${roleId}`, payloadKey, 'channel');
        const previewRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`chanp:preview:${payloadKey}`).setLabel('Preview').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        const embed = new EmbedBuilder().setTitle('Select channel permissions').setDescription('Choose permissions across the lists (3). Use "All Permissions" to pick all. Then Preview.').setColor(0x2b2d31);
        await respondComponentByEditing(interaction, { embeds: [embed], components: [allBtnRow, ...rows, previewRow] });
        return;
      }
    }

    // STRING SELECT MENUS (permission picks) - store selections
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      const cid = interaction.customId;
      const parts = cid.split(':');
      if (parts.length >= 3) {
        const part = parts[parts.length - 2]; // 'a'|'b'|'c'
        const payloadKey = parts[parts.length - 1];
        persistSelections(payloadKey, part, interaction.values);
        // ack then give a short feedback (we'll edit the message)
        await respondComponentByEditing(interaction, { embeds: [new EmbedBuilder().setTitle('Permissions Selected').setDescription(`Selected ${interaction.values.length} items in this list. Click Preview when ready.`).setColor(0x2b2d31)] , components: [] });
        return;
      }
    }

    // CHANNEL SELECT MENU (choose a channel)
    if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu()) {
      const cid = interaction.customId;
      if (cid === 'chanp:select_channel') {
        const channelId = interaction.values[0];
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) {
          await respondComponentByEditing(interaction, { content: 'Channel not found or removed.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder().setTitle(`Configure Channel: ${ch.name}`).setDescription('Choose action').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:action:addrole:${channelId}`).setLabel('Add Role Overwrite').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`chanp:action:addmember:${channelId}`).setLabel('Add Member Overwrite').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`chanp:action:view:${channelId}`).setLabel('View Overwrites').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`chanp:action:change:${channelId}`).setLabel('Change Channel').setStyle(ButtonStyle.Secondary)
        );
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }
    }

    // chanp action buttons (addrole/view/addmember/change)
    if (interaction.isMessageComponent && interaction.isMessageComponent()) {
      const id = interaction.customId;
      if (id.startsWith('chanp:action:')) {
        const parts = id.split(':');
        const action = parts[2];
        const channelId = parts[3];
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) { await respondComponentByEditing(interaction, { content: 'Channel not found', ephemeral: true }); return; }

        if (action === 'view') {
          const overwrites = ch.permissionOverwrites.cache.map(o => {
            const allow = new PermissionsBitField(BigInt(o.allow?.bitfield || o.allow || 0n)).toArray().join(', ') || '—';
            const deny = new PermissionsBitField(BigInt(o.deny?.bitfield || o.deny || 0n)).toArray().join(', ') || '—';
            return `**${o.id}**\nAllow: ${allow}\nDeny: ${deny}`;
          }).join('\n\n') || 'No overwrites';
          const embed = new EmbedBuilder().setTitle(`Overwrites — ${ch.name}`).setDescription(overwrites).setColor(0x2b2d31);
          await respondComponentByEditing(interaction, { embeds: [embed], components: [] });
          return;
        }

        if (action === 'addrole') {
          const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`chanp:select_role:addrole:${channelId}`).setPlaceholder('Select role to add overwrite'));
          const embed = new EmbedBuilder().setTitle('Select Role').setDescription('Choose role to modify channel overwrite').setColor(0x2b2d31);
          await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
          return;
        }

        if (action === 'addmember') {
          // placeholder until member-select support
          const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`chanp:select_role:addmember:${channelId}`).setPlaceholder('Select role for member overwrite (temporary)'));
          const embed = new EmbedBuilder().setTitle('Select Role (member soon)').setDescription('Choose a role to approximate member selection for now').setColor(0x2b2d31);
          await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
          return;
        }

        if (action === 'change') {
          const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('chanp:select_channel').setPlaceholder('Select another channel'));
          const embed = new EmbedBuilder().setTitle('Select Channel').setDescription('Choose another channel to configure').setColor(0x2b2d31);
          await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
          return;
        }
      }
    }

  } catch (err) {
    // If anything unexpected happens, try to reply gracefully (for commands) or log for components
    console.error('interaction handler unexpected error:', err && err.stack ? err.stack : err);
    try {
      if (interaction && interaction.isMessageComponent && interaction.isMessageComponent()) {
        // best-effort - edit message to show an error
        await respondComponentByEditing(interaction, { content: 'Internal handler error — check logs.', ephemeral: true }).catch(() => null);
      } else if (interaction) {
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal handler error', ephemeral: true });
        else await interaction.followUp({ content: 'Internal handler error', ephemeral: true });
      }
    } catch (e) { console.error('error while attempting to report internal handler error', e); }
  }
};
