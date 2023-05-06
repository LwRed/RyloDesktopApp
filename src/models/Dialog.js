const m = require('mithril');

const Dialog = {
  dialogs: [],

  push(dialog, attrs) {
    this.dialogs.push([dialog, attrs]);
  },

  pop() {
    this.dialogs.pop();
  },

  header: {
    view(vnode) {
      return m('header', vnode.attrs, vnode.children);
    },
  },

  footer: {
    view(vnode) {
      return m('footer', vnode.attrs, vnode.children);
    },
  },
};

window.addEventListener('keydown', (e) => {
  // escape
  if (e.keyCode === 27 && Dialog.dialogs.length > 0) {
    const current = Dialog.dialogs[Dialog.dialogs.length - 1][0];
    // Default is cancellable. Most dialogs won't have the method.
    const cancellable = ('cancellable' in current) ? current.cancellable : true;
    if (cancellable) {
      Dialog.pop();
      m.redraw();
    }
  }
});

module.exports = Dialog;
