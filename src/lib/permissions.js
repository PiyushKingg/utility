const { PermissionsBitField } = require('discord.js');

function flagSafe(x) {
  try { return BigInt(x || 0n); } catch { return 0n; }
}

// === ROLE PERMISSIONS (ordered as you requested) ===
const ROLE_PERMS = [
  { key: 'ViewChannels', label: 'View Channels', flag: flagSafe(PermissionsBitField.Flags.ViewChannel) },
  { key: 'ManageChannels', label: 'Manage Channels', flag: flagSafe(PermissionsBitField.Flags.ManageChannels) },
  { key: 'ManageRoles', label: 'Manage Roles', flag: flagSafe(PermissionsBitField.Flags.ManageRoles) },
  { key: 'CreateExpressions', label: 'Create Expressions', flag: 0n },
  { key: 'ManageExpressions', label: 'Manage Expressions', flag: 0n },
  { key: 'ViewAuditLog', label: 'View Audit Log', flag: flagSafe(PermissionsBitField.Flags.ViewAuditLog) },
  { key: 'ViewServerInsights', label: 'View Server Insights', flag: flagSafe(PermissionsBitField.Flags.ViewGuildInsights) },
  { key: 'ManageWebhooks', label: 'Manage Webhooks', flag: flagSafe(PermissionsBitField.Flags.ManageWebhooks) },
  { key: 'ManageServer', label: 'Manage Server', flag: flagSafe(PermissionsBitField.Flags.ManageGuild) },
  { key: 'CreateInvite', label: 'Create Invite', flag: flagSafe(PermissionsBitField.Flags.CreateInstantInvite) },
  { key: 'ChangeNickname', label: 'Change Nickname', flag: flagSafe(PermissionsBitField.Flags.ChangeNickname) },
  { key: 'ManageNickname', label: 'Manage Nickname', flag: flagSafe(PermissionsBitField.Flags.ManageNicknames) },
  { key: 'KickApproveRejectMembers', label: 'Kick, Approve, and Reject Members', flag: flagSafe(PermissionsBitField.Flags.KickMembers) },
  { key: 'BanMembers', label: 'Ban Members', flag: flagSafe(PermissionsBitField.Flags.BanMembers) },
  { key: 'TimeoutMembers', label: 'Timeout Members', flag: flagSafe(PermissionsBitField.Flags.ModerateMembers) },
  { key: 'SendMessagesCreatePosts', label: 'Send Messages and Create Posts', flag: flagSafe(PermissionsBitField.Flags.SendMessages) },
  { key: 'SendMessagesInThreadAndPosts', label: 'Send Messages in Thread and Posts', flag: flagSafe(PermissionsBitField.Flags.SendMessagesInThreads) },
  { key: 'CreatePublicThread', label: 'Create Public Thread', flag: flagSafe(PermissionsBitField.Flags.CreatePublicThreads) },
  { key: 'CreatePrivateThread', label: 'Create private Thread', flag: flagSafe(PermissionsBitField.Flags.CreatePrivateThreads) },
  { key: 'EmbedLinks', label: 'Embed Links', flag: flagSafe(PermissionsBitField.Flags.EmbedLinks) },
  { key: 'AttachFiles', label: 'Attach Files', flag: flagSafe(PermissionsBitField.Flags.AttachFiles) },
  { key: 'AddReactions', label: 'Add Reactions', flag: flagSafe(PermissionsBitField.Flags.AddReactions) },
  { key: 'UseExternalEmojis', label: 'Use External Emojis', flag: flagSafe(PermissionsBitField.Flags.UseExternalEmojis) },
  { key: 'UseExternalStickers', label: 'Use External Stickers', flag: flagSafe(PermissionsBitField.Flags.UseExternalStickers) },
  { key: 'MentionEveryone', label: 'Mention @everyone, @here, and All Roles', flag: flagSafe(PermissionsBitField.Flags.MentionEveryone) },
  { key: 'ManageMessages', label: 'Manage Messages', flag: flagSafe(PermissionsBitField.Flags.ManageMessages) },
  { key: 'PinMessages', label: 'Pin Messages', flag: flagSafe(PermissionsBitField.Flags.ManageMessages) },
  { key: 'BypassSlowmode', label: 'Bypass Slowmode', flag: flagSafe(PermissionsBitField.Flags.ModerateMembers) },
  { key: 'ManageThreadsAndPosts', label: 'Manage Threads and Posts', flag: flagSafe(PermissionsBitField.Flags.ManageThreads) },
  { key: 'ReadMessageHistory', label: 'Read Message History', flag: flagSafe(PermissionsBitField.Flags.ReadMessageHistory) },
  { key: 'SendTTSMessages', label: 'Send Text-to-Speech Messages', flag: flagSafe(PermissionsBitField.Flags.SendTTSMessages) },
  { key: 'SendVoiceMessages', label: 'Send Voice Messages', flag: 0n },
  { key: 'CreatePolls', label: 'Create Polls', flag: 0n },
  { key: 'Connect', label: 'Connect', flag: flagSafe(PermissionsBitField.Flags.Connect) },
  { key: 'Speak', label: 'Speak', flag: flagSafe(PermissionsBitField.Flags.Speak) },
  { key: 'Video', label: 'Video', flag: flagSafe(PermissionsBitField.Flags.Stream) },
  { key: 'UseSoundboard', label: 'Use Soundboard', flag: 0n },
  { key: 'UseExternalSounds', label: 'Use External Sounds', flag: 0n },
  { key: 'UseVoiceActivity', label: 'Use Voice Activity', flag: flagSafe(PermissionsBitField.Flags.UseVAD) },
  { key: 'PrioritySpeaker', label: 'Priority Speaker', flag: flagSafe(PermissionsBitField.Flags.PrioritySpeaker) },
  { key: 'MuteMembers', label: 'Mute Members', flag: flagSafe(PermissionsBitField.Flags.MuteMembers) },
  { key: 'DeafenMembers', label: 'Deafen Members', flag: flagSafe(PermissionsBitField.Flags.DeafenMembers) },
  { key: 'MoveMembers', label: 'Move Members', flag: flagSafe(PermissionsBitField.Flags.MoveMembers) },
  { key: 'SetVoiceChannelStatus', label: 'Set Voice Channel Status', flag: flagSafe(PermissionsBitField.Flags.ManageChannels) },
  { key: 'UseApplicationCommands', label: 'Use Application Commands', flag: flagSafe(PermissionsBitField.Flags.UseApplicationCommands) },
  { key: 'UseActivities', label: 'Use Activities', flag: flagSafe(PermissionsBitField.Flags.UseExternalApps) },
  { key: 'UseExternalApps', label: 'Use External Apps', flag: flagSafe(PermissionsBitField.Flags.UseExternalApps) },
  { key: 'RequestToSpeak', label: 'Request To Speak', flag: flagSafe(PermissionsBitField.Flags.RequestToSpeak) },
  { key: 'CreateEvents', label: 'Create Events', flag: flagSafe(PermissionsBitField.Flags.CreateInstantInvite) },
  { key: 'ManageEvents', label: 'Manage Events', flag: flagSafe(PermissionsBitField.Flags.ManageEvents) },
  { key: 'Administrator', label: 'Administrator', flag: flagSafe(PermissionsBitField.Flags.Administrator) }
];

