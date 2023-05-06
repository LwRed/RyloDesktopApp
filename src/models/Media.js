const m = require('mithril');
const fs = require('fs');
const electron = require('electron');
const { dialog } = require('electron').remote;
const rylo = require('core-js/build/Release/core-js');
const Editor = require('./Editor');

var volumesList = [];

function loadFileList(path, callback) {
  fs.readdir(path, (err, files) => {
    if (files) {
      try {
        files = files.filter(f => f.length > 1 && f[0] !== '.' && ['jpg', 'mp4'].includes(f.slice(-3).toLowerCase()))
          .map((f) => {
            const stat = fs.statSync(path + '/' + f);
            return {
              path: path + '/' + f,
              mtime: stat.mtime,
              size: stat.size,
            };
          })
          .sort((a, b) => b.mtime - a.mtime);
      } catch (e) {
        err = e;
        files = null;
      }
    }
    callback(err, files);
  });
}

function updateSDCardFiles() {
  if (volumesList.length) {
    Media.sdCardPath = volumesList[0];
    loadFileList(Media.sdCardPath, (err, files) => {
      Media.sdCardList = files || [];

      if (Editor.file && !Media.isFileInLibrary(Editor.file)) {
        Editor.setFile(null);
      }

      m.redraw();
    });
  } else {
    if (Media.sdCardList.map(f => f.path).indexOf(Editor.file) >= 0) {
      Editor.setFile(null);
    }
    Media.sdCardPath = null;
    Media.sdCardList.length = 0;
    m.redraw();
  }
}

function getLocalLibraryPath() {
  const path = window.localStorage.getItem('onMacLibraryPath');
  return (path && fs.existsSync(path)) ? path : null;
}

function onSelectLibraryPath(e) {
  // const mp4Dir = dialog.showOpenDialog({
  //   properties: ['openDirectory', 'createDirectory'],
  //   securityScopedBookmarks: true
  // })[0];
  const file = dialog.showOpenDialog(electron.remote.getCurrentWindow(), {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (file) {
    Media.setLocalLibraryPath(file[0]);
  }
}

let Media = {
  onSelectLibraryPath,
  localLibraryPath: getLocalLibraryPath(),
  localList: [],
  localListKeys: {},

  sdCardPath: null,
  sdCardList: [],

  keyForFile(file) {
    /**
     * Drop precision to seconds. Some sdcards will report 10 milliseconds different than macOS
     * 1541679737010 instead of 1541679737000 for example.
     */
    return `${Math.floor((file.mtime.getTime() / 1000))}:${file.size}`;
  },

  setLocalLibraryPath(path) {
    this.stopMonitoringLocalFiles();
    window.localStorage.setItem('onMacLibraryPath', path);
    this.localLibraryPath = path;
    this.startMonitoringLocalFiles();
  },
  
  startMonitoringLocalFiles() {
    const callback = (err, files) => {
      this.localList = files || [];
      this.localListKeys = {};
      this.localList.forEach(((f) => {
        this.localListKeys[this.keyForFile(f)] = f.path;
      }));

      if (Editor.file && !this.isFileInLibrary(Editor.file)) {
        Editor.setFile(null);
      }

      m.redraw();
    };
    if (this.localLibraryPath) {
      loadFileList(this.localLibraryPath, callback);
      fs.watch(this.localLibraryPath, (e, file) => {
        loadFileList(this.localLibraryPath, callback);
      });
    }
  },
  stopMonitoringLocalFiles() {
    if (this.localLibraryPath) {
      fs.unwatchFile(this.localLibraryPath);
    }
  },

  startMonitoringSDCards() {
    this.volumeObserver = this.volumeObserver || new rylo.VolumeObserver();
    this.volumeObserver.start((path, isMounted) => {
      path = path + '/DCIM/100MEDIA';
      if (isMounted) {
        if (fs.existsSync(path) && volumesList.indexOf(path) === -1) {
          volumesList.push(path);
          fs.watch(path, (e, file) => {
            updateSDCardFiles();
            if (Editor.file && !Media.isFileInLibrary(Editor.file)) {
              Editor.setFile(null);
            }
          });
        }
      } else {
        volumesList = volumesList.filter(p => p !== path);
      }
      updateSDCardFiles();
    });
  },
  stopMonitoringSDCards() {
    if (this.volumeObserver) {
      this.volumeObserver.stop();
    }
  },
  isFileInLibrary(path) {
    return (Media.sdCardList.map(f => f.path).indexOf(path) >= 0)
    || (Media.localList.map(f => f.path).indexOf(path) >= 0);
  },
};

module.exports = Media;
