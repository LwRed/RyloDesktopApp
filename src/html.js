exports.create = function(html) {
  var template = document.createElement('template');
  // `trim()` prevents a text node of whitespace
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

exports.clearChildren = function(element) {
  var node;
  while (node = element.firstChild) {
    element.removeChild(node);
  }
}

exports.makeDraggable = function makeDraggable(element, callback) {
  const updateElementPos = (e) => {
    const rect = element.parentNode.getBoundingClientRect();
    let w = (e.clientX - rect.left) / rect.width;
    const min = element.dragMin || 0;
    const max = element.dragMax || 1;
    w = w < min ? min : w > max ? max : w;
    element.style.left = (w * 100) + '%';
  }

  element.onmousedown = (e) => {
    if (element.ignoreDownEvent && element.ignoreDownEvent(e)) {
      return;
    }
    
    updateElementPos(e);
    callback && callback.onStart && callback.onStart(e, element);
    this.addMouseUp('draggable', (e) => {
      this.removeMouseMove('draggable');
      this.removeMouseUp('draggable');
      callback && callback.onEnd && callback.onEnd(e);
    });
    this.addMouseMove('draggable', (e) => {
      updateElementPos(e);
      callback && callback.onMove && callback.onMove(e);
    });
  };
};

exports.makeResizableParentLeft = function draggableParent(element, callback) {
  const updateElementPos = (e) => {
    const originalRight = element.parentNode.getBoundingClientRect().right;
    const rect = element.parentNode.parentNode.getBoundingClientRect();
    let w = (e.clientX - rect.left) / rect.width;
    const min = element.dragMin || 0;
    const max = element.dragMax || 1;
    w = w < min ? min : w > max ? max : w;
    element.parentNode.style.left = (w * 100) + '%';

    const widthPixels = originalRight - element.parentNode.getBoundingClientRect().left;
    element.parentNode.style.width = `${widthPixels / rect.width * 100}%`;
  };

  element.onmousedown = (e) => {
    e.preventDefault();
    updateElementPos(e);
    callback && callback.onStart && callback.onStart(e, element);
    this.addMouseUp('parentLeft', (e) => {
      this.removeMouseMove('parentLeft');
      this.removeMouseUp('parentLeft');
      callback && callback.onEnd && callback.onEnd(e);
    });
    this.addMouseMove('parentLeft', (e) => {
      updateElementPos(e);
      callback && callback.onMove && callback.onMove(e);
    });
  };
};

exports.makeResizableParentRight = function draggableParent(element, callback) {
  const updateElementPos = (e) => {
    const rect = element.parentNode.parentNode.getBoundingClientRect();
    const originalLeftRelativeToParent = element.parentNode.getBoundingClientRect().left - rect.left;
    let w = (e.clientX - rect.left) / rect.width;
    const min = element.dragMin || 0;
    const max = element.dragMax || 1;
    w = w < min ? min : w > max ? max : w;

    const widthPixels = (w * rect.width) - originalLeftRelativeToParent;
    element.parentNode.style.width = `${widthPixels / rect.width * 100}%`;
  };

  element.onmousedown = (e) => {
    e.preventDefault();
    updateElementPos(e);
    callback && callback.onStart && callback.onStart(e, element);
    this.addMouseUp('parentRight', (e) => {
      this.removeMouseMove('parentRight');
      this.removeMouseUp('parentRight');
      callback && callback.onEnd && callback.onEnd(e);
    });
    this.addMouseMove('parentRight', (e) => {
      updateElementPos(e);
      callback && callback.onMove && callback.onMove(e);
    });
  };
};

this.onMouseUp = {};
this.onMouseMove = {};

exports.removeMouseUp = (id) => {
  delete this.onMouseUp[id];
};
exports.addMouseUp = (id, listener) => {
  this.onMouseUp[id] = listener;
  document.onmouseup = (e) => {
    Object.keys(this.onMouseUp).forEach((key) => {
      this.onMouseUp[key](e);
    });
  };
};

exports.removeMouseMove = (id) => {
  delete this.onMouseMove[id];
};
exports.addMouseMove = (id, listener) => {
  this.onMouseMove[id] = listener;
  document.onmousemove = (e) => {
    Object.keys(this.onMouseMove).forEach((key) => {
      this.onMouseMove[key](e);
    });
  };
};

exports.pointToPercentOfView = (point, view) => {
  const parentRect = view.getBoundingClientRect();
  return ((point - parentRect.left) / parentRect.width);
};

exports.getBoundsForFirstChild = (parent, className) => {
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i += 1) {
    if (window.getComputedStyle(children[i]).visibility === 'visible' && children[i].classList.contains(className)) {
      return children[i].getBoundingClientRect();
    }
  }
  return null;
};
