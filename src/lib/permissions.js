const { PermissionsBitField } = require('discord.js');

const PERMS_MAP = {
  // Role permissions (best-effort mapping)
  ViewChannel: PermissionsBitField.Flags.ViewChannel,
  ManageChannels: PermissionsBitField.Flags.ManageChannels,
  ManageRoles: PermissionsBitField.Flags.ManageRoles,
  CreateExpressions: PermissionsBitField.Flags.UseExternalApps || 0n, // no exact match; map to use apps
  ManageExpressions: PermissionsBitField.Flags.ManageEmojisAndStickers || 0n, // best-effort
  ViewAuditLog: PermissionsBitField.Flags.ViewAuditLog,
  ViewGuildInsights: PermissionsBitField.Flags.ViewGuildInsights || 0n,
  ManageWebhooks: PermissionsBitField.Flags.ManageWebhooks,
  ManageGuild: PermissionsBitField.Flags.ManageGuild,
  CreateInstantInvite: PermissionsBitField.Flags.CreateInstantInvite,
  ChangeNickname: PermissionsBitField.Flags.ChangeNickname,
  ManageNicknames: PermissionsBitField.Flags.ManageNicknames,
  KickMembers: PermissionsBitField.Flags.KickMembers,
  BanMembers: PermissionsBitField.Flags.BanMembers,
  ModerateMembers: PermissionsBitField.Flags.ModerateMembers, // timeout members
  SendMessages: PermissionsBitField.Flags.SendMessages,
  SendMessagesInThreads: PermissionsBitField.Flags.SendMessagesInThreads,
  CreatePublicThreads: PermissionsBitField.Flags.CreatePublicThreads,
  CreatePrivateThreads: PermissionsBitField.Flags.CreatePrivateThreads,
  EmbedLinks: PermissionsBitField.Flags.EmbedLinks,
  AttachFiles: PermissionsBitField.Flags.AttachFiles,
  AddReactions: PermissionsBitField.Flags.AddReactions,
  UseExternalEmojis: PermissionsBitField.Flags.UseExternalEmojis,
  UseExternalStickers: PermissionsBitField.Flags.UseExternalStickers,
  MentionEveryone: PermissionsBitField.Flags.MentionEveryone,
  ManageMessages: PermissionsBitField.Flags.ManageMessages,
  PinMessages: PermissionsBitField.Flags.ManageMessages, // no separate flag; reuse ManageMessages
  BypassSlowmode: PermissionsBitField.Flags.ModerateMembers || 0n, // no exact flag; fallback to moderate (best-effort)
  ManageThreads: PermissionsBitField.Flags.ManageThreads,
  ReadMessageHistory: PermissionsBitField.Flags.ReadMessageHistory,
  SendTTSMessages: PermissionsBitField.Flags.SendTTSMessages,
  SendVoiceMessages: 0n, // not a permissions flag (client-level)
  CreatePolls: 0n, // no direct flag
  Connect: PermissionsBitField.Flags.Connect,
  Speak: PermissionsBitField.Flags.Speak,
  Video: PermissionsBitField.Flags.Stream || 0n,
  UseSoundboard: 0n,
  UseExternalSounds: 0n,
  UseVAD: PermissionsBitField.Flags.UseVAD,
  PrioritySpeaker: PermissionsBitField.Flags.PrioritySpeaker,
  MuteMembers: PermissionsBitField.Flags.MuteMembers,
  DeafenMembers: PermissionsBitField.Flags.DeafenMembers,
  MoveMembers: PermissionsBitField.Flags.MoveMembers,
  SetVoiceChannelStatus: PermissionsBitField.Flags.ManageChannels || 0n,
  UseApplicationCommands: PermissionsBitField.Flags.UseApplicationCommands,
  UseActivities: PermissionsBitField.Flags.StartEmbeddedActivities || PermissionsBitField.Flags.UseExternalApps || 0n,
  UseExternalApps: PermissionsBitField.Flags.UseExternalApps || 0n,
  RequestToSpeak: PermissionsBitField.Flags.RequestToSpeak || 0n,
  CreateEvents: PermissionsBitField.Flags.CreateInstantInvite || 0n, // no exact flag; approximate
  ManageEvents: PermissionsBitField.Flags.ManageEvents || 0n,
  Administrator: PermissionsBitField.Flags.Administrator
};

