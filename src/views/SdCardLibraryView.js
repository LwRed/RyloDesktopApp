const m = require('mithril');
const fs = require('fs');

const Media = require('../models/Media');
const ThumbnailView = require('./ThumbnailView');
const EmptyLibraryView = require('./EmptyLibraryView');

module.exports = {
  oninit() {
    Media.startMonitoringSDCards();
  },
  onremove() {
    Media.stopMonitoringSDCards();
  },
  view(vnode) {
    return m('#library-sd',
      Media.sdCardList.length ?
      Media.sdCardList.map(file => m(ThumbnailView, {key: file.path, file: file}))
      :
      m(EmptyLibraryView, {
        title: 'Carte MicroSD',
        subtitle: 'Insérez votre carte MicroSD Rylo pour importer vos vidéos',
      },
      m('.sd-helper', [
        m('img', {src: 'assets/sd-nux-helper.svg'}),
        m('p', 'Votre carte MicroSD se trouve dans la trape sous la caméra Rylo.'),
        m('p', 'Appuyez doucement sur la carte MicroSD pour permettre son éjection.')
      ]))
    )
  }
};
