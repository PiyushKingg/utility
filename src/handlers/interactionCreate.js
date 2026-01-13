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

// Safe responder (defensive; avoids double-ack problems)
async function safeRespond(interaction, payload) {
  try {
    if (interaction.isMessageComponent && interaction.isMessageComponent()) {
      if (!interaction.deferred && !interaction.replied) {
        try { return await interaction.update(payload); } catch (e) {}
      }
      if (interaction.deferred) {
        try { return await interaction.editReply(payload); } catch (e) {}
      }
      if (interaction.replied) {
        try { return await interaction.followUp(payload); } catch (e) {}
      }
      try { return await interaction.reply(payload); } catch (e) {}
    } else {
      if (!interaction.deferred && !interaction.replied) {
        try { return await interaction.reply(payload); } catch (e) {}
      }
      if (interaction.deferred) {
        try { return await interaction.editReply(payload); } catch (e) {}
      }
      if (interaction.replied) {
        try { return await interaction.followUp(payload); } catch (e) {}
      }
    }
  } catch (err) {
    try {
      if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
      return await interaction.followUp(payload);
    } catch (err2) {
      console.error('safeRespond final fallback failed:', err, err2);
    }
  }
  console.warn('safeRespond: could not deliver response (interaction may be expired).');
  return null;
}

// Build select options (no emojis in labels)
function buildOptions(arr) {
  return arr.map(p => ({ label: p.label, value: p.key }));
}

// Build permission selects for a specific context (role/channel)
// returns array of ActionRowBuilders (3 rows), and a top-row that contains the "All" button
function buildPermissionSelects(customBase, payloadKey, context = 'role') {
  const parts = partsForContext(context); // [partA, partB, partC]
  const rows = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const idPart = ['a', 'b', 'c'][i];
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`${customBase}:${idPart}:${payloadKey}`)
      .setPlaceholder(`Permissions (${i + 1}/3)`)
      .addOptions(buildOptions(part))
      .setMinValues(0)
      .setMaxValues(Math.min(25, part.length)); // safe cap
    rows.push(new ActionRowBuilder().addComponents(menu));
  }
  // All-permissions button
  const allBtnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`perm:all:${payloadKey}:${context}`).setLabel('All Permissions').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
  return { rows, allBtnRow };
}

// Persist selection part (a|b|c)
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

// Compute mask from payloadKey using stored selections; respects context (role/channel)
function computeMaskFromPayload(payloadKey) {
  const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
  if (!fs.existsSync(tmp)) return 0n;
  const data = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const context = data.context || 'role';
  const selA = data.selections?.a || [];
  const selB = data.selections?.b || [];
  const selC = data.selections?.c || [];
  // if 'ALL' chosen
  if (selA.includes('ALL') || selB.includes('ALL') || selC.includes('ALL') || data.all === true) {
    return allFlagsForContext(context);
  }
  let mask = 0n;
  for (const k of [...selA, ...selB, ...selC]) {
    mask |= nameToFlag(k, context);
  }
  return mask;
}

// Format enabled perms (only show enabled ones with ✅), based on context
function formatEnabledPerms(mask, context = 'role') {
  const perms = permsForContext(context);
  const lines = [];
  for (const p of perms) {
    const f = nameToFlag(p.key, context);
    if (f && (BigInt(f) & BigInt(mask)) !== 0n) lines.push(`✅ ${p.label}`);
  }
  return lines.length ? lines.join('\n') : '—';
}

