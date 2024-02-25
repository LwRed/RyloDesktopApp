const m = require('mithril');
const { dialog, process, app } = require('electron').remote;
const path = require('path');
const fs = require('fs');

// eslint-disable-next-line import/no-unresolved
const rylo = require('core-js/build/Release/core-js');
const { shell } = require('electron');
const Dialog = require('../models/Dialog');
const Editor = require('../models/Editor');
const Exports = require('../models/Exports');

const player = require('../player');

const utils = require('../utils');

//Beta15 - Declaration de variable globale
qhdVideo = false; // 3k bool
uhdVideo = false; // 4k bool

let wasCancelled = false;

const state = {
  file: null,
  video: 'hd',
  resolution : 'off',
  format: 'h264',
  sound: 'on',
  ending: 'none',
};

const form = [
  {
    name: 'video',
    title: 'Style de Vidéo',
    get values() {
      return Editor.asset && Editor.asset.is180() ? ['hd'] : ['hd', '360'];
    },
    details: {
      hd: ['Vidéo 2d', 'Format standard pour lecture sur les écrans d\'ordinateurs et TV'],
      360: ['Vidéo 360°', 'Format sphérique 360° pour affichage en réalité virtuelle'],
    },
  },
  {
    name: 'resolution',
    title: 'Choix de résolution',
    values: ['qhd', 'uhd', 'off'],
    details: {
      qhd: ['QHD 1620p', 'Encodage en 1620p (3k), idéal pour source 5.8k'],
      uhd: ['UHD 2160p', 'Encodage en Ultra HD 2160p (4k), expérimental'],
      off: ['Désactivé', 'Vidéo standard en 1080p ou pleine résolution pour le format 360°'],
    },
  },
  {
    name: 'format',
    title: 'Format Vidéo',
    get values() {
      return rylo.supportedVideoFormats();
    },
    details: {
      h264: ['H.264', 'Compromis idéal entre taille de fichier, qualité et temps d\'encodage'],
      h265: ['H.265 HEVC', 'Meilleure qualité mais nécessite un décodeur matériel ou logiciel HEVC'],
      prores: ['ProRes 422', 'Taille de fichier importante mais rapide et qualité parfaite. Le format d\'Apple est fait pour le retraitement professionnel.'],
    },
  },
  {
    name: 'sound',
    title: 'Audio',
    get values() {
      return (Editor.edits.volume == 0 || Editor.edits.speed > 1) ? [] : ['on', 'off'];
    },
    details: {
      on: ['Activé', 'Le son sera encodé en AAC avec un volume de {}%'],
      off: ['Désactivé', 'Le son ne sera pas encodé'],
    },
  },
  {
    name: 'ending',
    title: 'Vidéo de Fin',
    values: ['light', 'dark', 'none'],
    details: {
      light: ['Clair', 'La vidéo se conclura avec un fondu du logo sur fond clair'],
      dark: ['Sombre', 'La vidéo se conclura avec un fondu du logo sur fond sombre'],
      none: ['Désactivé', 'La vidéo se terminera sans effet de fondu'],
    },
  },
];

function selIdx(entry) {
  const val = state[entry.name];
  return entry.values.indexOf(val);
}

function entrySubtitle(entry) {
  const value = entry.details[state[entry.name]][1];
  return value.replace('{}', "" + Math.round(Editor.edits.volume * 100));
}

function onCancel() {
  Dialog.pop();
  wasCancelled = true;
  if (Exports.handle) {
    Exports.handle.cancel();
    Exports.handle = null;
  }
  
   //And Sending Message to main.js
   ipcRenderer.send('main-actions', {
    type: 'cancelledExport'
  })
  //Sending Message to main.js for Touch Bar Creation
  
  ipcRenderer.send('main-actions', {
    type: 'openedEditorView'
  })
  
}

function onExport() {
  //And Sending Message to main.js for Touch Bar Creation
  ipcRenderer.send('main-actions', {
    type: 'runnedExport'
  })
  

 
  ipcRenderer.send('save-dialog', {
    title: 'Sauvegarder',
    filters: [
      { name: 'Vidéo', extensions: ['mov'] }, //mov
    ],
    defaultPath: `*/${path.parse(Editor.file).name}_export`,
  }, 'save-file-chosen-video');
}


