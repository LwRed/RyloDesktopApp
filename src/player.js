const m = require('mithril');
const path = require('path');
const { shell } = require('electron');
const { dialog } = require('electron').remote;
const html = require('./html');
const utils = require('./utils');
const { Timeline } = require('./timeline');
const rylo = require('core-js/build/Release/core-js');
const resize = require('./resize');
const Editor = require('./models/Editor');
const Dialog = require('./models/Dialog');
const StillsSettingsDialog = require('./views/StillsSettingsDialog');

/* eslint no-param-reassign: ["error", { "props": false }] */
function animateViewDown(view, onFinish) {
  const timings = {
    easing: 'ease-in-out',
    iterations: 1,
    direction: 'normal',
    fill: 'both',
  };

  timings.duration = 250;
  view.animate([
    { transform: 'translateY(0)' },
    { transform: 'translateY(50px)' },
  ], timings);

  timings.duration = 250;
  view.animate([
    { opacity: 1 },
    { opacity: 0 },
  ], timings).onfinish = onFinish;
}

function animateViewUp(view) {
  const timings = {
    easing: 'ease-in-out',
    iterations: 1,
    direction: 'normal',
    fill: 'both',
  };

  timings.duration = 250;
  view.animate([
    { transform: 'translateY(50px)' },
    { transform: 'translateY(0)' },
  ], timings);
  timings.duration = 250;
  view.animate([
    { opacity: 0 },
    { opacity: 1 },
  ], timings);
}

class Player {
  constructor(asset, projectFile, container) {
    this.didShowFrame = false;
    this.asset = asset;
    this.currentTimelineIndex = 0;
    resize.removeAllResizeListeners(container);
    html.clearChildren(container);
    this.container = container;

    const exportButton = html.create('<input type="image" src="assets/export-min.svg"/>');
   
    exportButton.onclick = (e) => {
      this.postMessage({ saveEdits: true });
      ipcRenderer.emit('menu-export');
      // Remove focus
      exportButton.blur();
    };
    this.header = document.createElement('header');
    this.header.appendChild(exportButton);
    this.container.appendChild(this.header);

    this.timelineDivs = [document.createElement('div'), document.createElement('div')];
    this.timelineDivs[0].style.display = 'block';
    this.timelineDivs[1].style.display = 'none';
    this.timelines = [new Timeline(this.timelineDivs[0]), new Timeline(this.timelineDivs[1])];

    this.timelines.forEach((current) => {
      current.onSeekStart = (e) => { this.onSeekStart(e); };
      current.onSeekEnd = (e) => { this.onSeekEnd(e); };
      current.onSeekDrag = (e) => { this.onSeekDrag(e, current); };
    });

    this.videoAspectDiv = document.createElement('div');
    this.video = html.create(`<embed id="native-player" path="${asset.path()}" rylo="${projectFile}" type="application/x-aurora"/>`);
    this.video.addEventListener('message', (ev) => { this.onMessage(ev); }, true);
    this.container.appendChild(this.videoAspectDiv);

    this.footer = html.create('<footer></footer>');
    this.zoomRangeContainer = html.create('<div class="zoomRangeContainer" />');
    this.zoomRangeContainer.appendChild(html.create('<span class="zoomRange" />'));
    this.zoomRangeContainer.appendChild(html.create('<span class="zoomRange" />'));
    this.zoomRangeContainer.appendChild(html.create('<span class="zoomRange current" />'));
    this.zoomRangeContainer.appendChild(html.create('<span class="zoomRange" />'));
    this.zoomRangeContainer.appendChild(html.create('<span class="zoomRange" />'));
    
    if (!Editor.asset.is180()) {
      this.container.appendChild(this.zoomRangeContainer);
    }
    
    if (Editor.asset.isVideo()) {
      this.container.appendChild(this.footer);
    } else {
      this.zoomRangeContainer.style.marginBottom = '30px';
    }

    this.playButton = html.create('<input class="play" type="submit" name="" value=""/>');
    this.playButton.onclick = (e) => {
      this.setRate(this.rate ? 0 : 1);
    };

    this.timeLabel = html.create('<ul><li>0:00</li><li>0:00</li></ul>');

    this.footer.appendChild(this.playButton);
    this.footer.appendChild(this.timelineDivs[0]);
    this.footer.appendChild(this.timelineDivs[1]);
    this.footer.appendChild(this.timeLabel);

    if (!asset.is180()) {
      this.addPointInput = html.create('<input type="image" src="assets/add-point.svg" class="addPoint"/>');
      this.addPointInput.onclick = (e) => {
        if (e.target.classList.contains('remove')) {
          this.removeKeyframe();
        } else {
          this.addPoint();
        }
      };
      this.footer.appendChild(this.addPointInput);
    }

    this.takeStillInput = html.create('<input type="image" src="assets/still.svg" class="takeStill"/>');
    this.takeStillInput.onclick = () => {
      StillsSettingsDialog.setCaptureCallback('Module de Capture Photo', (filename, type) => {
        this.onStillCaptured(filename, type);
      });

      Dialog.push(StillsSettingsDialog);
      m.redraw();
    };
    this.footer.appendChild(this.takeStillInput);

    this.addSpeedInput = html.create('<input type="image" src="assets/speed.svg" class="addSpeed"/>');
    this.addSpeedInput.onclick = (e) => {
      if (!e.target.classList.contains('disabled')) {
        // Don't pass the click event to the Timeline as it has a listener
        // which will remove all tooltips.
        e.stopPropagation();
        this.maybeAddTimepoint(2);
      }
    };
    this.footer.appendChild(this.addSpeedInput);

    // only insert the video element into DOM once we've configred the timeline, since
    // once the video element loads we'll get timeline callbacks to add keyframes
    this.videoAspectDiv.appendChild(this.video);

    this.timelines.forEach((current) => {
      current.setDuration(asset.duration());
    });

    this.timeLabel.lastChild.innerHTML = utils.durationString(asset.duration());

    this.rate = 0;
    this.setSizeForAspect(Editor.edits.aspect);
    resize.addResizeListener(this.container, () => {
      this.layoutPlayer();
    });
  }

