const m = require('mithril');
const { shell } = require('electron');
const { BrowserWindow, dialog } = require('electron').remote;
const fs = require('fs');
const path = require('path');
const dateFormat = require('dateformat');
const { ipcRenderer } = require('electron');
const rylo = require('core-js/build/Release/core-js');

const Media = require('../models/Media');
const Dialog = require('../models/Dialog');
const Editor = require('../models/Editor');
const EditorView = require('./EditorView');

function replaceExtension(filePath, ext) {
  const p = path.parse(filePath);
  delete p.base;
  p.ext = ext;
  return path.format(p);
}

function byteFormat(bytes, decimals) {
  if (bytes == 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const dm = decimals <= 0 ? 0 : decimals || 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
  fileSize: 0,
  dateCreated: null,
  hasPoints: false,
  hasEdits: false,
  isVideo: true,

  oninit(vnode) {
    this.fileSize = fs.statSync(vnode.attrs.src).size;
    const asset = new rylo.Asset(vnode.attrs.src);
    asset.fetchDateCreated().then((value) => {
      this.dateCreated = value;
      m.redraw();
    });
    this.isVideo = asset.isVideo();

    if (Editor.file === vnode.attrs.src) {
      this.hasEdits = Editor.hasEdits;
      this.hasPoints = EditorView.player.keyframeCount() > 0;
    } else {
      this.hasEdits = fs.existsSync(replaceExtension(vnode.attrs.src, '.rylo'));
      this.hasPoints = this.hasEdits && asset.hasPoints();
    }
  },

  onupdate(vnode) {
    if (!Media.isFileInLibrary(vnode.attrs.src)) {
      Dialog.pop();
    }
  },

  view(vnode) {
    return m('Dialog.export[style=width:540px]', [
      m(Dialog.header, [
        m('h1', 'Détails'),
        m('button', {
          onclick() {
            shell.showItemInFolder(vnode.attrs.src);
          },
        }, 'Montrer dans le Finder'),
      ]),
      m('ul',
        m('li', [
          m('img', { src: 'assets/details-creation.svg' }),
          m('div', [
            m('h1', 'Date du Fichier'),
            this.dateCreated ? m('h2', dateFormat(this.dateCreated, "dd'/'mm'/'yyyy 'à' h:MM:ss TT")): [],
          ]),
        ]),
        m('li', [
          m('img', { src: 'assets/details-storage.svg' }),
          m('div', [
            m('h1', 'Taille du Fichier'),
            m('h2', byteFormat(this.fileSize, 1)),
          ]),
        ]),
        m('li', [
          m('img', { src: 'assets/details-discard.svg' }),
          m('div', [
            m('h1', this.isVideo ? 'Effacer les éditions Vidéo' : 'Effacer les éditions Photo'),
            m('h2', this.hasPoints ? 'Editions et Points actifs' :
                    this.hasEdits  ? 'Editions actives' :
                    this.isVideo ? 'Aucune édition ou point actif' : 
                    'Aucune édition active')
          ]),
          m('div', [
            this.isVideo ? m('button', {
              disabled: !this.hasPoints,
              onclick: (e) => {
                if (Editor.file === vnode.attrs.src) {
                  EditorView.player.removeAllKeyframes();
                } else {
                  const asset = new rylo.Asset(vnode.attrs.src);
                  asset.removeAllPoints();
                }
                this.hasPoints = false;
                ipcRenderer.emit('remove-all-keyframes');
              },
            }, 'Effacer les points') : [],
            m('button', {
              disabled: !this.hasEdits,
              onclick: (e) => {
                if (Editor.file === vnode.attrs.src) {
                  EditorView.player.removeAllKeyframes();
                  Editor.edits = Editor.defaultEdits;
                  EditorView.player.removeAllTimelapseSegments();
                  this.hasEdits = false;
                  this.hasPoints = false;
                } else {
                  try {
                    fs.unlinkSync(replaceExtension(vnode.attrs.src, '.rylo'));
                    this.hasEdits = false;
                    this.hasPoints = false;
                  } catch (e) {
                    alert('Effacement impossible. Essayez plus tard.');
                  }
                }
                ipcRenderer.emit('remove-all-edits');
              },
            }, 'Effacer tout'),
          ]),
        ])),
      m(Dialog.footer, [
        m('button.destructive', {
          onclick() {
            dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
              type: 'warning',
              buttons: ['Effacer', 'Annuler'],
              defaultId: 0,
              cancelId: 1,
              message: 'Au delà des éditions, êtes-vous certain de vouloir supprimer ce fichier ?',
            }, (response) => {
              if (response === 0) {
                ipcRenderer.emit('media-delete', new rylo.Asset(vnode.attrs.src));
                fs.unlinkSync(vnode.attrs.src);
                try {
                  fs.unlinkSync(replaceExtension(vnode.attrs.src, '.rylo'));
                } catch (e) {
                  // ignore error since file may not exist
                }
                Dialog.pop();
              }
            });
          },
        }, this.isVideo ? 'Supprimer la Vidéo' : 'Supprimer la Photo'),
        m('.flex-spacer'),
        m('button', {
          onclick() {
            Dialog.pop();
          },
        }, 'Fermer'),
      ]),
    ]);
  },
};
