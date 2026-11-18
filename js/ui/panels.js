// Split-letter headings and chapter panels that animate in/out with the story.

export function splitText(root = document) {
  root.querySelectorAll('[data-split]').forEach((el) => {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    const vis = document.createElement('span');
    vis.className = 'split';
    vis.setAttribute('aria-hidden', 'true');
    let i = 0;
    text.split(' ').forEach((w, wi) => {
      if (wi > 0) vis.append(' ');
      const word = document.createElement('span');
      word.className = 'word';
      for (const ch of w) {
        const c = document.createElement('span');
        c.className = 'char';
        c.textContent = ch;
        c.style.setProperty('--i', String(i++));
        word.append(c);
      }
      vis.append(word);
    });
    el.style.setProperty('--n', String(i));
    el.append(sr, vis);
  });
}

export class Panels {
  constructor(sections) {
    this.items = [...document.querySelectorAll('.panel')].map((el) => {
      const sec = el.closest('[data-chapter]');
      return { el, chapter: Number(sec.dataset.chapter), a: Number(el.dataset.in ?? 0.05), b: Number(el.dataset.out ?? 0.85), on: false };
    });
    this.sections = sections;
    this.ready = false;
  }

  update(T) {
    for (const it of this.items) {
      const local = T - it.chapter;
      const on = this.ready && local >= it.a && local <= it.b;
      if (on !== it.on) {
        it.on = on;
        it.el.classList.toggle('is-in', on);
      }
      if (on) it.el.style.setProperty('--lp', ((local - it.a) / (it.b - it.a)).toFixed(4));
    }
  }

  showAll() {
    for (const it of this.items) it.el.classList.add('is-in');
  }
}