  onStillCaptured(filename, type) {
    if (!filename) {
      return;
    }

    const is360 = (type === '360');
    this.postMessage({
      captureStill: { is360, filename },
    });
  }

  setSize(width, height) {
    this.video.style.width = width + 'px';
    this.video.style.height = height + 'px';
    this.video.style.marginLeft = (-width * 0.5) + 'px';
    this.video.style.marginTop = (-height * 0.5 - 10) + 'px';
  
    this.layoutPlayer();
  }

  setSizeForAspect(aspect) {
    if (aspect[0] === 1 && aspect[1] === 1) {
      this.setSize(640, 640);
    } else {
      this.setSize(aspect[0] * 60, aspect[1] * 60);
    }
  }

  layoutPlayer() {
    const ps = window.getComputedStyle(this.video.parentElement);
    const vs = window.getComputedStyle(this.video);
    const scale = Math.min(
      parseFloat(ps.width) / parseFloat(vs.width),
      parseFloat(ps.height) / parseFloat(vs.height),
    );
    this.video.style.transform = `scale(${scale})`;
  }

  resetOrientation() {
    this.postMessage({ resetOrientation: true });
  }

  addPoint() {
    this.postMessage({ addPoint: true });
  }

  removeKeyframe() {
    this.postMessage({ removeKeyframe: true });
  }

  removeAllKeyframes() {
    this.postMessage({ removeAllKeyframes: true });
  }

  removeAllTimelapseSegments() {
    Editor.timelapseSegments = [];
    this.timelines[this.currentTimelineIndex].reconcileTimelapseTimelineWithEditor();
  }

  setRate(rate) {
    if (rate > 0 && this.timelines[0].isAtEndTime) {
      this.postMessage({ seek: this.timelines[0].startTime });
    }
    this.postMessage({ rate });
  }

  onSeekStart(event) {
    this.isSeeking = true;
  }

  onSeekDrag(event, timeline) {
    const time = timeline.currentTime;
    // Keep the inactive timeline in sync
    this.timelines.forEach((current) => {
      if (current !== timeline) {
        current.setCurrentTime(time);
      }
    });
    this.postMessage({ seek: time });
  }

  onSeekEnd(event) {
    this.isSeeking = false;
  }

  stepByCount(count) {
    // We don't set playbackStartTime to make the math easier, so we need to manually handle trim start stepping.
    if (count < 0 && this.timelines[0].isAtStartTime) {
      return;
    }
    this.postMessage({ step: count });
  }

  // The current loaded video might have unsaved keyframes
  keyframeCount() {
    let keyframes = 0;
    this.timelines.forEach((current) => {
      keyframes += current.keyframeCount;
    });
    return keyframes;
  }

  maybeAddTimepoint(speed) {
    if (this.isSeeking === true) {
      return;
    }
    
    this.timelines[this.currentTimelineIndex].maybeAddTimepoint(speed);
  }

