const m = require('mithril');

const Media = require('../models/Media');
const ThumbnailView = require('./ThumbnailView');
const EmptyLibraryView = require('./EmptyLibraryView');

module.exports = {
  oninit() {
    Media.startMonitoringLocalFiles();
  },
  onremove() {
    Media.stopMonitoringLocalFiles();
  },
  view(vnode) {
    return m('#library-mac',
      Media.localLibraryPath ?
      Media.localList.map(file => m(ThumbnailView, { key: file.path, file: file }))
      :
      m(EmptyLibraryView, {
        title: 'Ce Mac',
        subtitle: 'Sélectionner un dossier pour chercher des fichiers Rylo',
        button: 'Sélectionnez un dossier',
        onclick: Media.onSelectLibraryPath,
      })
    )
  }
};