// The ordered list of permission options, in the exact order you provided, with display labels.
// The `value` matches a key in PERMS_MAP. This list will be paginated in the UI.
const PERM_OPTIONS_FULL = [
  { label: 'View Channels', value: 'ViewChannel' },
  { label: 'Manage Channels', value: 'ManageChannels' },
  { label: 'Manage Roles', value: 'ManageRoles' },
  { label: 'Create Expressions', value: 'CreateExpressions' },
  { label: 'Manage Expressions', value: 'ManageExpressions' },
  { label: 'View Audit Log', value: 'ViewAuditLog' },
  { label: 'View Server Insights', value: 'ViewGuildInsights' },
  { label: 'Manage Webhooks', value: 'ManageWebhooks' },
  { label: 'Manage Server', value: 'ManageGuild' },
  { label: 'Create Invite', value: 'CreateInstantInvite' },
  { label: 'Change Nickname', value: 'ChangeNickname' },
  { label: 'Manage Nickname', value: 'ManageNicknames' },
  { label: 'Kick, Approve, and Reject Members', value: 'KickMembers' },
  { label: 'Ban Members', value: 'BanMembers' },
  { label: 'Timeout Members', value: 'ModerateMembers' },
  { label: 'Send Messages and Create Posts', value: 'SendMessages' },
  { label: 'Send Messages in Thread and Posts', value: 'SendMessagesInThreads' },
  { label: 'Create Public Thread', value: 'CreatePublicThreads' },
  { label: 'Create private Thread', value: 'CreatePrivateThreads' },
  { label: 'Embed Links', value: 'EmbedLinks' },
  { label: 'Attach Files', value: 'AttachFiles' },
  { label: 'Add Reactions', value: 'AddReactions' },
  { label: 'Use External Emojis', value: 'UseExternalEmojis' },
  { label: 'Use External Stickers', value: 'UseExternalStickers' },
  { label: 'Mention @everyone, @here, and All Roles', value: 'MentionEveryone' },
  { label: 'Manage Messages', value: 'ManageMessages' },
  { label: 'Pin Messages', value: 'PinMessages' },
  { label: 'Bypass Slowmode', value: 'BypassSlowmode' },
  { label: 'Manage Threads and Posts', value: 'ManageThreads' },
  { label: 'Read Message History', value: 'ReadMessageHistory' },
  { label: 'Send Text-to-Speech Messages', value: 'SendTTSMessages' },
  { label: 'Send Voice Messages', value: 'SendVoiceMessages' },
  { label: 'Create Polls', value: 'CreatePolls' },
  { label: 'Connect', value: 'Connect' },
  { label: 'Speak', value: 'Speak' },
  { label: 'Video', value: 'Video' },
  { label: 'Use Soundboard', value: 'UseSoundboard' },
  { label: 'Use External Sounds', value: 'UseExternalSounds' },
  { label: 'Use Voice Activity', value: 'UseVAD' },
  { label: 'Priority Speaker', value: 'PrioritySpeaker' },
  { label: 'Mute Members', value: 'MuteMembers' },
  { label: 'Deafen Members', value: 'DeafenMembers' },
  { label: 'Move Members', value: 'MoveMembers' },
  { label: 'Set Voice Channel Status', value: 'SetVoiceChannelStatus' },
  { label: 'Use Application Commands', value: 'UseApplicationCommands' },
  { label: 'Use Activities', value: 'UseActivities' },
  { label: 'Use External Apps', value: 'UseExternalApps' },
  { label: 'Request To Speak', value: 'RequestToSpeak' },
  { label: 'Create Events', value: 'CreateEvents' },
  { label: 'Manage Events', value: 'ManageEvents' },
  { label: 'Administrator', value: 'Administrator' }
];

// For convenience compute ALL_FLAGS (bitwise OR of all non-zero mapped flags)
let ALL_FLAGS = 0n;
for (const key of Object.keys(PERMS_MAP)) {
  try {
    const f = BigInt(PERMS_MAP[key] || 0n);
    ALL_FLAGS = ALL_FLAGS | f;
  } catch {
    // ignore
  }
}

// helper to get flag for a key
function nameToFlag(name) {
  if (!name) return 0n;
  const val = PERMS_MAP[name];
  if (!val) return 0n;
  // Ensure BigInt
  try { return BigInt(val); } catch { return 0n; }
}

// Expose a paginated helper to slice the full options into pages of at most 23 items
// (we reserve 1 slot for "All Permissions" and possibly 1 for "More...").
function getPermPage(pageIndex, pageSize = 23) {
  const start = pageIndex * pageSize;
  const slice = PERM_OPTIONS_FULL.slice(start, start + pageSize);
  const hasMore = start + pageSize < PERM_OPTIONS_FULL.length;
  return { options: slice, hasMore };
}

module.exports = {
  PERMS_MAP,
  PERM_OPTIONS_FULL,
  getPermPage,
  nameToFlag,
  ALL_FLAGS
};