// === CHANNEL PERMISSIONS (ordered) ===
const CHANNEL_PERMS = [
  { key: 'ViewChannel', label: 'View Channel', flag: flagSafe(PermissionsBitField.Flags.ViewChannel) },
  { key: 'ManageChannel', label: 'Manage Channel', flag: flagSafe(PermissionsBitField.Flags.ManageChannels) },
  { key: 'ManagePermissions', label: 'Manage Permissions', flag: flagSafe(PermissionsBitField.Flags.ManageRoles) },
  { key: 'ManageWebhooksChannel', label: 'Manage Webhooks', flag: flagSafe(PermissionsBitField.Flags.ManageWebhooks) },
  { key: 'CreateInviteChannel', label: 'Create Invite', flag: flagSafe(PermissionsBitField.Flags.CreateInstantInvite) },
  { key: 'SendMessages', label: 'Send Messages', flag: flagSafe(PermissionsBitField.Flags.SendMessages) },
  { key: 'SendMessagesInThreads', label: 'Send Messages In Threads', flag: flagSafe(PermissionsBitField.Flags.SendMessagesInThreads) },
  { key: 'CreatePublicThread', label: 'Create Public Thread', flag: flagSafe(PermissionsBitField.Flags.CreatePublicThreads) },
  { key: 'CreatePrivateThread', label: 'Create Private Thread', flag: flagSafe(PermissionsBitField.Flags.CreatePrivateThreads) },
  { key: 'EmbedLink', label: 'Embed Link', flag: flagSafe(PermissionsBitField.Flags.EmbedLinks) },
  { key: 'AttachFiles', label: 'Attach Files', flag: flagSafe(PermissionsBitField.Flags.AttachFiles) },
  { key: 'AddReactions', label: 'Add Reactions', flag: flagSafe(PermissionsBitField.Flags.AddReactions) },
  { key: 'UseExternalEmojis', label: 'Use External Emojis', flag: flagSafe(PermissionsBitField.Flags.UseExternalEmojis) },
  { key: 'UseExternalStickers', label: 'Use External Stickers', flag: flagSafe(PermissionsBitField.Flags.UseExternalStickers) },
  { key: 'MentionEveryone', label: 'Mention @everyone, @here, and All Roles', flag: flagSafe(PermissionsBitField.Flags.MentionEveryone) },
  { key: 'ManageRolesChannel', label: 'Manage Roles (channel-level)', flag: flagSafe(PermissionsBitField.Flags.ManageRoles) },
  { key: 'PinMessages', label: 'Pin Messages', flag: flagSafe(PermissionsBitField.Flags.ManageMessages) },
  { key: 'BypassSlowmode', label: 'Bypass Slowmode', flag: flagSafe(PermissionsBitField.Flags.ModerateMembers) },
  { key: 'ManageThreads', label: 'Manage Threads', flag: flagSafe(PermissionsBitField.Flags.ManageThreads) },
  { key: 'ReadMessageHistory', label: 'Read Message History', flag: flagSafe(PermissionsBitField.Flags.ReadMessageHistory) },
  { key: 'SendTTSMessages', label: 'Send Text-to-Speech Messages', flag: flagSafe(PermissionsBitField.Flags.SendTTSMessages) },
  { key: 'SendVoiceMessages', label: 'Send Voice Messages', flag: 0n },
  { key: 'CreatePolls', label: 'Create Polls', flag: 0n },
  { key: 'UseApplicationCommands', label: 'Use Application Commands', flag: flagSafe(PermissionsBitField.Flags.UseApplicationCommands) },
  { key: 'UseActivities', label: 'Use Activities', flag: flagSafe(PermissionsBitField.Flags.UseExternalApps) },
  { key: 'UseExternalApps', label: 'Use External Apps', flag: flagSafe(PermissionsBitField.Flags.UseExternalApps) }
];

