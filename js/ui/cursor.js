// A trailing ring that accompanies (never replaces) the native cursor.
import { damp } from '../lib/util.js';

export class Cursor {
  constructor(el) {
    this.el = el;
    this.x = innerWidth / 2; this.y = innerHeight / 2;
    this.tx = this.x; this.ty = this.y;
    this.enabled = matchMedia('(pointer: fine)').matches;
    if (!this.enabled) { el.remove(); return; }
    this.label = el.querySelector('.cursor__label');
    window.addEventListener('pointermove', (e) => { this.tx = e.clientX; this.ty = e.clientY; el.classList.add('is-live'); }, { passive: true });
    document.addEventListener('pointerleave', () => el.classList.remove('is-live'));
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, [data-cursor]');
      el.classList.toggle('is-link', !!t);
    });
  }

  setLabel(text) {
    if (!this.enabled || this.text === text) return;
    this.text = text;
    this.label.textContent = text;
    this.el.classList.toggle('has-label', !!text);
  }

  update(dt, reduced) {
    if (!this.enabled) return;
    const k = reduced ? 60 : 16;
    this.x = damp(this.x, this.tx, k, dt);
    this.y = damp(this.y, this.ty, k, dt);
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
  }
}
