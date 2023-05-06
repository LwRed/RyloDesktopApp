const {
  Menu, ipcRenderer, app, session,
} = require('electron');
const electron = require('electron');
const AppSetting = require('./app');

const dialog = electron.dialog || electron.remote.dialog;

let currentMediaType = null;

function menuEvent(eventName) {
  return (item, focusedWindow, event) => {
    if (focusedWindow) {
      focusedWindow.webContents.send(eventName);
    }
  };
}

function setCurrentMediaType(menu, newMediaType) {
  if (currentMediaType === newMediaType) {
    return;
  }
  currentMediaType = newMediaType;

  /* eslint no-param-reassign: "error" */
  menu.items.forEach((item) => {
    item.submenu.items.forEach((subitem) => {
      if (subitem.mediaType !== undefined) {
        subitem.enabled = subitem.mediaType.includes(currentMediaType);
      }
    });
  });
}
exports.setCurrentMediaType = setCurrentMediaType;

exports.openFile = function openFile(focusedWindow, event) {
  const extensions = ['mp4', 'jpg', 'rylo'];

  if (!AppSetting.isReleaseBuild()) {
    extensions.push('mov');
  }

  const file = dialog.showOpenDialog(focusedWindow || electron.remote.getCurrentWindow(), {
    properties: ['openFile'],
    filters: [
      { name: 'Fichiers Rylo', extensions },
      { name: 'Vidéos', extensions: ['mp4'] },
      { name: 'Photos', extensions: ['jpg'] },
      { name: 'Edition', extensions: ['rylo'] },
    ],
  });
  if (file) {
    app ? app.emit('open-file', event, file[0]) : ipcRenderer.send('open-file', file[0]);
  }
};

exports.setUpdateStatus = function setUpdateStatus(menu, status) {
  /* eslint no-param-reassign: "error" */
  menu.items[0].submenu.items.forEach((subitem) => {
    if (subitem.updateStatus !== undefined) {
      subitem.visible = subitem.updateStatus === status;
    }
  });
};

