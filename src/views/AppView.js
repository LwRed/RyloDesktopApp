const m = require('mithril');

const { ipcRenderer } = require('electron');
const { Menu } = require('electron').remote;

const Editor = require('../models/Editor');
const Dialog = require('../models/Dialog');

const Analytics = require('../models/Analytics');
const LibraryView = require('./LibraryView');
const EditorView = require('./EditorView');
const SettingsDialog = require('./SettingsDialog');

const { setCurrentMediaType } = require('../menu');

function updateMediaType() {
  let mediaType;
  if (Editor.asset === null) {
    mediaType = 'none';
  } else if (!Editor.asset.isVideo()) {
    mediaType = 'photo';
  } else if (Editor.asset.is180()) {
    mediaType = '180';
  } else {
    mediaType = '360';
  }
  setCurrentMediaType(Menu.getApplicationMenu(), mediaType);
}

ipcRenderer.on('menu-preferences', () => {
  if (Dialog.dialogs.length > 0) {
    return;
  }
  Dialog.push(SettingsDialog);
  m.redraw();
});

module.exports = {
  onupdate() {
    updateMediaType();
  },

  view() {
    return [
      m(LibraryView),
      m(EditorView),
      m(Analytics),
      Dialog.dialogs.map(d => m('.dialog-background', m(d[0], d[1]))),
    ];
  },
};
