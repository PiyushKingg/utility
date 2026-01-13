// src/handlers/interactionCreate.js
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

const { nameToFlag, permsForContext, partsForContext, allFlagsForContext } = require('../lib/permissions');
const { storeUndo, consumeUndo } = require('../lib/undoCache');
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- SAFE component response flow ---
// Defer update, then edit the original message. If edit fails, fallback to sending a minimal message in channel.
async function respondComponentByEditing(interaction, responsePayload) {
  try {
    await interaction.deferUpdate().catch(() => null);
    if (interaction.message) {
      // edit original message (Discord will error on invalid components or duplicated IDs)
      await interaction.message.edit(responsePayload);
      return true;
    }
    if (interaction.channel) {
      // fallback: send minimal (embeds/content only)
      const fallback = {};
      if (responsePayload.embeds) fallback.embeds = responsePayload.embeds;
      if (responsePayload.content) fallback.content = responsePayload.content;
      await interaction.channel.send(fallback);
      return true;
    }
  } catch (err) {
    console.error('respondComponentByEditing failed', err?.message || err);
    return false;
  }
  return false;
}

// --- helper to build select options from perms parts ---
function buildOptions(arr) {
  return arr.map(p => ({ label: p.label, value: p.key }));
}

// Build selects (2 or more if needed)
function buildPermissionSelectRows(prefix, payloadKey, context = 'role') {
  const parts = partsForContext(context); // returns array of arrays (each <=25)
  const rows = [];
  for (let i = 0; i < parts.length; i++) {
    const idx = i + 1;
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`${prefix}:sel:${idx}:${payloadKey}`)
      .setPlaceholder(`Permissions (${idx}/${parts.length})`)
      .addOptions(buildOptions(parts[i]))
      .setMinValues(0)
      .setMaxValues(Math.min(25, parts[i].length));
    rows.push(new ActionRowBuilder().addComponents(menu));
  }
  return rows; // array of ActionRowBuilder
}

function persistSelections(payloadKey, selIndex, values) {
  const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
  let data = {};
  if (fs.existsSync(tmp)) {
    try { data = JSON.parse(fs.readFileSync(tmp, 'utf8')); } catch {}
  }
  data.selections = data.selections || {};
  data.selections[selIndex] = values;
  fs.writeFileSync(tmp, JSON.stringify(data));
}

function computeMaskFromPayload(payloadKey) {
  const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
  if (!fs.existsSync(tmp)) return 0n;
  const data = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const context = data.context || 'role';
  if (data.all === true) return allFlagsForContext(context);
  const selections = data.selections || {};
  let mask = 0n;
  for (const kIdx of Object.keys(selections)) {
    for (const key of (selections[kIdx] || [])) mask |= nameToFlag(key, context);
  }
  return mask;
}

function formatSelectedList(payloadKey, context = 'role') {
  const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
  if (!fs.existsSync(tmp)) return 'None selected';
  const data = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const sel = data.selections || {};
  const items = [];
  for (const idx of Object.keys(sel).sort()) {
    for (const key of sel[idx]) {
      // look up label
      const perms = permsForContext(context);
      const found = perms.find(p => p.key === key);
      if (found) items.push(found.label);
    }
  }
  if (data.all) return 'All Permissions';
  return items.length ? items.map(x => `• ${x}`).join('\n') : 'None selected';
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

// bot checks
function botCanManageRole(guild, role) {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: 'Cannot fetch bot member.' };
  if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles) && !me.permissions.has(PermissionsBitField.Flags.Administrator)) return { ok: false, reason: 'Bot missing Manage Roles/Administrator.' };
  const botRole = me.roles.highest;
  if (!botRole) return { ok: false, reason: 'Bot has no roles.' };
  if (botRole.position <= role.position) return { ok: false, reason: `Bot role position (${botRole.position}) is not higher than target role (${role.position}).` };
  return { ok: true };
}
function botCanManageChannel(guild, channel) {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: 'Cannot fetch bot member.' };
  if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels) && !me.permissions.has(PermissionsBitField.Flags.Administrator)) return { ok: false, reason: 'Bot missing Manage Channels/Administrator.' };
  return { ok: true };
}

