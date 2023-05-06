const m = require('mithril');
const Editor = require('../models/Editor');
const equal = require('deep-equal');
const html = require('../html');

const tools = [
  {
    title: 'Fermer',
    name: 'tools',
  },
  {
    name: 'aspect',
    tooltip: ['Recadrage', 'Définit le format'],
    segment: ['Portrait', 'Carré', 'Paysage', 'Cinéma'],
    values: [[9, 16], [1, 1], [16, 9], [21, 9]],
  },
  {
    name: 'frontBack',
    tooltip: ['Double vue', 'Définit la double vue'],
    segment: ['Non', 'Cercle', 'Pillule', '50/50'],
    values: ['off', 'circle', 'pill', 'split'],
    toggle: {
      name: 'invertFrontBackPosition',
      img: 'assets/swap-direction.svg',
    },
  },
  {
    name: 'rollAngle',
    tooltip: ['Niveau', 'Contrôle la rotation de la caméra'],
    range: [-Math.PI*0.25, Math.PI*0.25],
    toggle: {
      name: 'levelRoll',
      img: 'assets/level-off.svg',
      inverted: true,
    },
  },
  {
    name: 'stabilization',
    tooltip: ['Stabilisation', 'Contrôle la stabilité de la vidéo'],
    segment: ['Activée', 'Désactivée'],
    values: [true, false],
  },
  {
    name: 'volume',
    range: [0, 1],
    tooltip: ['Volume', 'Contrôle le volume de la vidéo'],
  },
  {
    name: 'tool-brightness',
    tooltip: ['Luminosité', 'Contrôle la luminosité de la vidéo'],
    range: [-1, 1],
    showOnOffToggle: true,
  },
  {
    name: 'tool-contrast',
    tooltip: ['Contraste', 'Contrôle le contraste de la vidéo'],
    range: [-1, 1],
    showOnOffToggle: true,
  },
  {
    name: 'tool-highlights',
    tooltip: ['Hautes Lumières', 'Contrôle les Hautes Lumières'],
    range: [-1, 1],
    showOnOffToggle: true,
  },
  {
    name: 'tool-shadows',
    tooltip: ['Ombres', 'Contrôle le niveau des Ombres'],
    range: [-1, 1],
    showOnOffToggle: true,
  },
  {
    name: 'tool-temperature',
    tooltip: ['Température', 'Contrôle la Température de la vidéo'],
    range: [-1, 1],
    showOnOffToggle: true,
  },
  {
    name: 'tool-saturation',
    tooltip: ['Saturation', 'Contrôle la saturation de la vidéo'],
    range: [-1, 1],
    showOnOffToggle: true,
  },
];

function showTooltip(element, h1, h2) {
  removeTooltip(element); // remove any previous tooltip

  let dims = element.getBoundingClientRect();
  let x = dims.x - 10;
  let y = dims.y + dims.height * 0.5;
  
  let tip = html.create(`<Tooltip><h1>${h1}</h1><h2>${h2}</h2></Tooltip>`);
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
  element.r_tooltip = {
    el: tip,
    remove() {
      removeTooltip(element);
    }
  };
  document.body.appendChild(tip);
  window.addEventListener('resize', element.r_tooltip.remove, true);
}

function removeTooltip(element) {
  if (element.r_tooltip) {
    element.r_tooltip.el.remove();
    window.removeEventListener('resize', element.r_tooltip.remove, true);
    delete element.r_tooltip;
  }
}

function toolTitle(tool) {
  return m('h2', {
    onclick() {
      Editor.isToolbarExpanded = !Editor.isToolbarExpanded;
    },
  }, tool.title);
}

function toolIcon(tool) {
  return m('input', {
    type: 'image',
    src: `assets/${tool.name}.svg`,
    onclick(e) {
      Editor.isToolbarExpanded = !Editor.isToolbarExpanded;
      removeTooltip(e.target);
    },
    onmouseenter(e) {
      tool.tooltip && showTooltip(e.target, tool.tooltip[0], tool.tooltip[1]);
    },
    onmouseleave(e) {
      removeTooltip(e.target);
    },
  });
}


