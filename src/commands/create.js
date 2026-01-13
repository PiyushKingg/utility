const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function shortName(n) {
  return n.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 100);
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) {
    console.error('safeReply failed:', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create channels (text / voice / stage / forum)')
    .addSubcommand(s => s.setName('channel').setDescription('Create a text or announcement channel')
      .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
      .addStringOption(o => o.setName('topic').setDescription('Optional topic').setRequired(false))
      .addBooleanOption(o => o.setName('announcement').setDescription('Make an announcement/news channel (true/false)').setRequired(false))
      .addIntegerOption(o => o.setName('slowmode').setDescription('Slowmode (seconds)').setRequired(false))
      .addBooleanOption(o => o.setName('nsfw').setDescription('Mark channel NSFW').setRequired(false))
    )
    .addSubcommand(s => s.setName('vc').setDescription('Create a voice channel')
      .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
      .addIntegerOption(o => o.setName('user_limit').setDescription('User limit (0 = unlimited)').setRequired(false))
      .addIntegerOption(o => o.setName('bitrate').setDescription('Bitrate in bps (e.g., 64000)').setRequired(false))
    )
    .addSubcommand(s => s.setName('stage').setDescription('Create a stage channel')
      .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
    )
    .addSubcommand(s => s.setName('forum').setDescription('Create a forum channel')
      .addStringOption(o => o.setName('name').setDescription('Forum name').setRequired(true))
      .addStringOption(o => o.setName('topic').setDescription('Forum topic').setRequired(false))
    ),

  async execute(interaction) {
    // permission check
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return safeReply(interaction, { content: 'You need Manage Channels permission to create channels.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'channel') {
        const name = shortName(interaction.options.getString('name'));
        const topic = interaction.options.getString('topic') || undefined;
        const announcement = interaction.options.getBoolean('announcement') || false;
        const slowmode = interaction.options.getInteger('slowmode') ?? 0;
        const nsfw = interaction.options.getBoolean('nsfw') || false;

        const type = announcement ? 5 : 0; // 5 = GuildAnnouncement/news, 0 = GuildText
        const created = await interaction.guild.channels.create({
          name,
          type,
          topic,
          nsfw,
          rateLimitPerUser: Math.max(0, Math.min(21600, slowmode))
        });
        const embed = new EmbedBuilder().setTitle('Channel Created').setDescription(`${created} created`).setColor(0x00AA00);
        return safeReply(interaction, { embeds: [embed] });
      }

      if (sub === 'vc') {
        const name = shortName(interaction.options.getString('name'));
        const userLimit = interaction.options.getInteger('user_limit') ?? 0;
        const bitrate = interaction.options.getInteger('bitrate') ?? 64000;
        const created = await interaction.guild.channels.create({
          name,
          type: 2, // GuildVoice
          userLimit: Math.max(0, Math.min(99, userLimit)),
          bitrate: Math.max(8000, Math.min(384000, bitrate))
        });
        const embed = new EmbedBuilder().setTitle('Voice Channel Created').setDescription(`${created} created`).setColor(0x00AA00);
        return safeReply(interaction, { embeds: [embed] });
      }

      if (sub === 'stage') {
        const name = shortName(interaction.options.getString('name'));
        const created = await interaction.guild.channels.create({ name, type: 13 /* GuildStageVoice */ });
        const embed = new EmbedBuilder().setTitle('Stage Channel Created').setDescription(`${created} created`).setColor(0x00AA00);
        return safeReply(interaction, { embeds: [embed] });
      }

      if (sub === 'forum') {
        const name = shortName(interaction.options.getString('name'));
        const topic = interaction.options.getString('topic') || undefined;
        const created = await interaction.guild.channels.create({
          name,
          type: 15, // GuildForum
          topic
        });
        const embed = new EmbedBuilder().setTitle('Forum Created').setDescription(`${created} created`).setColor(0x00AA00);
        return safeReply(interaction, { embeds: [embed] });
      }
    } catch (err) {
      console.error('create command error:', err);
      return safeReply(interaction, { content: 'Failed to create channel: ' + (err.message || 
