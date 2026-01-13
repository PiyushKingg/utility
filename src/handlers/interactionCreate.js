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

const { PERM_SELECT_A, PERM_SELECT_B, nameToFlag, PERM_DEFS, ALL_FLAGS } = require('../lib/permissions');
const { storeUndo, consumeUndo } = require('../lib/undoCache');
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// helper to respond/update safely
async function safeRespond(interaction, payload) {
  try {
    if (interaction.update) {
      try { return await interaction.update(payload); } catch (e) {}
    }
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) {
    console.error('safeRespond error:', err);
    try { if (!interaction.replied) await interaction.followUp({ content: 'Failed to respond; interaction may have expired.', ephemeral: true }); } catch {}
  }
}

// build simple select options list (no emojis)
function buildSelectOptionsFrom(defs) {
  return defs.map(d => ({ label: d.label, value: d.key }));
}

function buildTwoPermissionSelects(customBase, payloadKey) {
  const selA = new StringSelectMenuBuilder()
    .setCustomId(`${customBase}:a:${payloadKey}`)
    .setPlaceholder('Permissions (1/2)')
    .addOptions(buildSelectOptionsFrom(PERM_SELECT_A))
    .setMinValues(0)
    .setMaxValues(Math.min(25, PERM_SELECT_A.length));

  const selB = new StringSelectMenuBuilder()
    .setCustomId(`${customBase}:b:${payloadKey}`)
    .setPlaceholder('Permissions (2/2)')
    .addOptions(buildSelectOptionsFrom(PERM_SELECT_B))
    .setMinValues(0)
    .setMaxValues(Math.min(25, PERM_SELECT_B.length));

  return [
    new ActionRowBuilder().addComponents(selA),
    new ActionRowBuilder().addComponents(selB)
  ];
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
  const selA = data.selections?.a || [];
  const selB = data.selections?.b || [];
  if (selA.includes('ALL') || selB.includes('ALL')) return ALL_FLAGS;
  let mask = 0n;
  for (const k of [...selA, ...selB]) mask |= nameToFlag(k);
  return mask;
}

// helper: format enabled permissions (only show enabled ones, each prefixed with ✅)
function formatEnabledPerms(mask) {
  const lines = [];
  for (const d of PERM_DEFS) {
    const flag = nameToFlag(d.key);
    if (flag && (BigInt(flag) & BigInt(mask)) !== 0n) {
      lines.push(`✅ ${d.label}`);
    }
  }
  return lines.length ? lines.join('\n') : '—';
}

