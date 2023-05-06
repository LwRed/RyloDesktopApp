const m = require('mithril');
const path = require('path');

const rylo = require('core-js/build/Release/core-js');
const utils = require('../utils');
const Editor = require('../models/Editor');
const Media = require('../models/Media');
const Transfers = require('../models/Transfers');
const Dialog = require('../models/Dialog');

const DetailsDialog = require('./DetailsDialog');

function srcFromMedia(src) {
  return 'rylothm://' + src;
}

const intersectionObserver = new IntersectionObserver((objects) => {
  for (o of objects.filter(o => o.isIntersecting)) {
    o.target.src = srcFromMedia(o.target.attributes[0].nodeValue);
    intersectionObserver.unobserve(o.target);
  }
}, {
  root: null,
  rootMargin: '0px',
  threshold: 0,
});

const LazyImg = {
  oncreate(vnode) {
    intersectionObserver.observe(vnode.dom);
  },
  onremove(vnode) {
    if (vnode.dom) {
      intersectionObserver.unobserve(vnode.dom);
    }
  },
  view(vnode) {
    return m('img', vnode.attrs, vnode.children);
  },
};

const DownloadElement = {
  view(vnode) {
    const { progress } = vnode.attrs;
    return progress === -1 ? m('input', {
      type: 'image',
      src: 'assets/import-overlay.svg',
      onclick() {
        const fileName = path.parse(vnode.attrs.src).base;
        Transfers.addFile(vnode.attrs.src, Media.localLibraryPath + '/' + fileName, '.rylo');

        // Lose focus
        vnode.dom.blur();
      },
    }) : m('button.cancel', {
      onclick() {
        Transfers.removeFile(vnode.attrs.src);
      },
    }, [
      m('img', { src: 'assets/import-cancel.svg' }),
      m('p', Math.round(progress * 100) + '%')
    ]);
  },
};

const DetailsElement = {
  view(vnode) {
    return m('input', {
      type: 'image',
      src: 'assets/details.svg',
      style: 'width: 10px',
      onclick() {
        // Lose focus
        vnode.dom.blur();
        Dialog.push(DetailsDialog, { src: vnode.attrs.src });
      },
    });
  },
};

module.exports = {
  file: null,
  asset: null,
  removed: false,
  isOnSD: false,
  wasDownloaded: false,

  isOnSD() {
    return this.file.path.indexOf(Media.sdCardPath) === 0;
  },

  view(vnode) {
    let self = this;
    this.file = vnode.attrs.file;
    this.isOnSD = this.file.path.indexOf(Media.sdCardPath) === 0;
    this.wasDownloaded = this.isOnSD && Media.keyForFile(this.file) in Media.localListKeys;
    let progress = Transfers.progressForFile(self.file.path);

    return this.removed ? [] : m('LibraryThumbnail', {
      class: Editor.file == self.file.path ? 'selected' : this.asset ? '' : 'hidden',
    }, [
      m(LazyImg, {
        media: this.file.path,
        onclick() {
          Editor.setFile(self.file.path);
        },
        onload() {
          // lazy fetch the asset info when the thumbnail loads
          const asset = new rylo.Asset(self.file.path);
          if (asset.isValid()) {
            self.asset = asset;
          } else {
            self.removed = true;
          }
        },
        onerror() {
          self.removed = true;
        },
      }),
      this.asset ? m('.label', [
        progress === -1 ? m(DetailsElement, {src: self.file.path, isOnSD: this.isOnSD}) : [],
        this.wasDownloaded ?
          m('img', {src: 'assets/import-overlay-thismac.svg'}) :
          this.isOnSD ? m(DownloadElement, {src: self.file.path, progress: progress}) : [],
          this.asset.isVideo() ? m('p', utils.durationString(this.asset.duration())) : [],
      ]) : [],
    ]);
  },
};