module.exports = async function interactionHandler(interaction, client) {
  try {
    if (interaction.isMessageComponent() && interaction.isMessageComponent()) {
      const id = interaction.customId;

      // Start role editor
      if (id === 'rolep:init') {
        const embed = new EmbedBuilder().setTitle('Role Permission Editor').setDescription('Choose Add / Remove / Reset / Show').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rolep:action:add').setLabel('Add').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rolep:action:remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('rolep:action:reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rolep:action:show').setLabel('Show').setStyle(ButtonStyle.Secondary)
        );
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }

      // Cancel (unique per payload) handled below in preview rows (so not duplicated globally)

      // All permissions (marks payload all)
      if (id.startsWith('perm:all:')) {
        const parts = id.split(':');
        const payloadKey = parts[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) { await respondComponentByEditing(interaction, { content: 'Payload expired/missing.' }); return; }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        payload.all = true;
        fs.writeFileSync(tmp, JSON.stringify(payload));
        // update message listing selected perms
        const listText = formatSelectedList(payloadKey, payload.context || 'role');
        const embed = new EmbedBuilder().setTitle('Selected Permissions').setDescription(listText).setColor(0x2b2d31);
        const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rolep:preview:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`common:cancel:${payloadKey}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        await respondComponentByEditing(interaction, { embeds: [embed], components: [confirmRow] });
        return;
      }

      // Undo
      if (id.startsWith('undo:')) {
        const undoId = id.split(':')[1];
        const entry = consumeUndo(undoId);
        if (!entry) { await respondComponentByEditing(interaction, { content: 'Undo expired or invalid.' }); return; }
        try { await entry.applyUndoFn(entry.beforeState); await respondComponentByEditing(interaction, { content: 'Undo applied.' }); } catch (err) { console.error('undo failed', err); await respondComponentByEditing(interaction, { content: 'Undo failed.' }); }
        return;
      }

      // Role action -> show role select
      if (id.startsWith('rolep:action:')) {
        const mode = id.split(':')[2];
        const embed = new EmbedBuilder().setTitle(`Select role — ${mode.toUpperCase()}`).setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`rolep:select:${mode}`).setPlaceholder('Select a role'));
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }

      // Preview (initial Confirm) -> show preview (before/after)
      if (id.startsWith('rolep:preview:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) { await respondComponentByEditing(interaction, { content: 'Payload missing.' }); return; }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const role = await interaction.guild.roles.fetch(payload.roleId).catch(() => null);
        if (!role) { await respondComponentByEditing(interaction, { content: 'Role not found.' }); return; }

        // compute masks
        const beforeMask = BigInt(role.permissions.bitfield);
        const mask = computeMaskFromPayload(payloadKey);
        let afterMask = beforeMask;
        if (payload.mode === 'add') afterMask = beforeMask | mask;
        else if (payload.mode === 'remove') afterMask = beforeMask & ~mask;
        else if (payload.mode === 'reset') afterMask = 0n;

        const embed = new EmbedBuilder()
          .setTitle(`Preview — ${payload.mode.toUpperCase()} — ${role.name}`)
          .addFields(
            { name: 'Before (enabled)', value: formatEnabledPerms(beforeMask, 'role'), inline: false },
            { name: 'After (enabled)', value: formatEnabledPerms(afterMask, 'role'), inline: false }
          ).setColor(role.color || 0x2b2d31);

        // Actual Confirm to apply (second confirm)
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`rolep:confirm:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`common:cancel:${payloadKey}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }

      // Apply confirm
      if (id.startsWith('rolep:confirm:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) { await respondComponentByEditing(interaction, { content: 'Payload missing.' }); return; }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const role = await interaction.guild.roles.fetch(payload.roleId).catch(() => null);
        if (!role) { await respondComponentByEditing(interaction, { content: 'Role not found.' }); return; }

        const botCheck = botCanManageRole(interaction.guild, role);
        if (!botCheck.ok) { await respondComponentByEditing(interaction, { content: `Cannot apply: ${botCheck.reason}` }); return; }

        try {
          const before = BigInt(role.permissions.bitfield);
          const mask = computeMaskFromPayload(payloadKey);
          let newMask = before;
          if (payload.mode === 'add') newMask = before | mask;
          else if (payload.mode === 'remove') newMask = before & ~mask;
          else if (payload.mode === 'reset') newMask = 0n;

          await role.edit({ permissions: newMask, reason: 'Applied via role editor' });

          const undoId = storeUndo(interaction.guild.id, { roleId: role.id, before: before.toString() }, async (beforeState) => {
            const r = await interaction.guild.roles.fetch(beforeState.roleId);
            if (r) await r.edit({ permissions: BigInt(beforeState.before) });
          }, 45);

          try { fs.unlinkSync(tmp); } catch (e) { }

          const embed = new EmbedBuilder().setTitle('Success').setDescription(`Updated role **${role.name}**`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          await respondComponentByEditing(interaction, { embeds: [embed], components: [undoRow] });
        } catch (err) {
          console.error('apply role error', err);
          await respondComponentByEditing(interaction, { content: 'Failed to apply role change: ' + (err.message || err) });
        }
        return;
      }

      // Channel preview & confirm follow same patterns: IDs start with chanp:...
      if (id.startsWith('chanp:preview:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) { await respondComponentByEditing(interaction, { content: 'Payload missing.' }); return; }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const ch = await interaction.guild.channels.fetch(payload.channelId).catch(() => null);
        if (!ch) { await respondComponentByEditing(interaction, { content: 'Channel not found.' }); return; }

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
          ).setColor(0x2b2d31);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:confirm:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`common:cancel:${payloadKey}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
        return;
      }

      if (id.startsWith('chanp:confirm:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) { await respondComponentByEditing(interaction, { content: 'Payload missing.' }); return; }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const ch = await interaction.guild.channels.fetch(payload.channelId).catch(() => null);
        if (!ch) { await respondComponentByEditing(interaction, { content: 'Channel not found.' }); return; }

        const botCheck = botCanManageChannel(interaction.guild, ch);
        if (!botCheck.ok) { await respondComponentByEditing(interaction, { content: `Cannot apply: ${botCheck.reason}` }); return; }

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

          try { fs.unlinkSync(tmp); } catch (e) { }

          const embed = new EmbedBuilder().setTitle('Success').setDescription(`Applied overwrite in <#${ch.id}>`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          await respondComponentByEditing(interaction, { embeds: [embed], components: [undoRow] });
        } catch (err) {
          console.error('apply channel error', err);
          await respondComponentByEditing(interaction, { content: 'Failed to apply channel overwrite: ' + (err.message || err) });
        }
        return;
      }
    }

    // Role select (user chose role) => show permission selects (2 or more), show current selections live.
    if (interaction.isRoleSelectMenu && interaction.isRoleSelectMenu()) {
      const cid = interaction.customId;
      if (cid.startsWith('rolep:select:')) {
        const mode = cid.split(':')[2];
        const roleId = interaction.values[0];
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        const payload = { mode, roleId, selections: {}, context: 'role' };
        fs.writeFileSync(tmp, JSON.stringify(payload));

        const rows = buildPermissionSelectRows(`rolep:${mode}:${roleId}`, payloadKey, 'role');
        // Add All Permissions button and a Confirm (initial) + Cancel in preview row
        const allRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`perm:all:${payloadKey}:role`).setLabel('All Permissions').setStyle(ButtonStyle.Secondary));
        const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rolep:preview:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`common:cancel:${payloadKey}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        const embed = new EmbedBuilder().setTitle(`Permissions — ${mode.toUpperCase()}`).setDescription('Select permissions from the lists below. Your selections will update the message. When ready click Confirm to preview.').setColor(0x2b2d31);
        await respondComponentByEditing(interaction, { embeds: [embed], components: [allRow, ...rows, confirmRow] });
        return;
      }

      // Channel perms role select (for add role overwrite)
      if (cid.startsWith('chanp:select_role:')) {
        const parts = cid.split(':');
        const action = parts[2];
        const channelId = parts[3];
        const roleId = interaction.values[0];
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        const payload = { channelId, targetId: roleId, action, selections: {}, context: 'channel' };
        fs.writeFileSync(tmp, JSON.stringify(payload));

        const rows = buildPermissionSelectRows(`chanp:${channelId}:${roleId}`, payloadKey, 'channel');
        const allRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`perm:all:${payloadKey}:channel`).setLabel('All Permissions').setStyle(ButtonStyle.Secondary));
        const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`chanp:preview:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`common:cancel:${payloadKey}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        const embed = new EmbedBuilder().setTitle('Channel Permissions').setDescription('Select permissions and click Confirm to preview.').setColor(0x2b2d31);
        await respondComponentByEditing(interaction, { embeds: [embed], components: [allRow, ...rows, confirmRow] });
        return;
      }
    }

    // Permission selects (string select) — update selected list live
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      const cid = interaction.customId;
      // format: <prefix>:sel:<index>:<payloadKey>
      const parts = cid.split(':');
      if (parts.length >= 4 && parts[1] === 'sel') {
        const selIndex = parts[2]; // '1','2',...
        const payloadKey = parts[3];
        persistSelections(payloadKey, selIndex, interaction.values);
        // Build selected list and edit message to show current selections
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) {
          await respondComponentByEditing(interaction, { content: 'Payload expired/missing.' });
          return;
        }
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const listText = formatSelectedList(payloadKey, payload.context || 'role');
        const embed = new EmbedBuilder().setTitle('Selected Permissions').setDescription(listText).setColor(0x2b2d31);
        const previewRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rolep:preview:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`common:cancel:${payloadKey}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        await respondComponentByEditing(interaction, { embeds: [embed], components: [previewRow] });
        return;
      }
    }

    // Channel select menu (choose channel to edit)
    if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu()) {
      const cid = interaction.customId;
      if (cid === 'chanp:select_channel') {
        const channelId = interaction.values[0];
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) { await respondComponentByEditing(interaction, { content: 'Channel not found.' }); return; }
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

    // chanp action handlers (addrole/view/etc.)
    if (interaction.isMessageComponent() && interaction.isMessageComponent()) {
      const id = interaction.customId;
      if (id.startsWith('chanp:action:')) {
        const parts = id.split(':');
        const action = parts[2];
        const channelId = parts[3];
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) { await respondComponentByEditing(interaction, { content: 'Channel not found.' }); return; }

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
          const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`chanp:select_role:addrole:${channelId}`).setPlaceholder('Select role'));
          const embed = new EmbedBuilder().setTitle('Select Role').setDescription('Pick role to create an overwrite for this channel').setColor(0x2b2d31);
          await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
          return;
        }

        if (action === 'addmember') {
          const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`chanp:select_role:addmember:${channelId}`).setPlaceholder('Select role (member support later)'));
          const embed = new EmbedBuilder().setTitle('Select Role (member soon)').setDescription('Temporary role select; member selection will be added later').setColor(0x2b2d31);
          await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
          return;
        }

        if (action === 'change') {
          const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('chanp:select_channel').setPlaceholder('Select another channel'));
          const embed = new EmbedBuilder().setTitle('Select Channel').setDescription('Choose another channel').setColor(0x2b2d31);
          await respondComponentByEditing(interaction, { embeds: [embed], components: [row] });
          return;
        }
      }
    }
  } catch (err) {
    console.error('interaction handler error', err && err.stack ? err.stack : err);
    try {
      if (interaction && interaction.isMessageComponent && interaction.isMessageComponent()) {
        await respondComponentByEditing(interaction, { content: 'Internal error (see logs).' }).catch(() => null);
      } else if (interaction && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Internal error', ephemeral: true }).catch(() => null);
      } else {
        await interaction.followUp({ content: 'Internal error', ephemeral: true }).catch(() => null);
      }
    } catch (e) { console.error('failed to report internal error', e); }
  }
};
