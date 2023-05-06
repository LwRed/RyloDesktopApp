const path = require('path');
const equal = require('deep-equal');
const rylo = require('core-js/build/Release/core-js');
const { ExifImage } = require('exif');
const { parse } = require('exif-date');

let asset = null;

rylo.Asset.prototype.is180 = function is180() {
  return this.videoTrackCount() == 1 && this.width() == 3008;
};

rylo.Asset.prototype.is58K = function is58K() {
  return this.videoTrackCount() == 2 && this.width() == 2912;
};

rylo.Asset.prototype.sizeForVR = function sizeForVR() {
  return [this.width() * this.videoTrackCount(), this.height()];
}

rylo.Asset.prototype.anyKeyframeInTP = function anyKeyframeInTP() {
  return this.anyKeyframeFOVInTP();
}

rylo.Asset.prototype.fetchUUID = function fetchUUID() {
  return new Promise((resolve, reject) => {
    // Cache the uuid so we dont' keep parsing from disk.
    if (this.cachedUUID) {
      resolve(this.cachedUUID);
    }

    if (this.isVideo()) {
      this.cachedUUID = this.uuid();
      resolve(this.cachedUUID);
    } else {
      try {
        const exif = new ExifImage({ image: this.path() }, (error, exifData) => {
          if (error) {
            reject(error);
          } else {
            const uuidString = exifData.exif.ImageUniqueID;
            const uuid = uuidString.replace(new RegExp('([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]+)'), '$1-$2-$3-$4-$5');
            this.cachedUUID = uuid;
            resolve(this.cachedUUID);
          }
        });
      } catch (error) {
        reject(error);
      }
    }
  });
};

rylo.Asset.prototype.fetchDateCreated = function fetchDateCreated() {
  return new Promise((resolve, reject) => {
    if (this.isVideo()) {
      const date = new Date(0);
      date.setUTCSeconds(this.timeCreated());
      resolve(date);
    } else {
      try {
        const exif = new ExifImage({ image: this.path() }, (error, exifData) => {
          if (error) {
            reject(error);
          } else {
            resolve(parse(exifData.exif.CreateDate));
          }
        });
      } catch (error) {
        reject(error);
      }
    }
  });
};

function defaultEdits() {
  return {
    aspect: [16, 9],
    trim: [0, 1],
    frontBack: 'off',   // circle, pill, split
    invertFrontBackPosition: false,
    levelRoll: true,
    rollAngle: 0,
    stabilization: 1,
    volume: 1,
    timelapseSegments: [],

    adjustments: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      highlights: 0,
      shadows: 0,
    },
  };
}

module.exports = {
  file: null,
  isToolbarExpanded: false,
  edits: defaultEdits(),

  setFile(path) {
    if (!path) {
      this.file = null;
      this.isToolbarExpanded = false;
      asset = null;
      return;
    }
    let newAsset = new rylo.Asset(path);
    if (newAsset.isValid()) {
      this.file = path;
      asset = newAsset;
    } else {
      alert('Ce fichier est incompatible');
    }
  },
  get asset() {
    return asset;
  },
  get projectFile() {
    let p = path.parse(this.file);
    delete p.base;
    p.ext = '.rylo';
    return path.format(p);
  },
  get defaultEdits() {
    return defaultEdits();
  },
  get hasEdits() {
    return !equal(this.edits, defaultEdits());
  },
}