module.exports = async function interactionHandler(interaction, client) {
  try {
    if (interaction.isButton && interaction.isButton()) {
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

      if (id.startsWith('rolep:action:')) {
        const mode = id.split(':')[2];
        const embed = new EmbedBuilder().setTitle(`Select role — ${mode.toUpperCase()}`).setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`rolep:select:${mode}`).setPlaceholder('Select a role'));
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }

      if (id.startsWith('rolep:preview:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) return await safeRespond(interaction, { content: 'No selections found. Select permissions first.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const role = await interaction.guild.roles.fetch(payload.roleId).catch(() => null);
        if (!role) return await safeRespond(interaction, { content: 'Role not found.', ephemeral: true });

        const mask = computeMaskFromPayload(payloadKey);
        let afterMask = BigInt(role.permissions.bitfield);
        if (payload.mode === 'add') afterMask = afterMask | mask;
        else if (payload.mode === 'remove') afterMask = afterMask & ~mask;
        else if (payload.mode === 'reset') afterMask = 0n;

        const beforeList = formatEnabledPerms(BigInt(role.permissions.bitfield));
        const afterList = formatEnabledPerms(afterMask);

        const embed = new EmbedBuilder()
          .setTitle(`Preview — ${payload.mode.toUpperCase()} — ${role.name}`)
          .addFields(
            { name: 'Before (enabled)', value: beforeList, inline: false },
            { name: 'After (enabled)', value: afterList, inline: false }
          )
          .setColor(role.color || 0x2b2d31)
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

      // Channel preview/confirm handling
      if (id.startsWith('chanp:preview:')) {
        const payloadKey = id.split(':')[2];
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmp)) return await safeRespond(interaction, { content: 'No data found.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmp, 'utf8'));
        const ch = await interaction.guild.channels.fetch(payload.channelId).catch(() => null);
        if (!ch) return await safeRespond(interaction, { content: 'Channel not found.', ephemeral: true });

        const before = ch.permissionOverwrites.cache.get(payload.targetId);
        const beforeAllow = BigInt(before?.allow?.bitfield || before?.allow || 0n);
        const beforeDeny = BigInt(before?.deny?.bitfield || before?.deny || 0n);
        const allow = BigInt(payload.allowMask || '0');
        const deny = BigInt(payload.denyMask || '0');

        const beforeAllowList = formatEnabledPerms(beforeAllow);
        const beforeDenyList = formatEnabledPerms(beforeDeny); // show enabled denies if any (rare)
        const afterAllowList = formatEnabledPerms(allow);
        const afterDenyList = formatEnabledPerms(deny);

        const embed = new EmbedBuilder()
          .setTitle(`Preview — Channel Overwrite — ${ch.name}`)
          .addFields(
            { name: 'Before — Allowed (enabled)', value: beforeAllowList, inline: false },
            { name: 'Before — Denied (enabled)', value: beforeDenyList, inline: false },
            { name: 'After — Allowed (enabled)', value: afterAllowList, inline: false },
            { name: 'After — Denied (enabled)', value: afterDenyList, inline: false }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: '✅ = enabled (only enabled perms shown). Click Confirm to apply.' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:confirm:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
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

    // ROLE SELECT
    if (interaction.isRoleSelectMenu && interaction.isRoleSelectMenu()) {
      const cid = interaction.customId;
      if (cid.startsWith('rolep:select:')) {
        const mode = cid.split(':')[2];
        const roleId = interaction.values[0];
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        const payload = { mode, roleId, selections: {} };
        fs.writeFileSync(tmp, JSON.stringify(payload));
        const selects = buildTwoPermissionSelects(`rolep:sel:${mode}:${roleId}`, payloadKey);
        const previewRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rolep:preview:${payloadKey}`).setLabel('Preview').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        const embed = new EmbedBuilder().setTitle(`Select Permissions — ${mode.toUpperCase()}`).setDescription('Choose permissions across both lists, then click Preview').setColor(0x2b2d31);
        return await safeRespond(interaction, { embeds: [embed], components: [...selects, previewRow] });
      }

      if (cid.startsWith('chanp:select_role:')) {
        const parts = cid.split(':');
        const action = parts[2];
        const channelId = parts[3];
        const roleId = interaction.values[0];
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        const tmp = path.join(DATA_DIR, `${payloadKey}.json`);
        const payload = { channelId, targetId: roleId, action, selections: {} };
        fs.writeFileSync(tmp, JSON.stringify(payload));
        const selects = buildTwoPermissionSelects(`chanp:sel:${channelId}:${roleId}`, payloadKey);
        const previewRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`chanp:preview:${payloadKey}`).setLabel('Preview').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        const embed = new EmbedBuilder().setTitle('Select channel permissions').setDescription('Choose permissions across both lists, then Preview').setColor(0x2b2d31);
        return await safeRespond(interaction, { embeds: [embed], components: [...selects, previewRow] });
      }
    }

    // STRING SELECTS
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      const cid = interaction.customId;
      const parts = cid.split(':');
      if (parts.length >= 3) {
        const part = parts[parts.length - 2]; // 'a' or 'b'
        const payloadKey = parts[parts.length - 1];
        persistSelections(payloadKey, part, interaction.values);
        const total = (interaction.values || []).length;
        const embed = new EmbedBuilder().setTitle('Permissions Selected').setDescription(`Selected ${total} items in this list. Click Preview when ready.`).setColor(0x2b2d31);
        return await safeRespond(interaction, { embeds: [embed], components: [] });
      }
    }

    // CHANNEL SELECT
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

    // chanp action buttons handled above inside button handler (addrole/view/etc.)

  } catch (err) {
    console.error('interaction handler error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal handler error', ephemeral: true });
      else await interaction.followUp({ content: 'Internal handler error', ephemeral: true });
    } catch {}
  }
};
