// src/commands/channel.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');

function safeReplyFactory(interaction) {
  return async function safeReply(payload) {
    try {
      if (!interaction.replied && !interaction.deferred) return await interaction.reply(payload);
      if (interaction.deferred) return await interaction.editReply(payload);
      return await interaction.followUp(payload);
    } catch (err) {
      try { if (!interaction.replied) return await interaction.reply({ ...payload, ephemeral: true }); } catch (e) {}
      try { return await interaction.followUp({ content: 'Failed to deliver response.', ephemeral: true }); } catch (e) {}
    }
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Channel utilities (perms, create, info)')
    .addSubcommand(sub =>
      sub.setName('perms')
         .setDescription('Open the interactive channel permission editor'))
    .addSubcommand(sub =>
      sub.setName('create')
         .setDescription('Create a channel')
         .addStringOption(opt => opt.setName('name').setDescription('Channel name').setRequired(true))
         .addStringOption(opt => opt.setName('type').setDescription('Type (text/voice/stage/forum)').setRequired(false))
         .addStringOption(opt => opt.setName('topic').setDescription('Topic/description (optional)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('info')
         .setDescription('Show channel info')
         .addChannelOption(opt => opt.setName('channel').setDescription('Channel to inspect').setRequired(true)))
  ,
  async execute(interaction) {
    const safeReply = safeReplyFactory(interaction);
    try {
      const sub = interaction.options.getSubcommand();

      if (sub === 'perms') {
        // Open channel selection menu which interaction handler will handle
        const embed = new EmbedBuilder()
          .setTitle('Channel Permission Editor')
          .setDescription('Select a channel to configure its permission overwrites. (Select from dropdown)')
          .setColor(0x2b2d31);

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('chanp:select_channel')
            .setPlaceholder('Select a channel')
            .setChannelTypes([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.GuildStageVoice])
        );

        return await safeReply({ embeds: [embed], components: [row], ephemeral: false });
      }

      if (sub === 'create') {
        const name = interaction.options.getString('name', true);
        const typeStr = (interaction.options.getString('type') || 'text').toLowerCase();
        const topic = interaction.options.getString('topic') || undefined;

        let chType = ChannelType.GuildText;
        if (typeStr === 'voice') chType = ChannelType.GuildVoice;
        else if (typeStr === 'stage') chType = ChannelType.GuildStageVoice;
        else if (typeStr === 'forum') chType = ChannelType.GuildForum;

        try {
          const created = await interaction.guild.channels.create({
            name,
            type: chType,
            topic,
            reason: `Created via /channel create by ${interaction.user.tag}`
          });

          const embed = new EmbedBuilder()
            .setTitle('Channel Created')
            .setDescription(`Created ${created.type} channel: **${created.name}**`)
            .addFields({ name: 'ID', value: created.id, inline: true })
            .setColor(0x00AA00);

          return await safeReply({ embeds: [embed], ephemeral: false });
        } catch (err) {
          console.error('channel create failed', err);
          return await safeReply({ content: `Failed to create channel: ${err.message || err}`, ephemeral: false });
        }
      }

      if (sub === 'info') {
        const ch = interaction.options.getChannel('channel', true);
        // fetch fresh channel if possible
        const channel = (ch && ch.id) ? await interaction.guild.channels.fetch(ch.id).catch(() => ch) : ch;
        const embed = new EmbedBuilder()
          .setTitle(`Channel Info — ${channel.name}`)
          .addFields(
            { name: 'ID', value: channel.id, inline: true },
            { name: 'Type', value: String(channel.type), inline: true },
            { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true },
            { name: 'Position', value: String(channel.position ?? '—'), inline: true },
            { name: 'Topic', value: channel.topic ?? '—', inline: false }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: `Requested by ${interaction.user.tag}` });

        return await safeReply({ embeds: [embed], ephemeral: false });
      }

      return await safeReply({ content: 'Unknown subcommand', ephemeral: true });
    } catch (err) {
      console.error('channel command failed', err);
      try {
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Internal error while running channel command.', ephemeral: true });
        else await interaction.editReply({ content: 'Internal error while running channel command.' });
      } catch (e) { console.error('failed to report channel command error', e); }
    }
  }
};
