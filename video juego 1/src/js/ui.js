// Interfaz en DOM: ventanas, confirmaciones, ayuda y pantallas de texto.

const UI = {
  modalRoot: null,
  init() { this.modalRoot = document.getElementById('modal'); },

  // Ventana con botones; devuelve una promesa con el índice elegido.
  modal({ kicker, title, body, source, choices, wide, cls }) {
    return new Promise((resolve) => {
      const R = this.modalRoot;
      R.innerHTML = '';
      const box = el('div', { class: 'dlg' + (wide ? ' wide' : '') + (cls ? ' ' + cls : ''), role: 'dialog', 'aria-modal': 'true' });
      if (kicker) box.append(el('div', { class: 'kicker' }, kicker));
      if (title) box.append(el('h2', null, title));
      for (const p of [].concat(body || [])) box.append(typeof p === 'string' ? el('p', null, p) : p);
      if (source) box.append(el('p', { class: 'src' }, 'Fuente: ' + source));
      const row = el('div', { class: 'choices' });
      (choices || [{ label: 'Seguir' }]).forEach((c, i) => {
        const b = el('button', { class: 'choice' + (c.primary || i === 0 ? ' primary' : '') + (c.disabled ? ' off' : ''), disabled: !!c.disabled, onclick: () => { Sfx.click(); close(i); } },
          el('span', { class: 'cl' }, c.label), c.hint ? el('span', { class: 'ch' }, c.hint) : null);
        row.append(b);
      });
      box.append(row);
      R.append(box);
      R.hidden = false;
      G.modalOpen = true;
      const first = row.querySelector('button:not([disabled])');
      if (first) first.focus();
      const key = (e) => {
        if (e.code === 'Escape' && choices && choices.some((c) => c.cancel)) { e.preventDefault(); close(choices.findIndex((c) => c.cancel)); }
      };
      window.addEventListener('keydown', key);
      function close(i) { window.removeEventListener('keydown', key); R.hidden = true; R.innerHTML = ''; G.modalOpen = false; resolve(i); }
    });
  },

  confirm(title, text, okLabel, fn) {
    this.modal({ title, body: [text], choices: [{ label: okLabel }, { label: 'Cancelar', cancel: true }] }).then((i) => { if (i === 0) fn(); });
  },

  help(kind) {
    const rows = HELP[kind];
    const t = el('table', { class: 'keys' }, ...rows.map(([k, v]) => el('tr', null, el('td', null, el('kbd', null, k)), el('td', null, v))));
    const extra = kind === 'battle'
      ? [el('p', null, 'Flanquear es la clave: un golpe de costado hace la mitad más de daño y uno por la espalda, el doble. Las tropas que pierden la moral huyen y pueden contagiar a las vecinas. Cerca de César la tropa aguanta más.'),
         el('p', null, 'Con touchpad: tocá una tropa, después tocá el terreno. Para elegir hacia dónde miran, mantené Alt o Ctrl mientras arrastrás. Abajo tenés la lista de tus tropas: un clic las selecciona, doble clic centra la cámara.')]
      : [el('p', null, 'Cada turno es una estación. Los ejércitos mueven una región por turno; con flota pueden ir por mar entre puertos. Cada tropa cobra su soldada: si no alcanza la plata, baja la lealtad. Con lealtad baja hay deserciones y, al final, motín.')];
    this.modal({ title: kind === 'battle' ? 'Controles de batalla' : 'Cómo se juega la campaña', body: [t, ...extra], choices: [{ label: 'Entendido' }], wide: true });
  },

  toast(msg, kind) {
    const T = document.getElementById('toasts');
    const n = el('div', { class: 'toast ' + (kind || '') }, msg);
    T.append(n);
    setTimeout(() => n.classList.add('out'), 3200);
    setTimeout(() => n.remove(), 3800);
  },

  show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  },
};
