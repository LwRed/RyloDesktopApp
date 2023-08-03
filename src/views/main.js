const electron = require('electron');
const { ipcMain, protocol, Menu } = require('electron');
// Start - Touch Bar Declare
const { TouchBar } = require('electron');
const { TouchBarLabel, TouchBarButton, TouchBarSpacer, TouchBarSegmentedControl } = TouchBar;
// End - Touch Bar Declare

const { app } = electron;
const { BrowserWindow, dialog } = electron;
// eslint-disable-next-line import/no-unresolved
const rylo = require('core-js/build/Release/core-js'); // core-js/build/Release/core-js
const { autoUpdater } = require('electron-updater');

const path = require('path');
const menu = require('./menu');
const CrashReporter = require('./crashreporter');

let win;
let requestedFile = null;

const isPackaged = !process.defaultApp;

let playerLib = `${app.getAppPath()}.unpacked/bin/libplayer.dylib;application/x-aurora`;
if (!isPackaged) {
  playerLib = `${__dirname}/../bin/libplayer.dylib;application/x-aurora`;
}
app.commandLine.appendSwitch('register-pepper-plugins', playerLib);

CrashReporter.start(isPackaged);
// App events

app.on('ready', () => {
  protocol.registerBufferProtocol('rylothm', (request, callback) => {
    const ryloPath = request.url.replace('rylothm://', '');
    rylo.generate(ryloPath, 400, 200, 0, 95, (err, img) => {
      callback({ mimeType: 'image/bmp', data: img });
    });
  }, (error) => {
    if (error) {
      console.error('Failed to register protocol');
    }
  });

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 950,
    minHeight: 500,
    webPreferences: {
      plugins: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  win.loadURL(`file://${__dirname}/app.html?release=${isPackaged ? 1 : 0}`);
  menu.buildMenu(!isPackaged);
  

  win.once('ready-to-show', (event) => {
    win.show();
    autoUpdater.checkForUpdatesAndNotify();

    if (!isPackaged) {
      autoUpdater.updateConfigPath = path.join(__dirname, '../dev-app-update.yml');
    }
    autoUpdater.checkForUpdates();

    autoUpdater.on('update-downloaded', () => {
      menu.setUpdateStatus(Menu.getApplicationMenu(), 'downloaded');
    });

    autoUpdater.on('download-progress', (data) => {
      menu.setUpdateStatus(Menu.getApplicationMenu(), 'downloading');
    });

    if (requestedFile) {
      const filepath = requestedFile;
      requestedFile = null;
      app.emit('open-file', event, filepath);
    }
  });
});

app.on('open-file', (event, filepath) => {
  if (win) {
    app.addRecentDocument(filepath);
    win.webContents.send('open-file', filepath);
  } else {
    requestedFile = filepath;
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('export-progress', (event, progress) => {
  if (win) {
    win.setProgressBar(progress < 1.0 ? progress : -1);
  }
});

app.on('check-for-updates', () => {
  autoUpdater.checkForUpdates().then((result) => {
    if (app.getVersion() < result.updateInfo.version) {
      dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: 'info',
        buttons: ['Télécharger', 'Annuler'],
        defaultId: 0,
        cancelId: 1,
        message: 'Une nouvelle version de Rylo est disponible',
      }, (response) => {
        if (response === 0) {
          autoUpdater.downloadUpdate(result.cancellationToken);
        }
      });
    } else {
      dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        cancelId: 0,
        message: 'Vous disposez de la dernière version de Rylo',
      });
    }
  }).catch(() => {
    dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
      type: 'info',
      buttons: ['OK'],
      defaultId: 0,
      cancelId: 0,
      message: 'Erreur de connexion Internet...',
    });
  });
});

app.on('install-and-relaunch', () => {
  autoUpdater.quitAndInstall();
});

// IPC events

ipcMain.on('open-file', (event, filepath) => {
  app.emit('open-file', event, filepath);
});

ipcMain.on('export-progress', (event, percent) => {
  app.emit('export-progress', event, percent);
});

ipcMain.on('save-dialog', (event, data, key) => {
  if (win) {
    const filePath = dialog.showSaveDialog(win, data);
    event.sender.send(key, filePath);
  }
});

// TOUCH BAR SECTION - DON'T WORK WITH LAST ELECTRON VERSION //