// Build maps and "ALL"
const ROLE_MAP = {};
const CHANNEL_MAP = {};
let ROLE_ALL_FLAGS = 0n;
let CHANNEL_ALL_FLAGS = 0n;
for (const p of ROLE_PERMS) { ROLE_MAP[p.key] = p; ROLE_ALL_FLAGS |= BigInt(p.flag || 0n); }
for (const p of CHANNEL_PERMS) { CHANNEL_MAP[p.key] = p; CHANNEL_ALL_FLAGS |= BigInt(p.flag || 0n); }

function nameToFlag(key, context = 'role') {
  if (context === 'role') return ROLE_MAP[key] ? BigInt(ROLE_MAP[key].flag || 0n) : 0n;
  return CHANNEL_MAP[key] ? BigInt(CHANNEL_MAP[key].flag || 0n) : 0n;
}
function permsForContext(context = 'role') { return context === 'role' ? ROLE_PERMS : CHANNEL_PERMS; }
function allFlagsForContext(context = 'role') { return context === 'role' ? ROLE_ALL_FLAGS : CHANNEL_ALL_FLAGS; }

// Split into TWO main parts, but if >50 it will generate extra parts (each <=25)
function splitIntoMenus(arr) {
  const maxPer = 25;
  const menus = [];
  for (let i = 0; i < arr.length; i += maxPer) menus.push(arr.slice(i, i + maxPer));
  return menus; // array of arrays
us(arr);
}

module.exports = {
  ROLE_PERMS,
  CHANNEL_PERMS,
  nameToFlag,
  permsForContext,
  ext
};
