// src/handlers/interactionCreate.js
const { ButtonStyle, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { storeUndo, consumeUndo } = require('../lib/undoCache');

function safeReply(interaction, payload = {}) {
  return (async () => {
    try {
      if (!interaction.replied && !interaction.deferred) return await interaction.reply(payload);
      if (interaction.deferred) return await interaction.editReply(payload);
      return await interaction.followUp(payload);
    } catch (err) {
      try { if (!interaction.replied) return await interaction.reply({ content: 'Failed to respond.', ephemeral: true }); } catch {}
    }
  })();
}

module.exports = async function interactionHandler(interaction, client, ctx = {}) {
  // command handling
  if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return await safeReply(interaction, { content: 'Command not found.', ephemeral: true });
    try {
      await cmd.execute(interaction, client, ctx);
    } catch (err) {
      console.error(`Command ${interaction.commandName} execution failed`, err);
      try {
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'An internal error occurred.', ephemeral: true });
        else await interaction.followUp({ content: 'An internal error occurred.', ephemeral: true });
      } catch (e) {}
    }
    return;
  }

  // button/component handling (confirm/cancel/undo)
  if (interaction.isButton && interaction.isButton()) {
    const id = interaction.customId;
    // confirm: format confirm:action:payloadfile
    if (id.startsWith('confirm:')) {
      const parts = id.split(':'); // confirm:action:payloadPath
      const payloadKey = parts[2];
      const file = path.join(__dirname, '..', '..', 'data', payloadKey + '.json');
      if (!fs.existsSync(file)) return safeReply(interaction, { content: 'Action expired or missing.', ephemeral: true });
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      try {
        // Only two built-in actions supported: delete-role, delete-channel
        if (data.action === 'delete-role') {
          const guild = interaction.guild;
          const role = await guild.roles.fetch(data.roleId).catch(() => null);
          if (!role) return safeReply(interaction, { content: 'Role not found.', ephemeral: true });
          const beforePermissions = role.permissions.bitfield;
          const beforeRole = { id: role.id, name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable };
          const undoId = storeUndo(guild.id, { type: 'role-delete', before: beforeRole }, async (beforeState) => {
            // recreating role exactly is tricky; make a new role as "undo"
            await guild.roles.create({ name: beforeState.before.name, color: beforeState.before.color, hoist: beforeState.before.hoist, mentionable: beforeState.before.mentionable, reason: 'Undo role delete' });
          }, 45);
          await role.delete(`Deleted via utility bot by ${interaction.user.tag}`);
          fs.unlinkSync(file);
          const embed = new EmbedBuilder().setTitle('Role Deleted').setDescription(`Deleted **${beforeRole.name}**`).setColor(0x00AA00);
          await safeReply(interaction, { embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: ButtonStyle.Secondary, label: 'Undo', custom_id: `undo:${undoId}` }] }] });
          return;
        }
        if (data.action === 'delete-channel') {
          const guild = interaction.guild;
          const ch = await guild.channels.fetch(data.channelId).catch(() => null);
          if (!ch) return safeReply(interaction, { content: 'Channel not found.', ephemeral: true });
          // save minimal state for undo (can't restore messages)
          const before = { name: ch.name, type: ch.type, topic: ch.topic };
          const undoId = storeUndo(guild.id, { type: 'channel-delete', before }, async (beforeState) => {
            await guild.channels.create({ name: beforeState.before.name, type: beforeState.before.type, topic: beforeState.before.topic, reason: 'Undo channel delete' });
          }, 45);
          await ch.delete(`Deleted via utility bot by ${interaction.user.tag}`);
          fs.unlinkSync(file);
          const embed = new EmbedBuilder().setTitle('Channel Deleted').setDescription(`Deleted **${before.name}**`).setColor(0x00AA00);
          await safeReply(interaction, { embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: ButtonStyle.Secondary, label: 'Undo', custom_id: `undo:${undoId}` }] }] });
          return;
        }
      } catch (err) {
        console.error('confirm action failed', err);
        return safeReply(interaction, { content: 'Failed to perform action.', ephemeral: true });
      }
    }

    // cancel: delete payload file if present
    if (id.startsWith('cancel:')) {
      const parts = id.split(':');
      const payloadKey = parts[1];
      const file = path.join(__dirname, '..', '..', 'data', payloadKey + '.json');
      try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
      return safeReply(interaction, { content: 'Cancelled.', ephemeral: true });
    }

    // undo
    if (id.startsWith('undo:')) {
      const undoId = id.split(':')[1];
      const entry = consumeUndo(undoId);
      if (!entry) return safeReply(interaction, { content: 'Undo expired or invalid.', ephemeral: true });
      try {
        await entry.applyUndoFn(entry.beforeState);
        return safeReply(interaction, { content: 'Undo applied.', ephemeral: true });
      } catch (err) {
        console.error('undo failed', err);
        return safeReply(interaction, { content: 'Undo failed.', ephemeral: true });
      }
    }
  }
};