  onMessage(event) {
    if (!Editor.file) {
      return;
    }
    const obj = JSON.parse(event.data);

    if ('currentTime' in obj) {
      if (!this.isSeeking) {
        this.timelines.forEach((current) => {
          current.setCurrentTime(obj.currentTime);
        });
      }
      this.timeLabel.firstChild.innerHTML = utils.durationString(obj.currentTimelineTime);
      if (!this.didShowFrame) {
        this.video.classList.add('show');
        if (this.footer) {
          this.footer.classList.add('show');
        }
        this.didShowFrame = true;
      }

      if (this.timelines[this.currentTimelineIndex].getSpeedSegmentAtCurrentTimeWithFudgeFactor() != null || this.timelines[this.currentTimelineIndex].isWithinOneSecondOfEnd()) {
        this.addSpeedInput.classList.add('disabled');
      } else {
        this.addSpeedInput.classList.remove('disabled');
      }
    } else if ('playerDuration' in obj) {
      this.timeLabel.lastChild.innerHTML = utils.durationString(obj.playerDuration);
    } else if ('rate' in obj) {
      this.rate = obj.rate;
      if (this.rate > 0) {
        this.playButton.classList.add('pause');
      } else {
        this.playButton.classList.remove('pause');
      }
    } else if ('nearestKeyframe' in obj) {
      if (obj.nearestKeyframe) {
        this.addPointInput.classList.add('remove');
      } else {
        this.addPointInput.classList.remove('remove');
      }
    } else if (obj.keyframes) {
      this.timelines[obj.keyframes.timelineIndex].update(obj.keyframes);
      ipcRenderer.emit('keyframes-updated', obj.keyframes, this.didShowFrame);
    } else if (obj.edits) {
      // eslint-disable-next-line no-restricted-syntax
      for (const k in obj.edits) {
        if (k in Editor.edits) {
          if (k === 'adjustments') {
            for (let a in obj.edits.adjustments) {
              Editor.edits.adjustments[a] = obj.edits.adjustments[a];
            }
          } else if (k === 'timelapseSegments') {
            if (obj.edits.timelapseSegments) {
              this.timelines.forEach((current) => {
                current.setTimelapseTimeline(obj.edits.timelapseSegments);
              });
            }
          } else {
            Editor.edits[k] = obj.edits[k];
          }
        }
      }
      m.redraw();
    } else if ('currentTimelineIndex' in obj) {
      const previousTimelineIndex = this.currentTimelineIndex;
      this.currentTimelineIndex = obj.currentTimelineIndex;
      animateViewDown(this.timelineDivs[previousTimelineIndex], () => {
        this.timelineDivs[previousTimelineIndex].style.display = 'none';
        this.timelineDivs[obj.currentTimelineIndex].style.display = 'block';
        this.timelines[obj.currentTimelineIndex].reconcileTimelapseTimelineWithEditor();
        animateViewUp(this.timelineDivs[obj.currentTimelineIndex]);
      });
    } else if ('stillCaptured' in obj) {
      const result = obj.stillCaptured;
      if (!result.success) {
        new Notification('Erreur pendant la capture Photo !', {
          body: 'Réessayez plus tard',
          silent: true,
        });
      } else {
        if (result.is360) {
          rylo.inject360PhotoMetadata(result.filename);
        }
        const notification = new Notification('Photo réalisée avec succès !', {
          body: 'Cliquez ici pour ouvrir le Finder',
          silent: true,
        });
        notification.onclick = () => {
          shell.showItemInFolder(result.filename);
        };
      }

      // We don't keep any state here in a model. Push the event.
      ipcRenderer.emit('photo-exported', result.is360);
    } else if ('timelapseSegmentsUpdated' in obj) {
      if (this.timelines[this.currentTimelineIndex].getSpeedSegmentAtCurrentTimeWithFudgeFactor() != null || this.timelines[this.currentTimelineIndex].isWithinOneSecondOfEnd()) {
        this.addSpeedInput.classList.add('disabled');
      } else {
        this.addSpeedInput.classList.remove('disabled');
      }
    } else if ('zoomModeSnapped' in obj) {
      for (let i = 0; i < this.zoomRangeContainer.childNodes.length; i += 1) {
        if (i === obj.zoomModeSnapped) {
          this.zoomRangeContainer.childNodes[i].classList.add('current');
        } else {
          this.zoomRangeContainer.childNodes[i].classList.remove('current');
        }

        // Hack to reset the animation. removing/then re-adding the class will no-op. voiding the offset width
        // forces the dom to refresh twice.
        // See: https://css-tricks.com/restart-css-animation/
        this.zoomRangeContainer.childNodes[i].classList.remove('fadeInAndOut');
        // eslint-disable-next-line no-void
        void this.zoomRangeContainer.childNodes[i].offsetWidth;
        this.zoomRangeContainer.childNodes[i].classList.add('fadeInAndOut');
      }
    } else {
      console.error('Unknown player message:', obj);
    }
  }

  postMessage(json) {
    if (json.aspect) {
      this.setSizeForAspect(json.aspect);
    }
    if (json.trim) {
      this.timelines.forEach((current) => {
        current.setTrim(json.trim);
      });
    }
    this.video.postMessage(JSON.stringify(json));
  }
}

exports.Player = Player;

