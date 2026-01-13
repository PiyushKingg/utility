const { PermissionsBitField } = require('discord.js');

// safe BigInt conversion for flags (some custom/explained items use 0n)
const toFlag = (v) => {
  try { return BigInt(v ?? 0n); } catch { return 0n; }
};

// -------------------- ROLE PERMISSIONS (ordered to match your list) --------------------
const ROLE_PERMS = [
  { key: 'ViewChannels', label: 'View Channels', flag: toFlag(PermissionsBitField.Flags.ViewChannel) },
  { key: 'ManageChannels', label: 'Manage Channels', flag: toFlag(PermissionsBitField.Flags.ManageChannels) },
  { key: 'ManageRoles', label: 'Manage Roles', flag: toFlag(PermissionsBitField.Flags.ManageRoles) },
  { key: 'CreateExpressions', label: 'Create Expressions', flag: 0n },
  { key: 'ManageExpressions', label: 'Manage Expressions', flag: 0n },
  { key: 'ViewAuditLog', label: 'View Audit Log', flag: toFlag(PermissionsBitField.Flags.ViewAuditLog) },
  { key: 'ViewServerInsights', label: 'View Server Insights', flag: toFlag(PermissionsBitField.Flags.ViewGuildInsights) },
  { key: 'ManageWebhooks', label: 'Manage Webhooks', flag: toFlag(PermissionsBitField.Flags.ManageWebhooks) },
  { key: 'ManageServer', label: 'Manage Server', flag: toFlag(PermissionsBitField.Flags.ManageGuild) },
  { key: 'CreateInvite', label: 'Create Invite', flag: toFlag(PermissionsBitField.Flags.CreateInstantInvite) },
  { key: 'ChangeNickname', label: 'Change Nickname', flag: toFlag(PermissionsBitField.Flags.ChangeNickname) },
  { key: 'ManageNickname', label: 'Manage Nickname', flag: toFlag(PermissionsBitField.Flags.ManageNicknames) },
  { key: 'KickApproveRejectMembers', label: 'Kick, Approve, and Reject Members', flag: toFlag(PermissionsBitField.Flags.KickMembers) },
  { key: 'BanMembers', label: 'Ban Members', flag: toFlag(PermissionsBitField.Flags.BanMembers) },
  { key: 'TimeoutMembers', label: 'Timeout Members', flag: toFlag(PermissionsBitField.Flags.ModerateMembers) },
  { key: 'SendMessagesCreatePosts', label: 'Send Messages and Create Posts', flag: toFlag(PermissionsBitField.Flags.SendMessages) },
  { key: 'SendMessagesInThreadAndPosts', label: 'Send Messages in Thread and Posts', flag: toFlag(PermissionsBitField.Flags.SendMessagesInThreads) },
  { key: 'CreatePublicThread', label: 'Create Public Thread', flag: toFlag(PermissionsBitField.Flags.CreatePublicThreads) },
  { key: 'CreatePrivateThread', label: 'Create private Thread', flag: toFlag(PermissionsBitField.Flags.CreatePrivateThreads) },
  { key: 'EmbedLinks', label: 'Embed Links', flag: toFlag(PermissionsBitField.Flags.EmbedLinks) },
  { key: 'AttachFiles', label: 'Attach Files', flag: toFlag(PermissionsBitField.Flags.AttachFiles) },
  { key: 'AddReactions', label: 'Add Reactions', flag: toFlag(PermissionsBitField.Flags.AddReactions) },
  { key: 'UseExternalEmojis', label: 'Use External Emojis', flag: toFlag(PermissionsBitField.Flags.UseExternalEmojis) },
  { key: 'UseExternalStickers', label: 'Use External Stickers', flag: toFlag(PermissionsBitField.Flags.UseExternalStickers) },
  { key: 'MentionEveryone', label: 'Mention @everyone, @here, and All Roles', flag: toFlag(PermissionsBitField.Flags.MentionEveryone) },
  { key: 'ManageMessages', label: 'Manage Messages', flag: toFlag(PermissionsBitField.Flags.ManageMessages) },
  { key: 'PinMessages', label: 'Pin Messages', flag: toFlag(PermissionsBitField.Flags.ManageMessages) }, // no distinct pin flag; reuse ManageMessages
  { key: 'BypassSlowmode', label: 'Bypass Slowmode', flag: toFlag(PermissionsBitField.Flags.ModerateMembers) },
  { key: 'ManageThreadsAndPosts', label: 'Manage Threads and Posts', flag: toFlag(PermissionsBitField.Flags.ManageThreads) },
  { key: 'ReadMessageHistory', label: 'Read Message History', flag: toFlag(PermissionsBitField.Flags.ReadMessageHistory) },
  { key: 'SendTTSMessages', label: 'Send Text-to-Speech Messages', flag: toFlag(PermissionsBitField.Flags.SendTTSMessages) },
  { key: 'SendVoiceMessages', label: 'Send Voice Messages', flag: 0n },
  { key: 'CreatePolls', label: 'Create Polls', flag: 0n },
  { key: 'Connect', label: 'Connect', flag: toFlag(PermissionsBitField.Flags.Connect) },
  { key: 'Speak', label: 'Speak', flag: toFlag(PermissionsBitField.Flags.Speak) },
  { key: 'Video', label: 'Video', flag: toFlag(PermissionsBitField.Flags.Stream) },
  { key: 'UseSoundboard', label: 'Use Soundboard', flag: toFlag(PermissionsBitField.Flags.UseSoundboard ?? 0n) },
  { key: 'UseExternalSounds', label: 'Use External Sounds', flag: 0n },
  { key: 'UseVoiceActivity', label: 'Use Voice Activity', flag: toFlag(PermissionsBitField.Flags.UseVAD) },
  { key: 'PrioritySpeaker', label: 'Priority Speaker', flag: toFlag(PermissionsBitField.Flags.PrioritySpeaker) },
  { key: 'MuteMembers', label: 'Mute Members', flag: toFlag(PermissionsBitField.Flags.MuteMembers) },
  { key: 'DeafenMembers', label: 'Deafen Members', flag: toFlag(PermissionsBitField.Flags.DeafenMembers) },
  { key: 'MoveMembers', label: 'Move Members', flag: toFlag(PermissionsBitField.Flags.MoveMembers) },
  { key: 'SetVoiceChannelStatus', label: 'Set Voice Channel Status', flag: toFlag(PermissionsBitField.Flags.ManageChannels) },
  { key: 'UseApplicationCommands', label: 'Use Application Commands', flag: toFlag(PermissionsBitField.Flags.UseApplicationCommands) },
  { key: 'UseActivities', label: 'Use Activities', flag: toFlag(PermissionsBitField.Flags.UseExternalApps) },
  { key: 'UseExternalApps', label: 'Use External Apps', flag: toFlag(PermissionsBitField.Flags.UseExternalApps) },
  { key: 'RequestToSpeak', label: 'Request To Speak', flag: toFlag(PermissionsBitField.Flags.RequestToSpeak) },
  { key: 'CreateEvents', label: 'Create Events', flag: toFlag(PermissionsBitField.Flags.CreateInstantInvite) }, // no exact flag; reuse create invite as placeholder
  { key: 'ManageEvents', label: 'Manage Events', flag: toFlag(PermissionsBitField.Flags.ManageEvents ?? 0n) },
  { key: 'Administrator', label: 'Administrator', flag: toFlag(PermissionsBitField.Flags.Administrator) }
];

