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

const { PERM_OPTIONS_FULL, getPermPage, nameToFlag, ALL_FLAGS } = require('../lib/permissions');
const { storeUndo, consumeUndo } = require('../lib/undoCache');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Helper: safe respond/update
async function safeRespond(interaction, payload) {
  try {
    if (typeof interaction.update === 'function' && (interaction.isButton?.() || interaction.isStringSelectMenu?.() || interaction.isRoleSelectMenu?.() || interaction.isChannelSelectMenu?.())) {
      try { return await interaction.update(payload); } catch {}
    }
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) {
    console.error('safeRespond failed:', err && err.message ? err.message : err);
    try { if (!interaction.replied) await interaction.followUp({ content: 'Failed to respond (interaction may have expired).', ephemeral: true }); } catch {}
  }
}

// Build a paginated select menu for permissions (pageIndex = 0..)
function buildPermSelectPaginated(customIdBase, pageIndex = 0) {
  const pageSize = 23; // reserve 1 for ALL and 1 for MORE if needed
  const { options, hasMore } = getPermPage(pageIndex, pageSize);
  const opts = [];

  // Add "All Permissions" as first choice
  opts.push({ label: 'All Permissions', value: 'ALL' });

  // Add page options
  for (const o of options) {
    opts.push({ label: o.label, value: o.value });
  }

  if (hasMore) {
    opts.push({ label: 'More permissions →', value: `__MORE__:${pageIndex + 1}` });
  }
  if (pageIndex > 0) {
    opts.push({ label: '← Back', value: `__MORE__:${pageIndex - 1}` });
  }

  return new StringSelectMenuBuilder()
    .setCustomId(`${customIdBase}:${pageIndex}`)
    .setPlaceholder('Select permissions (you can multi-select)')
    .addOptions(opts)
    .setMinValues(1)
    .setMaxValues(Math.min(25, opts.length));
}

function parseSelectCustomId(customId) {
  // customId format: base:page
  const parts = customId.split(':');
  const page = Number(parts[parts.length - 1]);
  const base = parts.slice(0, -1).join(':');
  return { base, page };
}

