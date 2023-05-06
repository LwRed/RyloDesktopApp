const m = require('mithril');

module.exports = {
  view(vnode) {
    return m('.empty', 
      m('h2', vnode.attrs.title),
      m('h3', vnode.attrs.subtitle),
      vnode.attrs.button ? m('button.empty-library', {onclick: vnode.attrs.onclick}, vnode.attrs.button) : [],
      vnode.children
    )
  }
};
