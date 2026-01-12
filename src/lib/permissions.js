const { PermissionsBitField } = require('discord.js');

const PERM_OPTIONS = [
  { label: 'Administrator', value: 'Administrator' },
  { label: 'Manage Roles', value: 'ManageRoles' },
  { label: 'Manage Channels', value: 'ManageChannels' },
  { label: 'View Channels', value: 'ViewChannel' },
  { label: 'Send Messages', value: 'SendMessages' },
  { label: 'Embed Links', value: 'EmbedLinks' },
  { label: 'Attach Files', value: 'AttachFiles' },
  { label: 'Read Message History', value: 'ReadMessageHistory' },
  { label: 'Connect (Voice)', value: 'Connect' },
  { label: 'Speak (Voice)', value: 'Speak' }
];

function permissionNameToFlag(name) {
  switch (name) {
    case 'Administrator': return PermissionsBitField.Flags.Administrator;
    case 'ManageRoles': return PermissionsBitField.Flags.ManageRoles;
    case 'ManageChannels': return PermissionsBitField.Flags.ManageChannels;
    case 'ViewChannel': return PermissionsBitField.Flags.ViewChannel;
    case 'SendMessages': return PermissionsBitField.Flags.SendMessages;
    case 'EmbedLinks': return PermissionsBitField.Flags.EmbedLinks;
    case 'AttachFiles': return PermissionsBitField.Flags.AttachFiles;
    case 'ReadMessageHistory': return PermissionsBitField.Flags.ReadMessageHistory;
    case 'Connect': return PermissionsBitField.Flags.Connect;
    case 'Speak': return PermissionsBitField.Flags.Speak;
    default: return 0n;
  }
}

module.exports = { PERM_OPTIONS, permissionNameToFlag };
