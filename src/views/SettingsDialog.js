const m = require('mithril');

const Dialog = require('../models/Dialog');
const Media = require('../models/Media');

module.exports = {
  view() {
    return m('Dialog.export[style=width:540px]', [
      m(Dialog.header, 'Préférences'),
      m('ul',
        m('li', [
          m('img', { src: 'assets/settings-homefolder.svg' }),
          m('div', [
            m('h1', 'Dossier par défaut sur ce Mac'),
            m('h2', Media.localLibraryPath),
          ]),
          m('button', { onclick: Media.onSelectLibraryPath }, 'Changer'),
        ])),
      m(Dialog.footer, [
        m('button', {
          onclick() {
            Dialog.pop();
          },
        }, 'Valider'),
      ]),
    ]);
  },
};
/*
module.exports = {
  view() {
    return m('Settings', [
      m('h1', 'Settings'),
      m('section', [
        m('h2', 'This Mac Folder'),
        m('h3', Media.localLibraryPath),
        m('button', { onclick: Media.onSelectLibraryPath }, 'Change')
      ]),
      m('section', [
        m('h2', 'Rylo X'),
        m('h3', `Logged in as ${User.user.email}`),
        m('button', {onclick() {
          Dialog.settings = false;
          User.signOut();
        }}, 'Logout')
      ]),
    ]);
  }
}
*/