ipcRenderer.on('save-file-chosen-video', (eventEmitter, message) => {
  state.file = message;
  if (!state.file) {
    //Sending Message to main.js for Touch Bar Creation
  ipcRenderer.send('main-actions', {
    type: 'openedExportView'
  })
    return;
  }

  const isPackaged = !process.defaultApp;
  let outroSoundPath = `${app.getAppPath()}.unpacked/src/assets/outro-punch.m4a`;
  if (!isPackaged) {
    outroSoundPath = `${__dirname}/../assets/outro-punch.m4a`;
  }
  const shotOnImg = fs.readFileSync(`${__dirname}/../assets/outro-shot-on.png`);
  const logoImg = fs.readFileSync(`${__dirname}/../assets/outro-logo.png`);

  Exports.progress = 0;
  Exports.handle = new rylo.Export(Editor.file, Editor.projectFile, state.file);
  Exports.state = utils.deepCopy(state);

  if (state.video === '360') {
    const dims = Editor.asset.sizeForVR();
    Exports.handle.setDimensions(dims[0], dims[1]);
  } else {
    let dims = Editor.edits.aspect;
    dims = (dims[0] == 1 && dims[1] == 1) ? [1080, 1080] : dims.map(a => a * 120);
    //Beta15 - Test dimensions 2k
    if (qhdVideo == true) {Exports.handle.setDimensions(dims[0]*1.5, dims[1]*1.5);}
    else if (uhdVideo == true) {Exports.handle.setDimensions(dims[0]*2, dims[1]*2);}
    else {Exports.handle.setDimensions(dims[0], dims[1]);}
  }

  wasCancelled = false;

  Exports.handle.setVideoType(state.video);
  Exports.handle.setVideoFormat(state.format);
  Exports.handle.setVolume(state.sound === 'on' ? Editor.edits.volume : 0.0);
  Exports.handle.setSwapFrontBackLandscapeDirection(Editor.edits.invertFrontBackPosition);
  Exports.handle.setOutroType(state.ending, shotOnImg, logoImg, outroSoundPath);
  Exports.handle.start((progress) => {
    Exports.progress = progress;
    //m.redraw();
    ipcRenderer.send('export-progress', progress);
    //Beta14 - ipcRenderer for Export Progress on Touch Bar
    ipcRenderer.send('main-actions', {
      type: 'runnedExport'
    })
    m.redraw();
  }, (success) => {
    Dialog.pop();
    // Timelapse means that we don't always set progress to 1.0 for analytics. Force it.
    if (success) {
      Exports.progress = 1.0;
      //Sending Message to main.js for Touch Bar Creation
     ipcRenderer.send('main-actions', {
      type: 'openedEditorView'
    })
    
    }
    Exports.handle = null;
    m.redraw();
    ipcRenderer.send('export-progress', 1.0);
    if (!success) {
      alert('Une erreur est survenue pendant le rendu');
      //Sending Message to main.js for Touch Bar Creation
     ipcRenderer.send('main-actions', {
      type: 'openedEditorView'
    })
    }

    if (success && !wasCancelled) {
      const notification = new Notification('Export de la vidéo réussi !', {
        body: 'Cliquez ici pour ouvrir le Finder',
        //silent: true,
        silent: false,
      });

      notification.onclick = () => {
        shell.showItemInFolder(state.file);
      };
    }
  });
});

module.exports = {
  oninit() {
    //Sending Message to main.js for Touch Bar Creation
    ipcRenderer.send('main-actions', {
      type: 'openedExportView'
    })


    if (Editor.edits.volume == 0 || Editor.edits.speed > 1) {
      state.sound = 'off';
    }

    if (Editor.asset.is180()) {
      state.video = 'hd';
    }
  },
  view() {
    return m('Dialog.export[style=width:580px]', [
      m(Dialog.header, 'Module d\'Exportation'),

      m('ul',
        form.map(entry => entry.values.length === 0 ? [] : m("li", [
          m('img', {src: `assets/${entry.name}-${state[entry.name]}.svg`}),
          m('div', [
            m('h1', entry.title),
            m('h2', entrySubtitle(entry))
          ]),
          entry.values.length > 1 ? m('select', {
            name: entry.name,
            disabled: Exports.handle !== null || (entry.name == 'ending' && state.video !== 'hd') || (entry.name == 'resolution' && state.video !== 'hd'),
            selectedIndex: selIdx(entry),
            onchange() {
              state[entry.name] = entry.values[this.selectedIndex];
              if (state.video === '360') {
                state.resolution = 'off',
                state.ending = 'none';
              }
              if (state.resolution === 'qhd') {
                qhdVideo = true;
                uhdVideo = false;
              }
              else if (state.resolution === 'uhd') {
                qhdVideo = false;
                uhdVideo = true;
              }
              else if (state.resolution === 'off') {
                qhdVideo = false;
                uhdVideo = false;
              }
            }
          }, entry.values.map((val, idx) => {
            return m('option', {value: val}, entry.details[val][0]);
          })) : []
        ]))
      ),


       


      Exports.handle ? m('section', m('progress', {
        value: Exports.progress,
        max: 1,
      })) : [],

      m(Dialog.footer, [
        m('button', { onclick: onCancel }, 'Annuler'),
        Exports.handle ? [] : m('button', { onclick: onExport }, 'Exporter Mov'),
      ]),
    ]);
  },

  get cancellable() {
    return Exports.handle == null;
  },
};

// TOUCH BAR SECTION - DO NOT UNIFY CASE IN IPCRENDERER //

//Receiving Message from main.js
ipcRenderer.on('render-actions', (event, data = {}) => {
  switch (data.type) {
    case 'cancelExport':
      onCancel();
      m.redraw();
    case 'runExport':
      onExport();
      m.redraw();
    default:
      // no-op
  }
})