module.exports = async function interactionHandler(interaction, client) {
  try {
    // BUTTONS
    if (interaction.isButton?.()) {
      const id = interaction.customId;

      // ----- Role perms initial open -----
      if (id === 'rolep:init') {
        const embed = new EmbedBuilder().setTitle('Role Permission Editor').setDescription('Select an action: Add / Remove / Reset / Show').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rolep:action:add').setLabel('Add').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('rolep:action:remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('rolep:action:reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rolep:action:show').setLabel('Show').setStyle(ButtonStyle.Secondary)
        );
        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }

      // cancel
      if (id === 'common:cancel') {
        return await safeRespond(interaction, { content: 'Cancelled.', embeds: [], components: [] });
      }

      // undo
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

      // role actions -> show role select
      if (id.startsWith('rolep:action:')) {
        const mode = id.split(':')[2]; // add/remove/reset/show
        const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`rolep:select:${mode}`).setPlaceholder('Select role'));
        const embed = new EmbedBuilder().setTitle(`Choose role — ${mode.toUpperCase()}`).setColor(0x2b2d31);
        return await safeRespond(interaction, { embeds: [embed], components: [row], content: null });
      }

      // role confirm (customId: rolep:confirm:<mode>:<payloadKey>)
      if (id.startsWith('rolep:confirm:')) {
        const [, , mode, payloadKey] = id.split(':');
        const tmpPath = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmpPath)) return await safeRespond(interaction, { content: 'Pending data missing.', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
        try {
          const role = await interaction.guild.roles.fetch(payload.roleId);
          if (!role) throw new Error('Role not found');
          const before = BigInt(role.permissions.bitfield);
          let newMask = before;
          if (payload.mode === 'add') newMask = before | BigInt(payload.addMaskStr || '0');
          if (payload.mode === 'remove') newMask = before & ~BigInt(payload.removeMaskStr || '0');
          if (payload.mode === 'reset') newMask = BigInt(payload.resetMaskStr || '0');
          await role.edit({ permissions: newMask });

          // store undo
          const undoId = storeUndo(interaction.guild.id, { roleId: role.id, before: before.toString() }, async (beforeState) => {
            const r = await interaction.guild.roles.fetch(beforeState.roleId || beforeState.roleId);
            if (r) await r.edit({ permissions: BigInt(beforeState.before) });
          }, 45);

          try { fs.unlinkSync(tmpPath); } catch {}
          const embed = new EmbedBuilder().setTitle('Permissions Updated').setDescription(`Applied ${payload.mode} for role ${role.name}`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          return await safeRespond(interaction, { embeds: [embed], components: [undoRow], content: null });
        } catch (err) {
          return await safeRespond(interaction, { content: 'Failed to apply: ' + (err.message || err), ephemeral: true });
        }
      }

      // channel actions confirm handled similarly (chanp:confirm:payloadKey)
      if (id.startsWith('chanp:confirm:')) {
        // chanp:confirm:<payloadKey>
        const [, , payloadKey] = id.split(':');
        const tmpPath = path.join(DATA_DIR, `${payloadKey}.json`);
        if (!fs.existsSync(tmpPath)) return await safeRespond(interaction, { content: 'Pending data missing', ephemeral: true });
        const payload = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
        try {
          const ch = await interaction.guild.channels.fetch(payload.channelId);
          if (!ch) throw new Error('Channel not found');
          // before overwrite
          const existing = ch.permissionOverwrites.cache.get(payload.targetId);
          const beforeAllow = BigInt(existing?.allow?.bitfield || existing?.allow || 0n);
          const beforeDeny = BigInt(existing?.deny?.bitfield || existing?.deny || 0n);

          // apply
          const allow = BigInt(payload.allowMask || '0');
          const deny = BigInt(payload.denyMask || '0');

          await ch.permissionOverwrites.edit(payload.targetId, { allow, deny });

          // store undo: restore prior allow/deny
          const undoId = storeUndo(interaction.guild.id, { channelId: ch.id, targetId: payload.targetId, beforeAllow: beforeAllow.toString(), beforeDeny: beforeDeny.toString() }, async (beforeState) => {
            const c = await interaction.guild.channels.fetch(beforeState.channelId);
            if (!c) return;
            await c.permissionOverwrites.edit(beforeState.targetId, { allow: BigInt(beforeState.beforeAllow), deny: BigInt(beforeState.beforeDeny) });
          }, 45);

          try { fs.unlinkSync(tmpPath); } catch {}
          const embed = new EmbedBuilder().setTitle('Channel Overwrite Applied').setDescription(`Applied overwrite on <#${payload.channelId}>`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          return await safeRespond(interaction, { embeds: [embed], components: [undoRow], content: null });
        } catch (err) {
          return await safeRespond(interaction, { content: 'Failed to apply overwrite: ' + (err.message || err), ephemeral: true });
        }
      }
    }

    // ROLE SELECT MENU handling
    if (interaction.isRoleSelectMenu?.()) {
      const cid = interaction.customId;
      if (!cid.startsWith('rolep:select:')) return;
      const mode = cid.split(':')[2];
      const roleId = interaction.values[0];
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!role) return await safeRespond(interaction, { content: 'Role not found', ephemeral: true });

      if (mode === 'show') {
        const perms = role.permissions.toArray();
        const embed = new EmbedBuilder().setTitle(`Permissions — ${role.name}`).setDescription(perms.length ? perms.join(', ') : 'No permissions').setColor(role.color || 0x2b2d31);
        return await safeRespond(interaction, { embeds: [embed], components: [] });
      }

      if (mode === 'reset') {
        const before = role.permissions.toArray();
        const after = [];
        const embed = new EmbedBuilder().setTitle(`Preview — Reset ${role.name}`).addFields({ name: 'Before', value: before.length ? before.join(', ') : '—' }, { name: 'After', value: 'No permissions' }).setColor(role.color || 0x2b2d31);
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        const payload = { mode: 'reset', roleId, resetMaskStr: '0' };
        fs.writeFileSync(path.join(DATA_DIR, `${payloadKey}.json`), JSON.stringify(payload));
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rolep:confirm:reset:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }

      // mode add/remove -> show paginated permission select (page 0)
      const select = buildPermSelectPaginated(`rolep:perms:${mode}:${roleId}`, 0);
      const row = new ActionRowBuilder().addComponents(select);
      const embed = new EmbedBuilder().setTitle(`${mode === 'add' ? 'Add' : 'Remove'} Permissions — ${role.name}`).setColor(role.color || 0x2b2d31);
      return await safeRespond(interaction, { embeds: [embed], components: [row] });
    }

    // STRING SELECT handling (permissions)
    if (interaction.isStringSelectMenu?.()) {
      const cid = interaction.customId;
      // Parse base and page
      const { base, page } = parseSelectCustomId(cid);
      // rolep flow: base = rolep:perms:<mode>:<roleId>
      if (base.startsWith('rolep:perms:')) {
        const parts = base.split(':');
        const mode = parts[2];
        const roleId = parts[3];
        // If user selected a MORE option (value starts with __MORE__), handle paging
        if (interaction.values.some(v => v.startsWith('__MORE__:'))) {
          const val = interaction.values.find(v => v.startsWith('__MORE__:'));
          const nextPage = Number(val.split(':')[1]);
          const select = buildPermSelectPaginated(`rolep:perms:${mode}:${roleId}`, nextPage);
          const row = new ActionRowBuilder().addComponents(select);
          const embed = new EmbedBuilder().setTitle('More permissions').setColor(0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [row] });
        }

        // If ALL selected
        let addMask = 0n;
        let removeMask = 0n;
        if (interaction.values.includes('ALL')) {
          // ALL -> apply ALL_FLAGS
          if (mode === 'add') addMask = ALL_FLAGS;
          else removeMask = ALL_FLAGS;
        } else {
          for (const v of interaction.values) {
            const flag = nameToFlag(v);
            if (mode === 'add') addMask |= BigInt(flag);
            else removeMask |= BigInt(flag);
          }
        }

        // Build preview embed
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) return await safeRespond(interaction, { content: 'Role not found', ephemeral: true });
        const beforeArr = role.permissions.toArray();
        let afterMask = BigInt(role.permissions.bitfield);
        if (mode === 'add') afterMask = afterMask | addMask;
        else afterMask = afterMask & ~removeMask;
        const afterPF = new PermissionsBitField(afterMask);
        const afterArr = afterPF.toArray();

        const embed = new EmbedBuilder().setTitle(`Preview — ${mode === 'add' ? 'Add' : 'Remove'} for ${role.name}`).addFields({ name: 'Before', value: beforeArr.length ? beforeArr.join(', ') : '—' }, { name: 'After', value: afterArr.length ? afterArr.join(', ') : '—' }).setColor(role.color || 0x2b2d31);
        // persist payload
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        const payload = { mode, roleId, addMaskStr: addMask.toString(), removeMaskStr: removeMask.toString() };
        fs.writeFileSync(path.join(DATA_DIR, `${payloadKey}.json`), JSON.stringify(payload));
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rolep:confirm:${mode}:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }

      // channel perms flow: base = chanp:perms:<action>:<channelId>:<targetId>
      if (base.startsWith('chanp:perms:')) {
        // customId was built as chanp:perms:<action>:<channelId>:<targetId>
        const parts = base.split(':');
        const action = parts[2];
        const channelId = parts[3];
        const targetId = parts[4];
        // paging support
        if (interaction.values.some(v => v.startsWith('__MORE__:'))) {
          const val = interaction.values.find(v => v.startsWith('__MORE__:'));
          const nextPage = Number(val.split(':')[1]);
          const select = buildPermSelectPaginated(base, nextPage);
          const row = new ActionRowBuilder().addComponents(select);
          const embed = new EmbedBuilder().setTitle('More permissions').setColor(0x2b2d31);
          return await safeRespond(interaction, { embeds: [embed], components: [row] });
        }

        // compute mask
        let mask = 0n;
        if (interaction.values.includes('ALL')) mask = ALL_FLAGS;
        else {
          for (const v of interaction.values) mask |= BigInt(nameToFlag(v));
        }

        // Ask for mode: Allow / Deny / Clear
        const embed = new EmbedBuilder().setTitle('Choose Mode').setDescription('Allow / Deny / Clear for the selected permissions').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:mode:allow:${channelId}:${targetId}:${mask}`).setLabel('Allow').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`chanp:mode:deny:${channelId}:${targetId}:${mask}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`chanp:mode:clear:${channelId}:${targetId}:${mask}`).setLabel('Clear').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }
    }

    // CHANNEL SELECT MENU handling (starter)
    if (interaction.isChannelSelectMenu?.()) {
      const cid = interaction.customId;
      if (cid !== 'chanp:select_channel') return;
      const channelId = interaction.values[0];
      const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!ch) return await safeRespond(interaction, { content: 'Channel not found', ephemeral: true });
      const embed = new EmbedBuilder().setTitle(`Configure ${ch.name}`).setColor(0x2b2d31);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`chanp:action:addrole:${channelId}`).setLabel('Add Role Overwrite').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`chanp:action:addmember:${channelId}`).setLabel('Add Member Overwrite').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`chanp:action:view:${channelId}`).setLabel('View Overwrites').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`chanp:action:change:${channelId}`).setLabel('Change Channel').setStyle(ButtonStyle.Secondary)
      );
      return await safeRespond(interaction, { embeds: [embed], components: [row] });
    }

    // ROLE SELECT for channel perms (selecting role to apply to channel)
    if (interaction.isRoleSelectMenu?.()) {
      // customId format: chanp:select_role:<action>:<channelId>
      const cid = interaction.customId;
      if (!cid.startsWith('chanp:select_role:')) return;
      const parts = cid.split(':');
      const action = parts[2];
      const channelId = parts[3];
      const roleId = interaction.values[0];
      // show paginated perm select
      const base = `chanp:perms:${action}:${channelId}:${roleId}`;
      const select = buildPermSelectPaginated(base, 0);
      const row = new ActionRowBuilder().addComponents(select);
      const embed = new EmbedBuilder().setTitle('Select permissions to modify for this role on the channel').setColor(0x2b2d31);
      return await safeRespond(interaction, { embeds: [embed], components: [row] });
    }

    // BUTTONS for chanp mode allow/deny/clear
    if (interaction.isButton?.()) {
      const id = interaction.customId;
      if (id.startsWith('chanp:mode:')) {
        // chanp:mode:<mode>:<channelId>:<targetId>:<mask>
        const [, , mode, channelId, targetId, maskStr] = id.split(':');
        const mask = BigInt(maskStr || '0');
        const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return await safeRespond(interaction, { content: 'Channel not found', ephemeral: true });

        // Determine existing allow/deny
        const existing = ch.permissionOverwrites.cache.get(targetId);
        const currentAllow = BigInt(existing?.allow?.bitfield || existing?.allow || 0n);
        const currentDeny = BigInt(existing?.deny?.bitfield || existing?.deny || 0n);
        let newAllow = currentAllow;
        let newDeny = currentDeny;

        if (mode === 'allow') {
          newDeny = newDeny & ~mask;
          newAllow = newAllow | mask;
        } else if (mode === 'deny') {
          newAllow = newAllow & ~mask;
          newDeny = newDeny | mask;
        } else if (mode === 'clear') {
          newAllow = newAllow & ~mask;
          newDeny = newDeny & ~mask;
        }

        const beforeAllowArr = new PermissionsBitField(currentAllow).toArray();
        const beforeDenyArr = new PermissionsBitField(currentDeny).toArray();
        const afterAllowArr = new PermissionsBitField(newAllow).toArray();
        const afterDenyArr = new PermissionsBitField(newDeny).toArray();

        const embed = new EmbedBuilder().setTitle(`Preview — ${mode.toUpperCase()} on ${ch.name}`).addFields(
          { name: 'Before — Allow', value: beforeAllowArr.length ? beforeAllowArr.join(', ') : '—', inline: false },
          { name: 'Before — Deny', value: beforeDenyArr.length ? beforeDenyArr.join(', ') : '—', inline: false },
          { name: 'After — Allow', value: afterAllowArr.length ? afterAllowArr.join(', ') : '—', inline: false },
          { name: 'After — Deny', value: afterDenyArr.length ? afterDenyArr.join(', ') : '—', inline: false },
        ).setColor(0x2b2d31).setFooter({ text: 'Confirm to apply. Undo available shortly.' });

        // persist the payload
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        const payload = { channelId, targetId, allowMask: newAllow.toString(), denyMask: newDeny.toString() };
        fs.writeFileSync(path.join(DATA_DIR, `${payloadKey}.json`), JSON.stringify(payload));

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`chanp:confirm:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        return await safeRespond(interaction, { embeds: [embed], components: [row] });
      }
    }

  } catch (err) {
    console.error('interactionHandler error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal handler error', ephemeral: true });
      else await interaction.followUp({ content: 'Internal handler error', ephemeral: true });
    } catch {}
  }
};
