const m = require('mithril');

const Editor = require('../models/Editor');
const OnMacLibraryView = require('./OnMacLibraryView');
// const CloudLibraryView = require('./CloudLibraryView');
const SdCardLibraryView = require('./SdCardLibraryView');

const tabs = [
  ['mac', 'Ce Mac'],
  // ['cloud', 'Cloud'],
  ['sd', 'Carte MicroSD'],
];
let selectedTab = 0;

module.exports = {
  view() {
    return m('Library#library', {class: Editor.isToolbarExpanded ? 'hidden' : ''}, [
      m('nav', tabs.map((entry, idx) => [
        m('label', {
          onchange(e) { selectedTab = idx; }
        }, [
          m('input', {type: 'radio', name: 'library', value: entry[0], checked: idx===selectedTab}),
          m('img', {src: `assets/tab-${entry[0]}.svg`}),
          m('p', entry[1])
        ])
      ])),
      m('section', {style: {marginLeft: -selectedTab*100 + '%'}}, [
        m(OnMacLibraryView),
        // m(CloudLibraryView),
        m(SdCardLibraryView)
      ])
    ]);
  }
}