// -------------------- CHANNEL PERMISSIONS (ordered) --------------------
const CHANNEL_PERMS = [
  { key: 'ViewChannel', label: 'View Channel', flag: toFlag(PermissionsBitField.Flags.ViewChannel) },
  { key: 'ManageChannel', label: 'Manage Channel', flag: toFlag(PermissionsBitField.Flags.ManageChannels) },
  { key: 'ManagePermissions', label: 'Manage Permissions', flag: toFlag(PermissionsBitField.Flags.ManageRoles) },
  { key: 'ManageWebhooks', label: 'Manage Webhooks', flag: toFlag(PermissionsBitField.Flags.ManageWebhooks) },
  { key: 'CreateInvite', label: 'Create Invite', flag: toFlag(PermissionsBitField.Flags.CreateInstantInvite) },
  { key: 'SendMessages', label: 'Send Messages', flag: toFlag(PermissionsBitField.Flags.SendMessages) },
  { key: 'SendMessagesInThreads', label: 'Send Messages In Threads', flag: toFlag(PermissionsBitField.Flags.SendMessagesInThreads) },
  { key: 'CreatePublicThread', label: 'Create Public Thread', flag: toFlag(PermissionsBitField.Flags.CreatePublicThreads) },
  { key: 'CreatePrivateThread', label: 'Create Private Thread', flag: toFlag(PermissionsBitField.Flags.CreatePrivateThreads) },
  { key: 'EmbedLinks', label: 'Embed Link', flag: toFlag(PermissionsBitField.Flags.EmbedLinks) },
  { key: 'AttachFiles', label: 'Attach Files', flag: toFlag(PermissionsBitField.Flags.AttachFiles) },
  { key: 'AddReactions', label: 'Add Reactions', flag: toFlag(PermissionsBitField.Flags.AddReactions) },
  { key: 'UseExternalEmojis', label: 'Use External Emojis', flag: toFlag(PermissionsBitField.Flags.UseExternalEmojis) },
  { key: 'UseExternalStickers', label: 'Use External Stickers', flag: toFlag(PermissionsBitField.Flags.UseExternalStickers) },
  { key: 'MentionEveryone', label: 'Mention @everyone, @here, and All Roles', flag: toFlag(PermissionsBitField.Flags.MentionEveryone) },
  { key: 'ManageRolesChannel', label: 'Manage Roles (channel-level)', flag: toFlag(PermissionsBitField.Flags.ManageRoles) },
  { key: 'PinMessages', label: 'Pin Messages', flag: toFlag(PermissionsBitField.Flags.ManageMessages) },
  { key: 'BypassSlowmode', label: 'Bypass Slowmode', flag: toFlag(PermissionsBitField.Flags.ModerateMembers) },
  { key: 'ManageThreads', label: 'Manage Threads', flag: toFlag(PermissionsBitField.Flags.ManageThreads) },
  { key: 'ReadMessageHistory', label: 'Read Message History', flag: toFlag(PermissionsBitField.Flags.ReadMessageHistory) },
  { key: 'SendTTSMessages', label: 'Send Text-to-Speech Messages', flag: toFlag(PermissionsBitField.Flags.SendTTSMessages) },
  { key: 'SendVoiceMessages', label: 'Send Voice Messages', flag: 0n },
  { key: 'CreatePolls', label: 'Create Polls', flag: 0n },
  { key: 'UseApplicationCommands', label: 'Use Application Commands', flag: toFlag(PermissionsBitField.Flags.UseApplicationCommands) },
  { key: 'UseActivities', label: 'Use Activities', flag: toFlag(PermissionsBitField.Flags.UseExternalApps) },
  { key: 'UseExternalApps', label: 'Use External Apps', flag: toFlag(PermissionsBitField.Flags.UseExternalApps) }
];

