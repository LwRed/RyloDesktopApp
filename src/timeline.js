const m = require('mithril');
const Editor = require('./models/Editor');
const html = require('./html');

const minTrimTolerance = 0.001;
const TimeSegmentFudgeFactorPx = 10;

class Timeline {
  constructor(container) {
    document.addEventListener('click', (e) => {
      const all = this.getAllTimelapseSegments();
      for (let i = 0; i < all.length; i += 1) {
        const childBox = html.getBoundsForFirstChild(all[i], 'tooltiptext');
        if (this.isInBoundingBox(e.x, e.y, all[i].getBoundingClientRect(), 0) || (childBox && this.isInBoundingBox(e.x, e.y, childBox, 0))) {
            all[i].classList.add('current');
          } else {
          all[i].classList.remove('current');
        }
      }
    });

    this.container = container;
    this.duration = 1;
    this.keyframes = {};

    this.trackDiv = html.create('<div class="track"></div>');

    var seekStart = (e, target) => {
      this.dragDiv = target;
      this.onSeekStart && this.onSeekStart(e);
      this.onSeekDrag && this.onSeekDrag(e);
    };
    var seekDrag = (e) => { this.onSeekDrag && this.onSeekDrag(e); };
    var seekEnd = (e) => {
      this.dragDiv = null;
      this.onSeekEnd && this.onSeekEnd(e);
    };

    this.trackHeadDiv = html.create(`<div class="track-head"/>`);
    html.makeDraggable(this.trackHeadDiv, { onStart: seekStart, onMove: seekDrag, onEnd: seekEnd });
    this.trackDiv.onmousedown = this.trackHeadDiv.onmousedown;
    this.trackDiv.ignoreDownEvent = (e) => {
      return this.isInsideAnySpeedTooltip(e);
    };

    this.trackHeadDiv.ignoreDownEvent = (e) => {
      return this.isInsideAnySpeedTooltip(e);
    };

    this.trimLeftDiv = html.create(`<div class="trim-head" style="left:0%"/>`);
    this.trimRegionLeftDiv = html.create(`<div class="trim-region" style="float:left;"/>`);
    
    this.trimRightDiv = html.create(`<div class="trim-head" style="left:100%;"/>`);
    this.trimRegionRightDiv = html.create(`<div class="trim-region" style="float:right;"/>`);

    html.makeDraggable(this.trimLeftDiv, {
      onStart: (e, target) => {
        seekStart(e, target);
        Editor.edits.trim[0] = this.currentTime / this.duration;
        m.redraw();
      },
      onMove: (e) => {
        seekDrag(e);
        Editor.edits.trim[0] = this.currentTime / this.duration;
        m.redraw();
      },
      onEnd: seekEnd
    });
    html.makeDraggable(this.trimRightDiv, {
      onStart: (e, target) => {
        seekStart(e, target);
        Editor.edits.trim[1] = this.currentTime / this.duration;
        m.redraw();
      },
      onMove: (e) => {
        seekDrag(e);
        Editor.edits.trim[1] = this.currentTime / this.duration;
        m.redraw();
      },
      onEnd: seekEnd,
    });

    this.trimRegionLeftDiv.onmousedown = this.trimLeftDiv.onmousedown;
    this.trimRegionRightDiv.onmousedown = this.trimRightDiv.onmousedown;

    this.container.appendChild(this.trackDiv);

    this.container.appendChild(this.trimRegionLeftDiv);
    this.container.appendChild(this.trimLeftDiv);

    this.container.appendChild(this.trimRegionRightDiv);
    this.container.appendChild(this.trimRightDiv);

    this.container.appendChild(this.trackHeadDiv);

    // Initialize drag min/max
    this.setTrim([0, 1]);
  }

  get keyframeCount() {
    return Object.keys(this.keyframes).length;
  }

  isInsideAnySpeedTooltip(e) {
    const all = this.getAllTimelapseSegments();
    for (let i = 0; i < all.length; i += 1) {
      const childBox = html.getBoundsForFirstChild(all[i], 'tooltiptext');
      if (childBox && this.isInBoundingBox(e.x, e.y, childBox, 0)) {
        return true;
      }
    }
    return false;
  }

  setCurrentTime(time) {
    this.trackHeadDiv.style.left = `${(time / this.duration) * 100}%`;
  }