function toolSegment(tool) {
  const dict = Editor.edits;
  return [
    toolIcon(tool),
    tool.segment.map((segment, idx) => m('label', [
      m('input', {
        type: 'radio',
        name: tool.name,
        checked: equal(Editor.edits[tool.name], tool.values[idx]),
        onchange(e) {
          Editor.edits[tool.name] = tool.values[idx];
        },
        onupdate(vnode) {
          this.checked = equal(Editor.edits[tool.name], tool.values[idx]);
        },
      }),
      m('span', {}, segment),
    ])),
    tool.toggle ? m('.detail', m('input', {
      type: 'image',
      src: tool.toggle.img,
      class: dict[tool.toggle.name] ? 'active' : 'toggle',
      onclick(e) {
        dict[tool.toggle.name] = !dict[tool.toggle.name];
      },
    })) : [],
  ];
}

function toolButtons(tool) {
  return [
    toolIcon(tool),
    tool.buttons.map((button) => m(input, {type: 'button', value: button}))
  ];
}

function toolRange(tool) {
  let dict = Editor.edits;
  let field = tool.name;
  let defaultEdits = Editor.defaultEdits;
  if (tool.name.startsWith('tool-')) {
    field = tool.name.split('-')[1];
    dict = Editor.edits.adjustments;
    defaultEdits = Editor.defaultEdits.adjustments;
  }

  return [
    toolIcon(tool),
    m('input', {
      type: 'range',
      min: tool.range[0],
      max: tool.range[1],
      step: tool.range[2] || 'any',
      value: dict[field],
      onupdate(vnode) {
        let val = dict[field];
        let range = tool.range[1] - tool.range[0];
        let from = Math.max(0, -tool.range[0]) / range;
        let to = (val - tool.range[0]) / range;
        if (from > to) {
          [from, to] = [to, from];
        }
        let rangeStyle = `--range-from: ${from * 100}%; --range-to: ${to * 100}%;`;
        let tooltipStyle = `--tooltip: "${vnode.dom.oldValue ? Math.round(val*100)/100 : ''}";
                            --tooltip-pos: ${(val - tool.range[0]) / range * 100}%`;
        vnode.dom.style = rangeStyle + tooltipStyle;
      },
      oninput(e) {
        let val = +e.target.value;
        if ((val <= 0 && val > -0.15 && this.oldValue > 0) ||
            (val >= 0 && val <  0.15 && this.oldValue < 0)) {
          dict[field] = 0;
        } else {
          dict[field] = val;
          this.oldValue = val;
        }
      },
      onmouseup(e) {
        delete this.oldValue;
      },
      oncontextmenu(e) {
        dict[field] = defaultEdits[field];
      },
      ondblclick(e) {
        dict[field] = defaultEdits[field];
      }
    }),
    m('.detail', tool.showOnOffToggle && dict[field] ? m('input', {
      type: 'image',
      src: 'assets/toggle-on-off.svg',
      style: 'visibility:hidden;',
      onload(e) {
        e.target.style = '';  // necessary to prevent a border outline while svg is loading
      },
      onmousedown(e) {
        this.oldValue = dict[field];
        dict[field] = 0.000000001;
      },
      onmouseup(e) {
        dict[field] = this.oldValue;
        delete this.oldValue;
      }
    }) : tool.toggle ? m('input', {
      type: 'image',
      src: tool.toggle.img,
      class: (tool.toggle.inverted ? !dict[tool.toggle.name] : dict[tool.toggle.name]) ? 'active' : 'toggle',
      onclick(e) {
        dict[tool.toggle.name] = !dict[tool.toggle.name];
      }
    }) : [])
  ];
}

const nonPhotoTools = ['speed', 'stabilization', 'volume'];
const non180Tools = ['frontBack'];
function shouldHideTool(toolName) {
  const is180 = Editor.asset.is180();
  const isPhoto = !Editor.asset.isVideo();
  return (is180 && non180Tools.includes(toolName)) || (isPhoto && nonPhotoTools.includes(toolName));
}
module.exports = {
  view() {
    return m('Toolbar', { class: Editor.isToolbarExpanded ? 'expanded' : '' },
      m('ul', tools.filter(t => !(shouldHideTool(t.name))).map(tool => m('li',
        tool.spacer  ? m('.spacer')      :
        tool.title   ? toolTitle(tool)   :
        tool.segment ? toolSegment(tool) :
        tool.buttons ? toolButtons(tool) :
        tool.range   ? toolRange(tool)   : ''
      )))
    );
  }
}