// -------------------- Build maps & helpers --------------------
const ROLE_MAP = Object.fromEntries(ROLE_PERMS.map(p => [p.key, p]));
const CHANNEL_MAP = Object.fromEntries(CHANNEL_PERMS.map(p => [p.key, p]));

let ROLE_ALL = 0n;
for (const p of ROLE_PERMS) ROLE_ALL |= toFlag(p.flag);
let CHANNEL_ALL = 0n;
for (const p of CHANNEL_PERMS) CHANNEL_ALL |= toFlag(p.flag);

function nameToFlag(name, context = 'role') {
  if (context === 'role') return ROLE_MAP[name] ? toFlag(ROLE_MAP[name].flag) : 0n;
  return CHANNEL_MAP[name] ? toFlag(CHANNEL_MAP[name].flag) : 0n;
}

function permsForContext(context = 'role') {
  return context === 'role' ? ROLE_PERMS : CHANNEL_PERMS;
}

function allFlagsForContext(context = 'role') {
  return context === 'role' ? ROLE_ALL : CHANNEL_ALL;
}

// Split into chunks of <= 25 for Discord select menus
function splitIntoMenus(arr) {
  const max = 25;
  const out = [];
  for (let i = 0; i < arr.length; i += max) out.push(arr.slice(i, i + max));
  return out;
}

function partsForContext(context = 'role') {
  return splitIntoMenus(permsForContext(context));
}

module.exports = {
  ROLE_PERMS,
  CHANNEL_PERMS,
  NAME_TO_FLAG: nameToFlag,
  nameToFlag,
  permsForContext,
  partsForContext,
  allFlagsForContext
};
