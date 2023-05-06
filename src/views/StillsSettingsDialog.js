const m = require('mithril');
const path = require('path');
const { dialog } = require('electron').remote;
const Dialog = require('../models/Dialog');
const Editor = require('../models/Editor');

let title = '';
let captureStillFunction = null;

const details = [
  {
    id: 'HD',
    title: 'HD classique',
    details: 'Image haute définition pour moniteur standard',
  },
  {
    id: '360',
    title: 'HD 360°',
    details: 'Photo sphérique 360° pour un rendu en réalité virtuelle',
  },
];

let selIndex = 0;

module.exports = {
  // Prevent circular require() dependency with player.js
  setCaptureCallback(dialogTitle, callback) {
    title = dialogTitle;
    captureStillFunction = callback;
  },

  oninit() {
    selIndex = 0;
  },

  view() {
    return m('Dialog.export[style=width:540px]', [
      m(Dialog.header, title),
      m('ul',
        m('li', [
          m('img', { src: 'assets/still-type.svg' }),
          m('div', [
            m('h1', 'Style de Photo'),
            m('h2', details[selIndex].details),
          ]),
          m('select', {
            onchange() {
              selIndex = this.selectedIndex;
            },
          },
          // The stills dialog should hide 360 if we're in 180.
          details.map(current => m('option', { disabled: current.id === '360' && Editor.asset.isVideo() && Editor.asset.is180() }, current.title))),
        ])),
      m(Dialog.footer, [
        m('button', {
          onclick() {
            Dialog.pop();
          },
        }, 'Annuler'),
        m('button', {
          onclick() {
            Dialog.pop();
            const suffix = Editor.asset.isVideo ? 'still' : 'export';

            ipcRenderer.send('save-dialog', {
              title: 'Capturer une Photo',
              filters: [
                { name: 'Image', extensions: ['jpg'] },
              ],
              defaultPath: `*/${path.parse(Editor.file).name}_${suffix}`,
            }, 'save-file-chosen-still');
          },
        }, 'Capturer'),
      ]),
    ]);
  },
};

ipcRenderer.on('save-file-chosen-still', (eventEmitter, fileName) => {
  captureStillFunction(fileName, details[selIndex].id);
});
