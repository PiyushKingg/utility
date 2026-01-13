const { PermissionsBitField } = require('discord.js');

const defs = [
  { key: 'CreateInvite', label: 'Create Invite', flag: PermissionsBitField.Flags.CreateInstantInvite || 0n },
  { key: 'KickMembers', label: 'Kick Members', flag: PermissionsBitField.Flags.KickMembers || 0n },
  { key: 'BanMembers', label: 'Ban Members', flag: PermissionsBitField.Flags.BanMembers || 0n },
  { key: 'Administrator', label: 'Administrator', flag: PermissionsBitField.Flags.Administrator || 0n },
  { key: 'ManageChannels', label: 'Manage Channels', flag: PermissionsBitField.Flags.ManageChannels || 0n },
  { key: 'ManageRoles', label: 'Manage Roles', flag: PermissionsBitField.Flags.ManageRoles || 0n },
  { key: 'CreateExpressions', label: 'Create Expressions', flag: PermissionsBitField.Flags.UseExternalApps || 0n },
  { key: 'ManageExpressions', label: 'Manage Expressions', flag: PermissionsBitField.Flags.ManageEmojisAndStickers || 0n },
  { key: 'ViewAuditLog', label: 'View Audit Log', flag: PermissionsBitField.Flags.ViewAuditLog || 0n },
  { key: 'ViewGuildInsights', label: 'View Server Insights', flag: PermissionsBitField.Flags.ViewGuildInsights || 0n },
  { key: 'ManageWebhooks', label: 'Manage Webhooks', flag: PermissionsBitField.Flags.ManageWebhooks || 0n },
  { key: 'ManageGuild', label: 'Manage Server', flag: PermissionsBitField.Flags.ManageGuild || 0n },
  { key: 'CreateInviteAlt', label: 'Create Invite', flag: PermissionsBitField.Flags.CreateInstantInvite || 0n },
  { key: 'ChangeNickname', label: 'Change Nickname', flag: PermissionsBitField.Flags.ChangeNickname || 0n },
  { key: 'ManageNicknames', label: 'Manage Nickname', flag: PermissionsBitField.Flags.ManageNicknames || 0n },
  { key: 'KickApproveReject', label: 'Kick, Approve, and Reject Members', flag: PermissionsBitField.Flags.KickMembers || 0n },
  { key: 'BanMembers2', label: 'Ban Members (alt)', flag: PermissionsBitField.Flags.BanMembers || 0n },
  { key: 'ModerateMembers', label: 'Timeout Members', flag: PermissionsBitField.Flags.ModerateMembers || 0n },
  { key: 'SendMessages', label: 'Send Messages & Create Posts', flag: PermissionsBitField.Flags.SendMessages || 0n },
  { key: 'SendMessagesInThreads', label: 'Send Messages in Thread & Posts', flag: PermissionsBitField.Flags.SendMessagesInThreads || 0n },
  { key: 'CreatePublicThreads', label: 'Create Public Thread', flag: PermissionsBitField.Flags.CreatePublicThreads || 0n },
  { key: 'CreatePrivateThreads', label: 'Create Private Thread', flag: PermissionsBitField.Flags.CreatePrivateThreads || 0n },
  { key: 'EmbedLinks', label: 'Embed Links', flag: PermissionsBitField.Flags.EmbedLinks || 0n },
  { key: 'AttachFiles', label: 'Attach Files', flag: PermissionsBitField.Flags.AttachFiles || 0n },
  { key: 'AddReactions', label: 'Add Reactions', flag: PermissionsBitField.Flags.AddReactions || 0n },
  { key: 'UseExternalEmojis', label: 'Use External Emojis', flag: PermissionsBitField.Flags.UseExternalEmojis || 0n },
  { key: 'UseExternalStickers', label: 'Use External Stickers', flag: PermissionsBitField.Flags.UseExternalStickers || 0n },
  { key: 'MentionEveryone', label: 'Mention @everyone / @here / Roles', flag: PermissionsBitField.Flags.MentionEveryone || 0n },
  { key: 'ManageMessages', label: 'Manage Messages', flag: PermissionsBitField.Flags.ManageMessages || 0n },
  { key: 'PinMessages', label: 'Pin Messages', flag: PermissionsBitField.Flags.ManageMessages || 0n },
  { key: 'BypassSlowmode', label: 'Bypass Slowmode', flag: PermissionsBitField.Flags.ModerateMembers || 0n },
  { key: 'ManageThreads', label: 'Manage Threads & Posts', flag: PermissionsBitField.Flags.ManageThreads || 0n },
  { key: 'ReadMessageHistory', label: 'Read Message History', flag: PermissionsBitField.Flags.ReadMessageHistory || 0n },
  { key: 'SendTTSMessages', label: 'Send Text-to-Speech Messages', flag: PermissionsBitField.Flags.SendTTSMessages || 0n },
  { key: 'SendVoiceMessages', label: 'Send Voice Messages', flag: 0n },
  { key: 'CreatePolls', label: 'Create Polls', flag: 0n },
  { key: 'Connect', label: 'Connect', flag: PermissionsBitField.Flags.Connect || 0n },
  { key: 'Speak', label: 'Speak', flag: PermissionsBitField.Flags.Speak || 0n },
  { key: 'Video', label: 'Video', flag: PermissionsBitField.Flags.Stream || 0n },
  { key: 'UseSoundboard', label: 'Use Soundboard', flag: 0n },
  { key: 'UseExternalSounds', label: 'Use External Sounds', flag: 0n },
  { key: 'UseVAD', label: 'Use Voice Activity', flag: PermissionsBitField.Flags.UseVAD || 0n },
  { key: 'PrioritySpeaker', label: 'Priority Speaker', flag: PermissionsBitField.Flags.PrioritySpeaker || 0n },
  { key: 'MuteMembers', label: 'Mute Members', flag: PermissionsBitField.Flags.MuteMembers || 0n },
  { key: 'DeafenMembers', label: 'Deafen Members', flag: PermissionsBitField.Flags.DeafenMembers || 0n },
  { key: 'MoveMembers', label: 'Move Members', flag: PermissionsBitField.Flags.MoveMembers || 0n },
  { key: 'SetVoiceChannelStatus', label: 'Set Voice Channel Status', flag: PermissionsBitField.Flags.ManageChannels || 0n },
  { key: 'UseApplicationCommands', label: 'Use Application Commands', flag: PermissionsBitField.Flags.UseApplicationCommands || 0n },
  { key: 'UseActivities', label: 'Use Activities', flag: PermissionsBitField.Flags.StartEmbeddedActivities || PermissionsBitField.Flags.UseExternalApps || 0n },
  { key: 'UseExternalApps', label: 'Use External Apps', flag: PermissionsBitField.Flags.UseExternalApps || 0n },
  { key: 'RequestToSpeak', label: 'Request To Speak', flag: PermissionsBitField.Flags.RequestToSpeak || 0n },
  { key: 'CreateEvents', label: 'Create Events', flag: PermissionsBitField.Flags.CreateInstantInvite || 0n },
  { key: 'ManageEvents', label: 'Manage Events', flag: PermissionsBitField.Flags.ManageEvents || 0n },
  { key: 'ManageThreads2', label: 'Manage Threads', flag: PermissionsBitField.Flags.ManageThreads || 0n }
];

const PERM_DEFS = defs;
const PERM_MAP = {};
let ALL_FLAGS = 0n;
for (const d of PERM_DEFS) {
  PERM_MAP[d.key] = d;
  try { ALL_FLAGS |= BigInt(d.flag || 0n); } catch {}
}

const half = Math.ceil(PERM_DEFS.length / 2);
const PERM_SELECT_A = PERM_DEFS.slice(0, half);
const PERM_SELECT_B = PERM_DEFS.slice(half);

function nameToFlag(key) {
  const ent = PERM_MAP[key];
  if (!ent) return 0n;
  try { return BigInt(ent.flag || 0n); } catch { return 0n; }
}

module.exports = {
  PERM_DEFS,
  PERM_SELECT_A,
  PERM_SELECT_B,
  nameToFlag,
  ALL_FLAGS
};
