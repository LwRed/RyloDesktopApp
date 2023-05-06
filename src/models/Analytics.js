const m = require('mithril');
const amplitude = require('amplitude-js/amplitude');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const Media = require('../models/Media');
const Editor = require('../models/Editor');
const utils = require('../utils');
const Exports = require('../models/Exports');
const EditorView = require('../views/EditorView');
const rylo = require('core-js/build/Release/core-js');

let hasLibraryLoaded = false;

// TODO utils.diff() doesn't work for Editor.assets
let lastLoadedUuid = null;
let lastExportHandle = null;

// Fudge factor used to dedupe events caused by loading.
let videoOpenTime = null;
let oldEditor = null;

const currentKeyframes = {};

function wasVideoRecentlyOpened() {
  return videoOpenTime == null || (Date.now() - videoOpenTime) < 500;
}

function getMediaSource(asset) {
  return (asset.path().indexOf(Media.sdCardPath) === 0) ? 'sd-card' : 'local';
}

function getMediaType(asset) {
  if (!asset.isVideo()) {
    return '360 Photo';
  }

  if (asset.is180()) {
    return '180 Video';
  }

  if (asset.is58K()) {
    return '5.8K 360 Video';
  }

  return '360 Video';
}

function getMediaDetailsJson(asset, uuid) {
  return {
    type: getMediaType(asset),
    duration: Math.floor(asset.duration()),
    media_uuid: uuid,
    size: Math.floor(fs.statSync(`${asset.path()}`).size / 1024 / 1024),
  };
}

function logMediaView() {
  const { asset } = Editor;
  if (!asset) {
    return;
  }

  asset.fetchUUID().then((uuid) => {
    try {
      if (uuid === lastLoadedUuid) {
        return;
      }
      lastLoadedUuid = uuid;
      videoOpenTime = Date.now();

      const details = getMediaDetailsJson(asset, uuid);
      details.source = getMediaSource(asset);
      amplitude.getInstance().logEvent('media_view', details);
    } catch (e) {
      console.error(e);
    }
  });
}

function logLibraryLoaded() {
  const { localList } = Media;
  if (hasLibraryLoaded || localList === undefined) {
    return;
  }

  hasLibraryLoaded = true;

  let libraryData = {};
  if (localList.length > 0) {
    libraryData = localList.reduce((accumulator, currentValue) => {
      accumulator.media_size += Math.floor((currentValue.size / 1024 / 1024));
      if (accumulator.newest_media_age < Math.round(currentValue.mtime.getTime() / 1000)) {
        accumulator.newest_media_age = Math.round(currentValue.mtime.getTime() / 1000);
      }
      return accumulator;
    }, {
      media_size: 0,
      newest_media_age: 0,
    });
  }
  libraryData.media_count = localList.length;
  amplitude.getInstance().logEvent('library_loaded', libraryData);
}

const editsLogHandlers = {
  stabilization(oldValue, newValue) {
    amplitude.getInstance().logEvent('stabilization_toggled', { enabled: newValue });
  },

  frontBack(oldValue, newValue) {
    amplitude.getInstance().logEvent('front_back_toggled', { mode: newValue });
  },

  invertFrontBackPosition(oldValue, newValue) {
    amplitude.getInstance().logEvent('swap_front_back_direction_toggled', { swapped: newValue });
  },
};

const editorDiffLogHandlers = {
  edits(edits) {
    Object.keys(edits).forEach((key) => {
      if (key in editsLogHandlers) {
        editsLogHandlers[key](oldEditor.edits[key], edits[key]);
      }
    });
  },

  isToolbarExpanded(value) {
    if (value) {
      const { asset } = Editor;
      if (!asset) {
        return;
      }

      asset.fetchUUID().then((uuid) => {
        try {
          const details = getMediaDetailsJson(asset, uuid);
          details.source = getMediaSource(asset);
          amplitude.getInstance().logEvent('media_edit_enter', details);
        } catch (e) {
          console.error(e);
        }
      });
    } else {
      amplitude.getInstance().logEvent('media_edit_exit');
    }
  },
};

