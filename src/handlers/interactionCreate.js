// src/handlers/interactionCreate.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { PERM_OPTIONS, nameToFlag } = require('../lib/permissions');
const { storeUndo, consumeUndo } = require('../lib/undoCache');
const path = require('path');
const fs = require('fs');

// Build a permission select (max 25 options)
function buildPermSelect(customId) {
  const opts = PERM_OPTIONS.slice(0, 25).map(o => ({ label: o.label, value: o.value }));
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Select permissions')
    .addOptions(opts)
    .setMinValues(1)
    .setMaxValues(Math.min(25, opts.length));
}

async function safeUpdateOrReply(interaction, payload) {
  try {
    if (interaction.deferred) {
      return await interaction.editReply(payload);
    }
    if (interaction.replied) {
      return await interaction.followUp(payload);
    }
    // For updates (component interactions), prefer update()
    if (interaction.update) {
      try { return await interaction.update(payload); } catch {}
    }
    return await interaction.reply(payload);
  } catch (err) {
    console.error('safeUpdateOrReply failed:', err && err.message ? err.message : err);
    try { if (!interaction.replied) await interaction.followUp({ content: 'Failed to respond (interaction may have expired).', ephemeral: true }); } catch {}
  }
}

module.exports = async function interactionHandler(interaction, client) {
  // Chat input commands are handled in index.js; this handles components/modals
  try {
    // BUTTONS
    if (interaction.isButton && interaction.isButton()) {
      const id = interaction.customId;

      // Initial role perms open
      if (id === 'rolep:init') {
        const embed = new EmbedBuilder().setTitle('Role Permissions').setDescription('Choose an action:').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rolep:add').setLabel('Add').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('rolep:remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('rolep:reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rolep:show').setLabel('Show').setStyle(ButtonStyle.Secondary)
        );
        await safeUpdateOrReply(interaction, { embeds: [embed], components: [row], content: null });
        return;
      }

      // Cancel
      if (id === 'common:cancel') {
        await safeUpdateOrReply(interaction, { content: 'Cancelled.', embeds: [], components: [] });
        return;
      }

      // Undo
      if (id.startsWith('undo:')) {
        const aid = id.split(':')[1];
        const data = consumeUndo(aid);
        if (!data) {
          await safeUpdateOrReply(interaction, { content: 'Undo expired or invalid.', ephemeral: true });
          return;
        }
        try {
          await data.applyUndoFn(data.beforeState);
          await safeUpdateOrReply(interaction, { content: 'Undo applied.', ephemeral: true });
        } catch (err) {
          await safeUpdateOrReply(interaction, { content: 'Undo failed: ' + (err.message || err), ephemeral: true });
        }
        return;
      }

      // Confirm role perms (customId: rolep:confirm:<mode>:<roleId>:<payloadKey>)
      if (id.startsWith('rolep:confirm:')) {
        const parts = id.split(':');
        const mode = parts[2];
        const roleId = parts[3];
        const payloadKey = parts[4];
        const dataDir = path.join(__dirname, '..', '..', 'data');
        const tmpPath = path.join(dataDir, `${payloadKey}.json`);
        if (!fs.existsSync(tmpPath)) {
          await safeUpdateOrReply(interaction, { content: 'Pending data missing.', embeds: [], components: [] });
          return;
        }
        const payload = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
        try {
          const role = await interaction.guild.roles.fetch(roleId);
          if (!role) throw new Error('Role not found');
          const before = BigInt(role.permissions.bitfield);
          let newMask = before;
          if (payload.mode === 'add') newMask = before | BigInt(payload.addMask);
          else if (payload.mode === 'remove') newMask = before & ~BigInt(payload.removeMask);
          await role.edit({ permissions: newMask });
          // store undo
          const undoId = storeUndo(interaction.guild.id, { roleId, before: before.toString() }, async (beforeState) => {
            const r = await interaction.guild.roles.fetch(roleId);
            if (r) await r.edit({ permissions: BigInt(beforeState.before) || BigInt(beforeState) });
          }, 45);
          const successEmbed = new EmbedBuilder().setTitle('Permissions Updated').setDescription(`Permissions ${payload.mode === 'add' ? 'added' : 'removed'} for ${role.name}`).setColor(0x00AA00);
          const undoRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`undo:${undoId}`).setLabel('Undo').setStyle(ButtonStyle.Secondary));
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          await safeUpdateOrReply(interaction, { embeds: [successEmbed], components: [undoRow], content: null });
        } catch (err) {
          await safeUpdateOrReply(interaction, { content: 'Failed to apply: ' + (err.message || err), embeds: [], components: [] });
        }
        return;
      }
    }

    // ROLE SELECT
    if (interaction.isRoleSelectMenu && interaction.isRoleSelectMenu()) {
      const cid = interaction.customId;
      if (cid.startsWith('rolep:select:')) {
        const mode = cid.split(':')[2];
        const roleId = interaction.values[0];
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) return safeUpdateOrReply(interaction, { content: 'Role not found.', embeds: [], components: [] });
        if (mode === 'show') {
          const before = role.permissions.toArray();
          const embed = new EmbedBuilder().setTitle(`Permissions: ${role.name}`).addFields({ name: 'Permissions', value: before.length ? before.join(', ') : '—' }).setColor(role.color || 0x2b2d31);
          await safeUpdateOrReply(interaction, { embeds: [embed], components: [] });
          return;
        }
        const select = buildPermSelect(`rolep:perms:${mode}:${roleId}`);
        const row = new ActionRowBuilder().addComponents(select);
        const embed = new EmbedBuilder().setTitle(`${mode === 'add' ? 'Add' : 'Remove'} Permissions — ${role.name}`).setDescription('Choose permissions then confirm preview.').setColor(role.color || 0x2b2d31);
        await safeUpdateOrReply(interaction, { embeds: [embed], components: [row] });
        return;
      }
    }

    // STRING SELECT (permission choices)
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      const cid = interaction.customId;
      if (cid.startsWith('rolep:perms:')) {
        const [, , mode, roleId] = cid.split(':');
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) return safeUpdateOrReply(interaction, { content: 'Role not found.', embeds: [], components: [] });

        let addMask = 0n;
        let removeMask = 0n;
        for (const sel of interaction.values) {
          const flag = BigInt(nameToFlag(sel) || 0n);
          if (mode === 'add') addMask |= flag;
          else removeMask |= flag;
        }

        const beforeArr = role.permissions.toArray();
        let afterMask = BigInt(role.permissions.bitfield);
        if (mode === 'add') afterMask = afterMask | addMask;
        else afterMask = afterMask & ~removeMask;

        const { PermissionsBitField } = require('discord.js');
        const afterPF = new PermissionsBitField(afterMask);
        const afterArr = afterPF.toArray();

        const embed = new EmbedBuilder()
          .setTitle(`Preview — ${mode === 'add' ? 'Add' : 'Remove'} Permissions for ${role.name}`)
          .addFields(
            { name: 'Before', value: beforeArr.length ? beforeArr.join(', ') : '—', inline: false },
            { name: 'After', value: afterArr.length ? afterArr.join(', ') : '—', inline: false }
          )
          .setColor(role.color || 0x2b2d31)
          .setFooter({ text: 'Confirm to apply. Undo will be available briefly.' });

        const payload = { mode, roleId, addMask: addMask.toString(), removeMask: removeMask.toString() };
        const payloadKey = `payload-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        const dataDir = path.join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, `${payloadKey}.json`), JSON.stringify(payload));

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`rolep:confirm:${mode}:${roleId}:${payloadKey}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('common:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        await safeUpdateOrReply(interaction, { embeds: [embed], components: [confirmRow], content: null });
        return;
      }
    }

    // CHANNEL SELECT (starter)
    if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu()) {
      const cid = interaction.customId;
      if (cid === 'chanp:select_channel') {
        const channelId = interaction.values[0];
        const ch = interaction.guild.channels.cache.get(channelId);
        if (!ch) return safeUpdateOrReply(interaction, { content: 'Channel not found.', embeds: [], components: [] });

        const embed = new EmbedBuilder().setTitle(`Configure ${ch.name}`).setDescription('Choose an action:').setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`chanp:addrole:${channelId}`).setLabel('Add Role').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`chanp:addmember:${channelId}`).setLabel('Add Member').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`chanp:view:${channelId}`).setLabel('View Overwrites').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`chanp:change:${channelId}`).setLabel('Change Channel').setStyle(ButtonStyle.Secondary)
        );
        await safeUpdateOrReply(interaction, { embeds: [embed], components: [row], content: null });
        return;
      }
    }

    // MODAL SUBMIT (create channel modal)
    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      const mid = interaction.customId;
      if (mid === 'create:text:modal') {
        const name = interaction.fields.getTextInputValue('name_input').trim().toLowerCase().replace(/\s+/g,'-').slice(0,100);
        const topic = interaction.fields.getTextInputValue('topic_input').slice(0,1024);
        try {
          const ch = await interaction.guild.channels.create({ name, type: 0, topic });
          const embed = new EmbedBuilder().setTitle('Channel Created').setDescription(`Created text channel ${ch}`).setColor(0x00AA00);
          // if deferred, edit reply; if not, reply
          if (interaction.deferred) await interaction.editReply({ embeds: [embed] });
          else await interaction.reply({ embeds: [embed] });
        } catch (err) {
          try { await interaction.reply({ content: 'Failed to create channel: ' + (err.message || err), ephemeral: true }); } catch {}
        }
        return;
      }
    }

    // fallback: ignore
  } catch (err) {
    console.error('Interaction handler error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal handler error', ephemeral: true });
      else await interaction.followUp({ content: 'Internal handler error', ephemeral: true });
    } catch {}
  }
};
