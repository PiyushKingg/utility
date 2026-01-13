// src/commands/channel.js
const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder().setName('channel').setDescription('Channel utilities')
    .addSubcommand(s => s.setName('create').setDescription('Create a channel').addStringOption(o => o.setName('name').setRequired(true)).addStringOption(o => o.setName('type').setDescription('text/voice/stage/forum').setRequired(false)).addStringOption(o => o.setName('topic').setDescription('Topic (text/forum)')))
    .addSubcommand(s => s.setName('info').setDescription('Channel info').addChannelOption(o => o.setName('channel').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a channel').addChannelOption(o => o.setName('channel').setRequired(true)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a channel').addChannelOption(o => o.setName('channel').setRequired(true)).addStringOption(o => o.setName('name')).addStringOption(o => o.setName('topic')).addBooleanOption(o => o.setName('nsfw'))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'create') {
        if (!interaction.memberPermissions.has('ManageChannels')) return interaction.reply({ content: 'You need Manage Channels permission.', ephemeral: true });
        const name = interaction.options.getString('name', true);
        const typeStr = (interaction.options.getString('type') || 'text').toLowerCase();
        const topic = interaction.options.getString('topic') || undefined;
        let type = ChannelType.GuildText;
        if (typeStr === 'voice') type = ChannelType.GuildVoice;
        else if (typeStr === 'stage') type = ChannelType.GuildStageVoice;
        else if (typeStr === 'forum') type = ChannelType.GuildForum;

        const created = await interaction.guild.channels.create({ name, type, topic, reason: `Created by ${interaction.user.tag}` });
        const embed = new EmbedBuilder().setTitle('Channel Created').setDescription(`<#${created.id}>`).setColor(0x00AA00);
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === 'info') {
        const channel = interaction.options.getChannel('channel', true);
        const ch = await interaction.guild.channels.fetch(channel.id).catch(() => null);
        if (!ch) return interaction.reply({ content: 'Channel not found.', ephemeral: true });
        const embed = new EmbedBuilder()
          .setTitle(`Channel — ${ch.name}`)
          .addFields(
            { name: 'ID', value: ch.id, inline: true },
            { name: 'Type', value: String(ch.type), inline: true },
            { name: 'Position', value: String(ch.position ?? '—'), inline: true },
            { name: 'Topic', value: ch.topic ?? '—', inline: false }
          ).setColor(0x2b2d31);
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === 'delete') {
        const ch = interaction.options.getChannel('channel', true);
        if (!interaction.memberPermissions.has('ManageChannels')) return interaction.reply({ content: 'You need Manage Channels permission.', ephemeral: true });

        const payloadKey = `delch-${Date.now()}`;
        const dir = path.join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${payloadKey}.json`), JSON.stringify({ action: 'delete-channel', channelId: ch.id }));

        const embed = new EmbedBuilder().setTitle('Confirm Channel Delete').setDescription(`Delete channel <#${ch.id}>? This will remove the channel.`).setColor(0xff5500);
        const row = { type: 1, components: [
          { type: 2, style: 4, label: 'Confirm', custom_id: `confirm:delete-channel:${payloadKey}` },
          { type: 2, style: 2, label: 'Cancel', custom_id: `cancel:${payloadKey}` }
        ]};
        return interaction.reply({ embeds: [embed], components: [row] });
      }

      if (sub === 'edit') {
        const ch = interaction.options.getChannel('channel', true);
        if (!interaction.memberPermissions.has('ManageChannels')) return interaction.reply({ content: 'You need Manage Channels permission.', ephemeral: true });
        const name = interaction.options.getString('name');
        const topic = interaction.options.getString('topic');
        const nsfw = interaction.options.getBoolean('nsfw');

        const updates = {};
        if (name) updates.name = name;
        if (typeof topic === 'string') updates.topic = topic;
        if (typeof nsfw === 'boolean') updates.nsfw = nsfw;

        await interaction.guild.channels.edit(ch.id, updates, `Edited by ${interaction.user.tag}`).catch(async () => {
          // fallback: fetch and edit channel object
          const channelObj = await interaction.guild.channels.fetch(ch.id).catch(() => null);
          if (channelObj) await channelObj.edit(updates, `Edited by ${interaction.user.tag}`);
        });

        return interaction.reply({ content: `Channel ${ch.name} updated.`, ephemeral: false });
      }
    } catch (err) {
      console.error('channel command failed', err);
      try { return interaction.reply({ content: 'Internal error running channel command.', ephemeral: true }); } catch {}
    }
  }
};