module.exports = async function interactionHandler(interaction, client) {
  try {
    // Buttons
    if (interaction.isMessageComponent && interaction.isMessageComponent()) {
      const id = interaction.customId;

      if (id === 'rolep:init') {
        const embed = new EmbedBuilder().setTitle('Role Permission Editor').setDescription('Choose action: Add / Remove / Reset / Show').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rolep:action:add').setLabel('Add').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rolep:action:remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('rolep:action:reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rolep:action:show').setLabel('Show').setStyle(ButtonStyle.Secondary)
        );
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }

      if (id === 'common:cancel') {
        return await safeRespond(interaction, { content: 'Cancelled.', embeds: [], components: [] });
      }

      // All permissions button pressed -> sets payload all=true
      if (id.startsWith('perm:all:')) {
        // perm:all:<payloadKey>:<context>
        const parts = id.split(':');
        const payloadKey = parts[2];
        const context = parts[3] || 'role';
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) return await safeRespond(interaction, { content: 'Payload expired.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        payload.all = true;
        payload.context = context;
        fs.writeFileSync(tmp, JSON.stringify(payload));
        return await safeRespond(interaction, { content: 'All permissions selected. Click Preview.', ephemeral: true });
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

      // role action -> ask role select
      if (id.startsWith('rolep:action:')) {
        const mode = id.split(':')[2];
        const embed = new EmbedBuilder().setTitle(`Select role — ${mode.toUpperCase()}`).setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`rolep:select:${mode}`).setPlaceholder('Select a role'));
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }

      // preview/confirm/chan preview/confirm handlers (unchanged logic, but uses context-aware mask)
      if (id.startsWith('rolep:preview:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) return await safeRespond(interaction, { content: 'No selections found. Select permissions first.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const role = await interaction.guild.roles.fetch(payload.roleId).catch(() => null);
        if (!role) return await safeRespond(interaction, { content: 'Role not found.', ephemeral: true });

        const context = 'role';
        const mask = computeMaskFromPayload(payloadKey);
        let afterMask = BigInt(role.permissions.bitfield);
        if (payload.mode === 'add') afterMask = afterMask | mask;
        else if (payload.mode === 'remove') afterMask = afterMask & ~mask;
        else if (payload.mode === 'reset') afterMask = 0n;

        const beforeList = formatEnabledPerms(BigInt(role.permissions.bitfield), context);
        const afterList = formatEnabledPerms(afterMask, context);

        const embed = new EmbedBuilder()
          .setTitle(`Preview — ${payload.mode.toUpperCase()} — ${role.name}`)
          .addFields(
            { name: 'Before (enabled)', value: beforeList, inline: false },
            { name: 'After (enabled)', value: afterList, inline: false }
          ).setColor(role.color || 0x2b2d31)
          .setFooter({ text: '✅ = enabled (only enabled perms shown). Click Confirm to apply. Undo available.' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`rolep:confirm:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }

      if (id.startsWith('rolep:confirm:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) return await safeRespond(interaction, { content: 'Missing payload.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const role = await interaction.guild.roles.fetch(payload.roleId).catch(() => null);
        if (!role) return await safeRespond(interaction, { content: 'Role not found.', ephemeral: true });
        try {
          const before = BigInt(role.permissions.bitfield);
          const mask = computeMaskFromPayload(payloadKey);
          let newMask = before;
          if (payload.mode === 'add') newMask = before | mask;
          else if (payload.mode === 'remove') newMask = before & ~mask;
          else if (payload.mode === 'reset') newMask = 0n;
          await role.edit({ permissions: newMask });

          const undoId = storeUndo(interaction.guild.id, { roleId: role.id, before: before.toString() }, async (beforeState) => {
            const r = await interaction.guild.roles.fetch(beforeState.roleId);
            if (r) await r.edit({ permissions: BigInt(beforeState.before) });
          }, 45);

          try { fs.unlinkSync(tmp); } catch {}
          const embed = new EmbedBuilder().setTitle('Permissions Updated').setDescription(`Applied changes to ${role.name}`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          return await safeRespond(interaction, { embeds: [embed], components: [undoRow] });
        } catch (err) {
          return await safeRespond(interaction, { content: 'Failed to apply: ' + (err.message || err), ephemeral: true });
        }
      }

      // Channel preview/confirm
      if (id.startsWith('chanp:preview:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) return await safeRespond(interaction, { content: 'No data found.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const ch = await interaction.guild.channels.fetch(payload.channelId).catch(() => null);
        if (!ch) return await safeRespond(interaction, { content: 'Channel not found.', ephemeral: true });

        const context = 'channel';
        const existing = ch.permissionOverwrites.cache.get(payload.targetId);
        const beforeAllow = BigInt(existing?.allow?.bitfield || existing?.allow || 0n);
        const beforeDeny = BigInt(existing?.deny?.bitfield || existing?.deny || 0n);
        const allow = BigInt(payload.allowMask || '0');
        const deny = BigInt(payload.denyMask || '0');

        const embed = new EmbedBuilder().setTitle(`Preview — Channel Overwrite — ${ch.name}`)
          .addFields(
            { name: 'Before — Allowed (enabled)', value: formatEnabledPerms(beforeAllow, context), inline: false },
            { name: 'Before — Denied (enabled)', value: formatEnabledPerms(beforeDeny, context), inline: false },
            { name: 'After — Allowed (enabled)', value: formatEnabledPerms(allow, context), inline: false },
            { name: 'After — Denied (enabled)', value: formatEnabledPerms(deny, context), inline: false }
          ).setColor(0x2b2d31)
          .setFooter({ text: '✅ = enabled (only enabled perms shown). Click Confirm to apply.' });

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`chanp:confirm:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }

      if (id.startsWith('chanp:confirm:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) return await safeRespond(interaction, { content: 'Missing payload', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const ch = await interaction.guild.channels.fetch(payload.channelId).catch(() => null);
        if (!ch) return await safeRespond(interaction, { content: 'Channel not found', ephemeral: true });
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

          try { fs.unlinkSync(tmp); } catch {}
          const embed = new EmbedBuilder().setTitle('Channel Overwrite Applied').setDescription(`Applied overwrite on <#${ch.id}>`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          return await safeRespond(interaction, { embeds: [embed], components: [undoRow] });
        } catch (err) {
          return await safeRespond(interaction, { content: 'Failed to apply channel overwrite: ' + (err.message || err), ephemeral: true });
        }
      }
    }

    // Role select menu chosen -> start permission selects (role context)
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
        return await safeRespond(interaction, { embeds: [embed], components: [allBtnRow, ...rows, previewRow] });
      }

      // channel perms role select (when adding role overwrite)
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
        return await safeRespond(interaction, { embeds: [embed], components: [allBtnRow, ...rows, previewRow] });
      }
    }

    // String select menus (permissions) — store selections for part a|b|c
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      const cid = interaction.customId;
      const parts = cid.split(':');
      // format: <base>:<part>:<payloadKey> where part is a/b/c
      if (parts.length >= 3) {
        const part = parts[parts.length - 2]; // 'a' or 'b' or 'c'
        const payloadKey = parts[parts.length - 1];
        persistSelections(payloadKey, part, interaction.values);
        const total = (interaction.values || []).length;
        const embed = new EmbedBuilder().setTitle('Permissions Selected').setDescription(`Selected ${total} items in this list. Click Preview when ready.`).setColor(0x2b2d31);
        return await safeRespond(interaction, { embeds: [embed], components: [] });
      }
    }

    // Channel select menu (choose channel)
    if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu()) {
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
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }
    }

    // chanp action button handling (view/addrole/addmember/change)
    if (interaction.isMessageComponent && interaction.isMessageComponent()) {
      const id = interaction.customId;
      if (id.startsWith('chanp:action:')) {
        const parts = id.split(':');
        const action = parts[2];
        const channelId = parts[3];
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return await safeRespond(interaction, { content: 'Channel not found', ephemeral: true });
        if (action === 'view') {
          const overwrites = ch.permissionOverwrites.cache.map(o => {
            const allow = new PermissionsBitField(BigInt(o.allow?.bitfield || o.allow || 0n)).toArray().join(', ') || '—';
            const deny = new PermissionsBitField(BigInt(o.deny?.bitfield || o.deny || 0n)).toArray().join(', ') || '—';
            return `**${o.id}**\nAllow: ${allow}\nDeny: ${deny}`;
          }).join('\n\n') || 'No overwrites';
          const embed = new EmbedBuilder().setTitle(`Overwrites — ${ch.name}`).setDescription(overwrites).setColor(0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [] });
        }
        if (action === 'addrole') {
          const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`chanp:select_role:addrole:${channelId}`).setPlaceholder('Select role to add overwrite'));
          const embed = new EmbedBuilder().setTitle('Select Role').setDescription('Choose role to modify channel overwrite').setColor(0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [row] });
        }
        if (action === 'addmember') {
          const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`chanp:select_role:addmember:${channelId}`).setPlaceholder('Select role (member support later)'));
          const embed = new EmbedBuilder().setTitle('Select Role (member soon)').setDescription('Choose role to modify channel overwrite for now').setColor(0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [row] });
        }
        if (action === 'change') {
          const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('chanp:select_channel').setPlaceholder('Select another channel'));
          const embed = new EmbedBuilder().setTitle('Select Channel').setDescription('Choose another channel to configure').setColor(0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [row] });
        }
      }
    }

  } catch (err) {
    console.error('interaction handler error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal handler error', ephemeral: true });
      else await interaction.followUp({ content: 'Internal handler error', ephemeral: true });
    } catch {}
  }
};
