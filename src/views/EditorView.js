const m = require('mithril');
const path = require('path');
const fs = require('fs');

const { Player } = require('../player');
const utils = require('../utils');
const menu = require('../menu');

const Dialog = require('../models/Dialog');
const Editor = require('../models/Editor');

const StillSettingsDialog = require('./StillsSettingsDialog');
const VideoExportDialog = require('./VideoExportDialog');
const ToolbarView = require('./ToolbarView');

var oldEditor = {};
var player = null;

window.addEventListener('keydown', (e) => {
  if (!player) {
    return;
  }

  if (e.keyCode === 32) {
    // space bar
    player.setRate(player.rate ? 0 : 1);
  } else if (e.keyCode === 39) {
    // right arrow key
    player.stepByCount(1);
  } else if (e.keyCode === 37) {
    // left arrow key
    player.stepByCount(-1);
  } 
  // prevent tab, enter, space bar and arrow keys from triggering
  if ([9, 13, 32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
    e.preventDefault();
  }
}, false);

ipcRenderer.on('open-file', (event, file) => {
  const p = path.parse(file);
  if (p.ext === '.rylo') {
    file = null;
    delete p.base;
    for (ext of ['.mp4', '.mov', '.MP4', '.MOV', '.jpg', '.JPG']) {
      p.ext = ext;
      let f = path.format(p);
      if (fs.existsSync(f)) {
        file = f;
        break;
      }
    }
  }
  if (file) {
    Editor.setFile(file);
    m.redraw();
  }
});

ipcRenderer.on('menu-save', e => {
  player.postMessage({saveEdits: true});
});

ipcRenderer.on('menu-export', (e) => {
  if (Dialog.dialogs.length > 0) {
    return;
  }
  player.postMessage({ saveEdits: true });
  player.setRate(0);
  if (Editor.asset.isVideo()) {
    Dialog.push(VideoExportDialog);
  } else {
    StillSettingsDialog.setCaptureCallback('Export', (filename, type) => {
      player.onStillCaptured(filename, type);
    });
    Dialog.push(StillSettingsDialog);
  }
  m.redraw();
});

ipcRenderer.on('menu-play-pause', (e) => {
  player.setRate(player.rate ? 0 : 1);
});

ipcRenderer.on('menu-next-frame', (e) => {
  player.stepByCount(1);
});

ipcRenderer.on('menu-previous-frame', (e) => {
  player.stepByCount(-1);
});

ipcRenderer.on('menu-reset-orientation', (e) => {
  player.resetOrientation();
});

ipcRenderer.on('menu-trim-start', (e) => {
  player.timelines.forEach((current) => {
    current.setTrimStart();
  });
  m.redraw();
});

ipcRenderer.on('menu-trim-end', (e) => {
  player.timelines.forEach((current) => {
    current.setTrimEnd();
  });
  m.redraw();
});

ipcRenderer.on('menu-reset-trim', (e) => {
  player.timelines.forEach((current) => {
    current.resetTrim();
  });
  m.redraw();
});

ipcRenderer.on('menu-add-point', (e) => {
  player.addPoint();
});

ipcRenderer.on('menu-remove-keyframe', (e) => {
  player.removeKeyframe();
});

ipcRenderer.on('menu-remove-all-keyframes', (e) => {
  player.removeAllKeyframes();
});

function EmptyView() {
  return m('Player',
    m('figure', [
      m('h1', 'Rylo pour macOS'),
      m('img', { src: 'assets/add-video.svg', onclick(e) {
        menu.openFile(null, e);
      }}),
      m('h3', 'Glissez et Déposez une vidéo Rylo ici pour commencer'),
    ]),
  );
}

function setCurrentMediaType(mediaType) {
  menu.setCurrentMediaType(menu.menu, mediaType);
}

const EditorView = {
  oncreate(vnode) {
    player = new Player(Editor.asset, Editor.projectFile, vnode.dom);
    oldEditor = utils.deepCopy(Editor);
        //And Sending Message to main.js for Touch Bar Creation
        ipcRenderer.send('main-actions', {
          type: 'openedEditorView'
        })
  },
  onupdate(vnode) {
    const diff = utils.objectDiff(Editor, oldEditor);
    oldEditor = utils.deepCopy(Editor);
    if (!diff) {
      return;
    }

    if ('file' in diff) {
      player = new Player(Editor.asset, Editor.projectFile, vnode.dom);
    }
    if ('edits' in diff) {
      player.postMessage(diff.edits);
    }

    setCurrentMediaType(!Editor.asset.isVideo() ? 'photo' : Editor.asset.is180() ? '180' : '360');
  },
  view() {
    return m('Player');
  },
};

module.exports = {
  view() {
    return Editor.file ? [m(EditorView), m(ToolbarView)] : EmptyView();
  },
  get player() {
    return player;
  },
};

// TOUCH BAR SECTION - DO NOT UNIFY CASE IN IPCRENDERER //

//Receiving Message from main.js
ipcRenderer.on('render-actions', (event, data = {}) => {
  switch (data.type) {
    case 'addPoint':
      player.addPoint();
      //And Sending Message to main.js
      ipcRenderer.send('main-actions', {
        type: 'addedPoint'
      })

    default:
      // no-op
  }
})
//Receiving Message from main.js
ipcRenderer.on('render-actions', (event, data = {}) => {
  switch (data.type) {
    case 'delPoint':
      player.removeKeyframe();
      //And Sending Message to main.js
      ipcRenderer.send('main-actions', {
        type: 'deletedPoint'
      })

    default:
      // no-op
  }
})
//Receiving Message from main.js
ipcRenderer.on('render-actions', (event, data = {}) => {
  switch (data.type) {
    case 'playStop':
      player.setRate(player.rate ? 0 : 1);
      //And Sending Message to main.js
      ipcRenderer.send('main-actions', {
        type: 'playedStopped'
      })

    default:
      // no-op
  }
})