function logMediaExport(isFinished, exportState) {
  const { asset, edits, defaultEdits } = Editor;

  const aspectJson = JSON.stringify(edits.aspect);
  let crop = 'portrait';
  if (aspectJson === JSON.stringify([1, 1])) {
    crop = 'square';
  } else if (aspectJson === JSON.stringify([16, 9])) {
    crop = 'landscape';
  } else if (aspectJson === JSON.stringify([21, 9])) {
    crop = 'cinema';
  }

  let outro = 'none';
  if (exportState.ending === 'light') {
    outro = 'light_fade';
  } else if (exportState.ending === 'dark') {
    outro = 'dark_fade';
  }

  const adjustedTunes = [];
  Object.keys(edits.adjustments).forEach((key) => {
    if (edits.adjustments[key] !== defaultEdits.adjustments[key]) {
      adjustedTunes.push(key);
    }
  });

  let speed = 1;
  let motionBlur = false;
  edits.timelapseSegments.forEach((current) => {
    speed = Math.max(speed, current.speed);
    motionBlur = (motionBlur || current.blur);
  });

  asset.fetchUUID().then((uuid) => {
    try {
      amplitude.getInstance().logEvent('media_export', {
        front_back: edits.frontBack,
        source: getMediaSource(asset),
        finished: isFinished,
        media_type: getMediaType(asset),
        export_type: exportState.video.toUpperCase(),
        audio_enabled: exportState.sound === 'on',
        stabilization: edits.stabilization === 1,
        speed,
        motion_blur: motionBlur,
        trim: JSON.stringify(edits.trim) !== JSON.stringify([0, 1]),
        media_uuid: uuid,
        tiny_planet: asset.anyKeyframeInTP(),
        crop,
        horizon: edits.levelRoll,
        horizon_angle: edits.rollAngle !== 0,
        keyframes: EditorView.player.keyframeCount(),
        outro,
        tune: adjustedTunes,
        media_duration: Math.floor(asset.duration()),
        export_duration: Math.floor(asset.exportDuration()),
      });
    } catch (e) {
      console.error(e);
    }
  });
}

function maybeLogVideoExport() {
  const { handle, progress, state } = Exports;

  if (lastExportHandle === handle) {
    return;
  }

  lastExportHandle = handle;

  // Only transition from Object -> null means an export finished or cancelled.
  if (lastExportHandle != null) {
    return;
  }

  logMediaExport(progress === 1.0, state);
}

function onKeyframesUpdated(keyframes, hasShownFrame) {
  try {
    if (keyframes.added) {
      const key = keyframes.added;
      currentKeyframes[key.id] = key.type;

      if (hasShownFrame) {
        amplitude.getInstance().logEvent('keyframe_add', { type: key.type });
      }
    }

    if (keyframes.removed) {
      keyframes.removed.forEach((key) => {
        if (hasShownFrame) {
          amplitude.getInstance().logEvent('keyframe_delete', { type: currentKeyframes[key] });
        }
        delete currentKeyframes.key;
      });
    }
  } catch (e) {
    console.error(e);
  }
}

ipcRenderer.on('keyframes-updated', (keyframes, hasShownFrame) => {
  onKeyframesUpdated(keyframes, hasShownFrame);
});

ipcRenderer.on('remove-all-keyframes', () => {
  try {
    amplitude.getInstance().logEvent('media_discard_keyframes');
  } catch (e) {
    console.error(e);
  }
});

ipcRenderer.on('remove-all-edits', () => {
  try {
    amplitude.getInstance().logEvent('media_discard_edits');
  } catch (e) {
    console.error(e);
  }
});

ipcRenderer.on('media-delete', (asset) => {
  try {
    asset.fetchUUID().then((uuid) => {
      try {
        const details = getMediaDetailsJson(asset, uuid);
        details.source = getMediaSource(asset);
        amplitude.getInstance().logEvent('media_delete', details);
      } catch (e) {
        console.error(e);
      }
    });
  } catch (e) {
    console.error(e);
  }
});
ipcRenderer.on('transfer-complete', (data) => {
  try {
    // Ignore .rylo files.
    if (!data.sourceFile.toUpperCase().endsWith('.MP4')) {
      return;
    }

    const asset = new rylo.Asset(data.sourceFile);
    asset.fetchUUID().then((uuid) => {
      try {
        const details = getMediaDetailsJson(asset, uuid);
        details.finished = data.didFinish;

        // May be null on error.
        const { fileInfo } = data;
        if (fileInfo) {
          details.age = Date.now() - fileInfo.mtime;
        }

        amplitude.getInstance().logEvent('media_download', details);
      } catch (e) {
        console.error(e);
      }
    });
  } catch (e) {
    console.error(e);
  }
});

ipcRenderer.on('photo-exported', (is360) => {
  try {
    logMediaExport(true, {
      video: is360 ? '360' : 'hd',
    });
  } catch (e) {
    console.error(e);
  }
});

module.exports = {
  view() {
    return m('');
  },
  onupdate() {
    try {
      const editorDiff = utils.objectDiff(Editor, oldEditor);

      logLibraryLoaded();
      logMediaView();
      maybeLogVideoExport();

      if (editorDiff && !wasVideoRecentlyOpened()) {
        Object.keys(editorDiff).forEach((key) => {
          if (key in editorDiffLogHandlers) {
            editorDiffLogHandlers[key](editorDiff[key]);
          }
        });
      }

      // Analytics is created before we have an asset loaded.
      if (Editor != null && Editor.asset != null) {
        oldEditor = utils.deepCopy(Editor);
      }
    } catch (e) {
      console.error(e);
    }
  },
};