  getAllTimelapseSegments() {
    const timelapseSections = [];
    for (let current of this.trackDiv.children) {
      if (current.classList.contains('speed')) {
        timelapseSections.push(current);
      }
    }

    return timelapseSections.sort((a, b) => { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
  }

  getNextTimeSegmentForPosition(position) {
    const all = this.getAllTimelapseSegments();
    for (let i = 0; i < all.length; i += 1) {
      // If we're in the middle, get the next in line.
      if (this.isInRange(position, all[i].getBoundingClientRect().left, all[i].getBoundingClientRect().right, 0)) {
        return i !== all.length - 1 ? all[i + 1] : null;
      }

      if (position < all[i].getBoundingClientRect().left) {
        return all[i];
      }
    }
    return null;
  }


  isInBoundingBox(x, y, boundingRect, fudgeFactor) {
    return x >= (boundingRect.left-fudgeFactor) && x <= (boundingRect.right+fudgeFactor) && y >= (boundingRect.top-fudgeFactor) && y <= (boundingRect.bottom+fudgeFactor);
  }

  isInRange(a, left, right, fudgeFactor) {
    return a >= (left-fudgeFactor) && a <= (right+fudgeFactor);
  }

  getCurrentTimeSegmentForPositionWithFudgeFactor(position) {
    const all = this.getAllTimelapseSegments();
    for (let i = 0; i < all.length; i += 1) {
      if (this.isInRange(position, all[i].getBoundingClientRect().left, all[i].getBoundingClientRect().right, TimeSegmentFudgeFactorPx)) {
        return all[i];
      }
    }
    return null;
  }


  getPreviousTimeSegmentForPosition(position) {
    const all = this.getAllTimelapseSegments();
    for (let i = 0; i < all.length; i += 1) {
      if (this.isInRange(position, all[i].getBoundingClientRect().left, all[i].getBoundingClientRect().right, 0)) {
        return i !== 0 ? all[i - 1] : null;
      }

      if (position > all[i].getBoundingClientRect().right + position) {
        return all[i];
      }
    }
    return null;
  }

  jsonForTimeSegment(timeSegment) {
    const timeSegmentRect = timeSegment.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const json = {};
    json.start = ((timeSegmentRect.left - containerRect.left) / containerRect.width);
    json.end = ((timeSegmentRect.right - containerRect.left) / containerRect.width);
    json.speed = timeSegment.speed;
    json.blur = timeSegment.motionBlur;
    return json;
  }

  updateTimelapseSegments() {
    // Only update if we're the active timeline.
    // Can't calculate percentages if hidden AND we don't need to update from both timelines.
    if (this.container.getBoundingClientRect().width === 0) {
      return;
    }

    const all = this.getAllTimelapseSegments();
    Editor.edits.timelapseSegments = all.map(curr => this.jsonForTimeSegment(curr));
    m.redraw();
  }

  // eslint-disable-next-line class-methods-use-this
  updateSpeedTooltip(timelapseDiv, tooltipRange, values) {
    const idx = tooltipRange.value;
    const range = values.length - 1.0;
    const from = 0;
    const to = idx / range;

    const rangeStyle = `--range-from: ${from * 100}%; --range-to: ${to * 100}%;`;
    const tooltipStyle = `--tooltip: "${values[idx]}x";
                        --tooltip-pos: ${(idx / range) * 100}%`;
    // eslint-disable-next-line no-param-reassign
    tooltipRange.style = rangeStyle + tooltipStyle;

    // eslint-disable-next-line no-param-reassign
    timelapseDiv.speed = values[idx];
  }

  addNewTimelapseSegment(start, end, rate, motionBlur, updateEditor) {
    const leftHandle = html.create('<div class="speed-head"/>');
    const rightHandle = html.create('<div class="speed-head speed-head-right"/>');

    const timelapseDiv = html.create(`<div class="speed" style="left:${start}%;width:${end - start}%"/>`);
    timelapseDiv.appendChild(leftHandle);
    timelapseDiv.appendChild(rightHandle);

    const values = [2, 4, 8, 12, 16];
    const tooltipDiv = html.create('<div class="tooltiptext"/>');
    const tooltipRange = html.create(`<input type="range" min="0" max="${values.length - 1}" step="1">`);
    tooltipRange.oninput = () => {
      this.updateSpeedTooltip(timelapseDiv, tooltipRange, values);
      this.updateTimelapseSegments();
    };
    const motionBlurDiv = html.create('<input type="image" src="assets/motionblur.svg" />');
    motionBlurDiv.classList.add(motionBlur ? 'active' : 'toggle');
    motionBlurDiv.onclick = () => {
      timelapseDiv.motionBlur = !timelapseDiv.motionBlur;
      motionBlurDiv.classList.remove('active');
      motionBlurDiv.classList.remove('toggle');
      motionBlurDiv.classList.add(timelapseDiv.motionBlur ? 'active' : 'toggle');
      this.updateTimelapseSegments();
    };

    const deleteTimePoint = html.create('<input type="image" src="assets/delete-point.svg" />');
    deleteTimePoint.onclick = () => {
      this.trackDiv.removeChild(timelapseDiv);
      this.updateTimelapseSegments();
    };

    tooltipDiv.appendChild(deleteTimePoint);
    tooltipDiv.appendChild(tooltipRange);
    tooltipDiv.appendChild(motionBlurDiv);
    tooltipRange.value = values.indexOf(rate);
    this.updateSpeedTooltip(timelapseDiv, tooltipRange, values);
    timelapseDiv.appendChild(tooltipDiv);
    timelapseDiv.motionBlur = motionBlur;

    html.makeResizableParentLeft(leftHandle, {
      onStart: (e) => {
        // Use center of view to avoid rounding errors.
        const center = (timelapseDiv.getBoundingClientRect().left + timelapseDiv.getBoundingClientRect().right) / 2.0;
        const previousSegment = this.getPreviousTimeSegmentForPosition(center);

        const oneSecondPercent = 1.0 / this.duration;
        leftHandle.dragMin = previousSegment ? html.pointToPercentOfView(previousSegment.getBoundingClientRect().right, this.trackDiv) : Editor.edits.trim[0];
        leftHandle.dragMax = html.pointToPercentOfView(rightHandle.getBoundingClientRect().left, this.trackDiv) - oneSecondPercent;
      },
      onMove: (e) => {},
      onEnd: (e) => {
        this.updateTimelapseSegments();
      },
    });

    html.makeResizableParentRight(rightHandle, {
      onStart: (e) => {
        // Use center of view to avoid rounding errors.
        const center = (timelapseDiv.getBoundingClientRect().left + timelapseDiv.getBoundingClientRect().right) / 2.0;
        const nextSegment = this.getNextTimeSegmentForPosition(center);
        
        const oneSecondPercent = 1.0 / this.duration;
        rightHandle.dragMin = html.pointToPercentOfView(leftHandle.getBoundingClientRect().right, this.container) + oneSecondPercent;
        rightHandle.dragMax = nextSegment ? html.pointToPercentOfView(nextSegment.getBoundingClientRect().left, this.container) : Editor.edits.trim[1];
      },
      onMove: (e) => {
      },
      onEnd: (e) => {
        this.updateTimelapseSegments();
      },
    });

    this.trackDiv.appendChild(timelapseDiv);

    if (updateEditor) {
      this.updateTimelapseSegments();
    }

    return timelapseDiv;
  }

  removeAllExistingTimelapseSegments() {
    const all = this.getAllTimelapseSegments();
    for (let i = 0; i < all.length; i += 1) {
      this.trackDiv.removeChild(all[i]);
    }
  }

  reconcileTimelapseTimelineWithEditor() {
    this.removeAllExistingTimelapseSegments();

    const sections = Editor.edits.timelapseSegments;
    sections.forEach((current) => {
      this.addNewTimelapseSegment(current.start * 100, current.end * 100, current.rate, current.blur, false);
    });
  }

  setTimelapseTimeline(sections) {
    this.removeAllExistingTimelapseSegments();

    const pos = x => x * 100 / this.duration;
    sections.forEach((current) => {
      const start = pos(current.range[0]);
      const end = pos(current.range[1]);
      const rate = Math.floor(current.rate);
      const motionBlur = current.blur;
      // We don't need to update the segments after every add.
      this.addNewTimelapseSegment(start, end, rate, motionBlur, false);
    });

    this.updateTimelapseSegments();
  }

  isWithinOneSecondOfEnd() {
    return this.currentTime + 1.0 >= this.endTime;
  }

  getSpeedSegmentAtCurrentTimeWithFudgeFactor() {
    const currentPosition = this.trackHeadDiv.getBoundingClientRect().left;
    if (currentPosition === 0) {
      return null;
    }

    return this.getCurrentTimeSegmentForPositionWithFudgeFactor(currentPosition);
  }

  maybeAddTimepoint(speed) {
    if (this.getSpeedSegmentAtCurrentTimeWithFudgeFactor() != null) {
      return;
    }

    const current = this.getSpeedSegmentAtCurrentTimeWithFudgeFactor();
    if (current) {
      return;
    }

    const currentPosition = this.trackHeadDiv.getBoundingClientRect().left;
    const next = this.getNextTimeSegmentForPosition(currentPosition);

    const endTrim = this.trackHeadDiv.dragMax || 1;
    let nextElementEndTime = this.duration * endTrim;
    if (next) {
      nextElementEndTime = this.duration * html.pointToPercentOfView(next.getBoundingClientRect().left, this.container);
    }

    // 10 seconds by default.
    const newSegment = this.addNewTimelapseSegment((this.currentTime / this.duration) * 100, (Math.min((this.currentTime + 10), nextElementEndTime) / this.duration * 100), speed, false, true);
    newSegment.classList.add('current');
  }

  get currentTime() {
    const w = parseFloat((this.dragDiv || this.trackHeadDiv).style.left) / 100;
    return w * this.duration;
  }

  get startTime() {
    return this.trackHeadDiv.dragMin * this.duration;
  }

  get endTime() {
    return this.trackHeadDiv.dragMax * this.duration;
  }

  get isAtStartTime() {
    return this.currentTime - 0.05 < this.startTime;
  }

  get isAtEndTime() {
    return this.currentTime + 0.05 > this.endTime;
  }

  setDuration(duration) {
    this.duration = duration;
  }

  setTrim(trim) {
    Editor.edits.trim[0] = trim[0];
    Editor.edits.trim[1] = trim[1];

    this.trackHeadDiv.dragMin = trim[0];
    this.trackHeadDiv.dragMax = trim[1];

    this.trimLeftDiv.dragMax = trim[1] - minTrimTolerance;
    this.trimRightDiv.dragMin = trim[0] + minTrimTolerance;

    this.trimLeftDiv.style.left = (trim[0] * 100) + '%';
    this.trimRightDiv.style.left = (trim[1] * 100) + '%';

    this.trimRegionLeftDiv.style.width = (trim[0] * 100) + '%';
    this.trimRegionRightDiv.style.width = ((1-trim[1]) * 100) + '%';
  }

  setTrimStart() {
    const startTrim = this.currentTime / this.duration;
    const endTrim = this.trackHeadDiv.dragMax || 1;
    if (startTrim < endTrim - minTrimTolerance) {
      this.setTrim([startTrim, endTrim]);
    }
  }

  setTrimEnd() {
    const startTrim = this.trackHeadDiv.dragMin || 0;
    const endTrim = this.currentTime / this.duration;
    if (endTrim > startTrim + minTrimTolerance) {
      this.setTrim([startTrim, endTrim]);
    }
  }

  resetTrim() {
    this.setTrim([0, 1]);
  }

  update(keyframes) {
    const pos = x => x * 100 / this.duration;

    if (keyframes.added) {
      const key = keyframes.added;
      if (key.type === 'point') {
        const pointDiv = html.create(`<div class="point" style="left:${pos(key.range[0])}%"/>`);
        this.trackDiv.appendChild(pointDiv);
        this.keyframes[key.id] = pointDiv;
      } else {
        const start = pos(key.range[0]);
        const end = pos(key.range[1]);
        const followDiv = html.create(`<div class="follow" style="left:${start}%;width:${end - start}%"/>`);
        this.trackDiv.appendChild(followDiv);
        this.keyframes[key.id] = followDiv;
      }
    }
    if (keyframes.updated) {
      for (let key of keyframes.updated) {
        const start = pos(key.range[0]);
        const end = pos(key.range[1]);
        const div = this.keyframes[key.id];
        div.style.left = start + '%';
        div.style.width = (end - start) + '%';
      }
    }
    if (keyframes.removed) {
      for (let key of keyframes.removed) {
        this.keyframes[key].remove();
        delete this.keyframes[key];
      }
    }
  }
}

exports.Timeline = Timeline;