exports.buildMenu = function buildMenu(isDevMode) {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Ouvrir…',
          accelerator: 'CmdOrCtrl+O',
          click(item, focusedWindow, event) {
            exports.openFile(focusedWindow, event);
          },
        },
        {
          label: 'Ouvrir Récent',
          role: 'recentDocuments',
          submenu: [
            {
              label: 'Effacer les récents',
              role: 'clearRecentDocuments',
              click() {
                app.clearRecentDocuments();
              },
            },
          ],
        },
        {
          type: 'separator',
        },
        {
          mediaType: ['180', '360', 'photo'],
          label: 'Sauvegarder',
          accelerator: 'CmdOrCtrl+S',
          click: menuEvent('menu-save'),
        },
        // {
        //   isFileItem: true,
        //   label: 'Save Trimmed',
        //   accelerator: 'CmdOrCtrl+Shift+S',
        //   click: menuEvent('menu-save-trimmed')
        // },
        {
          mediaType: ['180', '360', 'photo'],
          label: 'Exporter…',
          accelerator: 'CmdOrCtrl+E',
          click: menuEvent('menu-export'),
        },
        {
          type: 'separator',
        },
        {
          label: 'Quitter',
          role: 'Quit',
        },
      ],
    },
    {
      label: 'Vidéo courante',
      submenu: [
        {
          mediaType: ['180', '360'],
          label: 'Joue / Pause',
          accelerator: 'Space',
          click: menuEvent('menu-play-pause'),
        },
        {
          mediaType: ['180', '360'],
          label: 'Image suivante',
          accelerator: 'Right',
          click: menuEvent('menu-next-frame'),
        },
        {
          mediaType: ['180', '360'],
          label: 'Image précédente',
          accelerator: 'Left',
          click: menuEvent('menu-previous-frame'),
        },
        {
          type: 'separator',
        },
        {
          mediaType: ['180', '360'],
          label: 'Définit image de début',
          accelerator: 'I',
          click: menuEvent('menu-trim-start'),
        },
        {
          mediaType: ['180', '360'],
          label: 'Définit image de fin',
          accelerator: 'O',
          click: menuEvent('menu-trim-end'),
        },
        {
          mediaType: ['180', '360'],
          label: 'Réinitialiser Début / Fin',
          accelerator: 'CmdOrCtrl+T',
          click: menuEvent('menu-reset-trim'),
        },
        {
          type: 'separator',
        },
        {
          label: 'Affichage plein écran',
          role: 'toggleFullScreen',
        },
      ],
    },
    {
      label: 'Edition',
      submenu: [
        {
          isFileItem: true,
          label: 'Annuler',
          role: 'Undo',
        },
        {
          isFileItem: true,
          label: 'Refaire',
          role: 'Redo',
        },
        {
          type: 'separator',
        },
        {
          mediaType: ['360'],
          label: 'Ajouter un Point',
          accelerator: 'CmdOrCtrl+P',
          click: menuEvent('menu-add-point'),
        },
        {
          mediaType: ['360'],
          label: 'Effacer le Point',
          accelerator: 'Backspace',
          click: menuEvent('menu-remove-keyframe'),
        },
        {
          mediaType: ['360'],
          label: 'Effacer tous les Points',
          accelerator: 'CmdOrCtrl+Backspace',
          click: menuEvent('menu-remove-all-keyframes'),
        },
        {
          mediaType: ['180', '360'],
          label: 'Réinitialiser la Vue',
          accelerator: 'CmdOrCtrl+R',
          click: menuEvent('menu-reset-orientation'),
        },
      ],
    },
    // {
    //   label: 'Account',
    //   submenu: [
    //     {
    //       label: 'Sign Out',
    //       click: menuEvent('menu-signout')
    //     }
    //   ]
    // },
    {
      role: 'window',
      submenu: [
        {
          label: 'Réduire',
          role: 'minimize',
        },
        {
          label: 'Fermer',
          role: 'close',
        },
      ],
    },
    {
      label: 'Aide',
      role: 'help',
      submenu: [
        {
          label: 'En savoir plus',
          click() { electron.shell.openExternal('http://www.rylo.fr'); },
        },
      ],
    },
  ];

  if (isDevMode) {
    template[2].submenu.unshift(
      {
        label: 'Reload',
        accelerator: 'Alt+CmdOrCtrl+R',
        click(item, focusedWindow) {
          if (focusedWindow) {
            focusedWindow.reload();
          }
        },
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click(item, focusedWindow) {
          if (focusedWindow) {
            focusedWindow.webContents.toggleDevTools();
          }
        },
      },
      {
        label: 'Reset Caches',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+R' : 'Ctrl+Shift+R',
        click(item, focusedWindow) {
          const ses = session.defaultSession;
          ses.clearCache(() => {
            ses.clearStorageData();
          });
        },
      },
      {
        type: 'separator',
      },
    );
  }

  if (process.platform === 'darwin') {
    const name = app.getName();
    template.unshift({
      label: name,
      submenu: [
        {
          label: 'A propos',
          role: 'about',
        },
        {
          updateStatus: 'unknown',
          label: 'Chercher Mise à jour…',
          click(item, focusedWindow) {
            app ? app.emit('check-for-updates') : ipcRenderer.send('check-for-updates');
          },
        },
        {
          updateStatus: 'downloading',
          label: 'Téléchargement Mise à jour…',
          enabled: false,
          visible: false,
        },
        {
          updateStatus: 'downloaded',
          label: 'Installer la mise à jour',
          click(item, focusedWindow) {
            app ? app.emit('install-and-relaunch') : ipcRenderer.send('install-and-relaunch');
          },
          visible: false,
        },
        {
          type: 'separator',
        },
        {
          label: 'Preférences…',
          accelerator: 'Command+,',
          click: menuEvent('menu-preferences'),
        },
        {
          role: 'services',
          submenu: [],
        },
        {
          type: 'separator',
        },
        {
          label: 'Cacher Rylo',
          role: 'hide',
        },
        {
          label: 'Cacher les autres',
          role: 'hideothers',
        },
        {
          label: 'Montrer',
          role: 'unhide',
        },
        {
          type: 'separator',
        },
        {
          label: 'Quitter',
          role: 'quit',
        },
      ],
    });
    // Window menu.
    template[5].submenu = [
      {
        label: 'Réduire',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize',
      },
      {
        type: 'separator',
      },
      {
        label: 'Mettre au premier plan',
        role: 'front',
      },
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  setCurrentMediaType(menu, 'none');
  Menu.setApplicationMenu(menu);
};
