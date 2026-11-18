// Maps native scroll position to story time T = chapterIndex + localProgress.
// Native scrolling is kept (keyboard, scrollbar, assistive tech all work);
// we only smooth the value we read from it.
import { damp, clamp } from '../lib/util.js';

export class ScrollStory {
  constructor(sections) {
    this.sections = sections;
    this.y = window.scrollY;
    this.v = 0;
    this.measure();
  }

  measure() {
    this.starts = this.sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
    this.heights = this.sections.map((s) => Math.max(1, s.offsetHeight));
    this.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  update(dt, reduced) {
    const target = window.scrollY;
    const prev = this.y;
    this.y = reduced ? target : damp(this.y, target, 7.5, dt);
    if (Math.abs(this.y - target) < 0.25) this.y = target;
    this.v = dt > 0 ? (this.y - prev) / dt : 0;
  }

  get T() {
    return this.timeAt(this.y);
  }

  timeAt(y) {
    const s = this.starts;
    let i = 0;
    while (i < s.length - 1 && y >= s[i + 1]) i++;
    return i + clamp((y - s[i]) / this.heights[i], 0, 0.9999);
  }

  // Scroll offset that corresponds to story time T.
  yAt(T) {
    const i = Math.min(this.starts.length - 1, Math.floor(T));
    return this.starts[i] + (T - i) * this.heights[i];
  }

  get progress() {
    return clamp(this.y / this.max);
  }
}