//Sending to EditorView.js
const onAddPoint = () => {
  const window = BrowserWindow.getFocusedWindow();
  window.webContents.send('render-actions', { 
    type: 'addPoint' 
  });
};

//Sending to EditorView.js
const onDelPoint = () => {
  const window = BrowserWindow.getFocusedWindow();
  window.webContents.send('render-actions', { 
    type: 'delPoint' 
  });
};

//Sending to EditorView.js
const onPlayStop = () => {
  const window = BrowserWindow.getFocusedWindow();
  window.webContents.send('render-actions', { 
    type: 'playStop' 
  });
};

//Sending to VideoExportView.js
const onCancelExport = () => {
  const window = BrowserWindow.getFocusedWindow();
  window.webContents.send('render-actions', { 
    type: 'cancelExport' 
  });
};
//Sending to VideoExportView.js
const onRunExport = () => {
  const window = BrowserWindow.getFocusedWindow();
  window.webContents.send('render-actions', { 
    type: 'runExport' 
  });
};
//Sending to VideoExportView.js
const onRunExportMP4 = () => {
  const window = BrowserWindow.getFocusedWindow();
  window.webContents.send('render-actions', { 
    type: 'runExportMP4' 
  });
};

//Receiving from EditorView.js, VideoExportDialog.js
ipcMain.on('main-actions', (event, data = {}) => {
  switch (data.type) {
    case 'openedEditorView':
      return initTouchBarFromEditorView();
    case 'openedExportView':
      return initTouchBarFromExportView();
    case 'runnedExport':
      return initTouchBarFromExportViewRunning();
    case 'playedStopped':
      //return initTouchBarWithJouee();
    case 'deletedPoint':
      //return initTouchBarWithAdd();

    default:
      // no-op
  }
})

//Create Touch Bar from Editor View Options
function initTouchBarFromEditorView() {
  const window = BrowserWindow.getFocusedWindow();

  const touchBar = new TouchBar({
    items: [
      new TouchBarButton({
        label: 'Ajouter Point',
        backgroundColor: '#F02A20',
        click: () => {
          onAddPoint();
          console.log('Add Point');
        },
      }),
      new TouchBarButton({
        label: 'Lire / Arrêter',
        backgroundColor: '#66A7FF',
        click: () => {
          onPlayStop();
          console.log('Play Pause');
        },
      }),
      new TouchBarButton({
        label: 'Supprimer Point',
        backgroundColor: '#F02A20',
        click: () => {
          onDelPoint();
          console.log('Remove Point');
        },
      }),
      new TouchBarSpacer({ size: 'flexible' }),
      new TouchBarLabel({ label: 'Clic droit pour Suivre', textColor: '#FFFFFF' }),
    ]
  });
    //window.setTouchBar(touchBar);
  // ✔️ This will only set the value if the input exists
if (touchBar) {
  window.setTouchBar(touchBar);
}
}

//Create Touch Bar from Editor View Options
function initTouchBarFromExportView() {
  const window = BrowserWindow.getFocusedWindow();

  const touchBar = new TouchBar({
    items: [
      new TouchBarButton({
        label: 'Annuler',
        backgroundColor: '#696969',
        click: () => {
          onCancelExport();
          console.log('Annuler Export');
        },
      }),
      new TouchBarButton({
        label: 'Exporter en Mov',
        backgroundColor: '#F02A20',
        click: () => {
          onRunExport();
          console.log('Démarrer Export');
        },
      }),
    ]
  });
    //window.setTouchBar(touchBar);
  // ✔️ This will only set the value if the input exists
if (touchBar) {
  window.setTouchBar(touchBar);
}
}

//Create Touch Bar from Editor View with Running Export
function initTouchBarFromExportViewRunning() {
  const window = BrowserWindow.getFocusedWindow();

  const touchBar = new TouchBar({
    items: [
      new TouchBarButton({
        label: 'Annuler',
        backgroundColor: '#696969',
        click: () => {
          onCancelExport();
          console.log('Annuler Export');
        },
      })
    ]
  });
  //window.setTouchBar(touchBar);
  // ✔️ This will only set the value if the input exists
if (touchBar) {
  window.setTouchBar(touchBar);
}
}

// END TOUCH BAR SECTION //