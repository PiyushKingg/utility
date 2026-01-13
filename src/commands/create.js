// src/commands/create.js
const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('create').setDescription('Quick create a channel')
    .addSubcommand(s => s.setName('text').setDescription('Create a text channel').addStringOption(o => o.setName('name').setRequired(true)).addStringOption(o => o.setName('topic')))
    .addSubcommand(s => s.setName('voice').setDescription('Create a voice channel').addStringOption(o => o.setName('name').setRequired(true)).addIntegerOption(o => o.setName('user_limit')))
    .addSubcommand(s => s.setName('stage').setDescription('Create a stage channel').addStringOption(o => o.setName('name').setRequired(true)))
    .addSubcommand(s => s.setName('forum').setDescription('Create a forum channel').addStringOption(o => o.setName('name').setRequired(true)).addStringOption(o => o.setName('topic'))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (!interaction.memberPermissions.has('ManageChannels')) return interaction.reply({ content: 'You need Manage Channels permission.', ephemeral: true });
    try {
      const name = interaction.options.getString('name', true);
      if (sub === 'text') {
        const topic = interaction.options.getString('topic');
        const ch = await interaction.guild.channels.create({ name, type: ChannelType.GuildText, topic });
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Created Text Channel').setDescription(`<#${ch.id}>`).setColor(0x00AA00)] });
      }
      if (sub === 'voice') {
        const limit = interaction.options.getInteger('user_limit');
        const ch = await interaction.guild.channels.create({ name, type: ChannelType.GuildVoice, userLimit: limit || 0 });
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Created Voice Channel').setDescription(`<#${ch.id}>`).setColor(0x00AA00)] });
      }
      if (sub === 'stage') {
        const ch = await interaction.guild.channels.create({ name, type: ChannelType.GuildStageVoice });
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Created Stage Channel').setDescription(`<#${ch.id}>`).setColor(0x00AA00)] });
      }
      if (sub === 'forum') {
        const topic = interaction.options.getString('topic');
        const ch = await interaction.guild.channels.create({ name, type: ChannelType.GuildForum, topic });
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Created Forum Channel').setDescription(`<#${ch.id}>`).setColor(0x00AA00)] });
      }
    } catch (err) {
      console.error('create command failed', err);
      return interaction.reply({ content: 'Failed to create channel: ' + (err.message || err), ephemeral: true });
    }
  }
};
