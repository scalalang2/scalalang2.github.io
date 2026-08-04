(() => {
  if (window.__flowVisualizationsLoaded) return;
  window.__flowVisualizationsLoaded = true;

  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);

  class FlowViz {
    constructor(root) {
      this.root = root;
      this.canvas = root.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.slider = root.querySelector('input[type="range"]');
      this.button = root.querySelector('.flow-viz__play');
      this.buttonIcon = this.button.querySelector('span');
      this.kind = root.dataset.flowViz;
      this.t = 0;
      this.playing = true;
      this.lastFrame = performance.now();
      this.points = this.makePoints();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
      this.slider.addEventListener('input', () => {
        this.t = Number(this.slider.value);
        this.playing = false;
        this.syncButton();
        this.draw();
      });
      this.button.addEventListener('click', () => {
        this.playing = !this.playing;
        this.lastFrame = performance.now();
        this.syncButton();
      });
      this.syncButton();
      requestAnimationFrame(now => this.frame(now));
    }

    makePoints() {
      return Array.from({ length: 38 }, (_, i) => {
        const a = i * 2.399963;
        const r = 0.018 + 0.105 * Math.sqrt((i + 1) / 38);
        const p0 = { x: 0.13 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r * 1.35 };
        const branch = i % 2 ? 1 : -1;
        const q = (Math.floor(i / 2) + 0.5) / 19;
        const theta = lerp(-1.05, 1.05, q);
        const p1 = {
          x: 0.73 + 0.18 * Math.cos(theta) + branch * 0.018,
          y: 0.5 + branch * (0.17 + 0.12 * Math.sin(theta))
        };
        return { p0, p1, bend: branch * (0.06 + (i % 5) * 0.008) };
      });
    }

    syncButton() {
      this.buttonIcon.textContent = this.playing ? 'Ⅱ' : '▶';
      this.button.setAttribute('aria-pressed', String(this.playing));
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = rect.width;
      this.h = rect.height;
      this.draw();
    }

    frame(now) {
      if (this.playing) {
        this.t = (this.t + Math.min(40, now - this.lastFrame) / 6500) % 1;
        this.slider.value = this.t;
        this.draw();
      }
      this.lastFrame = now;
      requestAnimationFrame(next => this.frame(next));
    }

    clear() {
      const c = this.ctx;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      c.clearRect(0, 0, this.w, this.h);
      c.fillStyle = dark ? '#181b20' : '#f8fafc';
      c.fillRect(0, 0, this.w, this.h);
      c.strokeStyle = dark ? 'rgba(148,163,184,.10)' : 'rgba(100,116,139,.10)';
      c.lineWidth = 1;
      const step = Math.max(34, this.w / 12);
      for (let x = step; x < this.w; x += step) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.h); c.stroke(); }
      for (let y = step; y < this.h; y += step) { c.beginPath(); c.moveTo(0, y); c.lineTo(this.w, y); c.stroke(); }
    }

    draw() {
      if (!this.w || !this.h) return;
      this.clear();
      if (this.kind === 'trajectory') this.drawTrajectory();
      else this.drawField();
      this.slider.value = this.t;
    }

    trajectoryPoint(p, t) {
      const s = ease(t);
      return {
        x: lerp(p.p0.x, p.p1.x, s),
        y: lerp(p.p0.y, p.p1.y, s) + Math.sin(Math.PI * s) * p.bend * Math.sin(Math.PI * p.p0.y)
      };
    }

    drawTrajectory() {
      const c = this.ctx, w = this.w, h = this.h;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const accent = dark ? '#60a5fa' : '#2563eb';
      const secondary = dark ? '#94a3b8' : '#64748b';
      const px = p => ({ x: p.x * w, y: p.y * h });
      const label = (text, x, color) => { c.fillStyle = color; c.font = '600 11px ui-monospace, monospace'; c.fillText(text, x, 20); };
      label('p₀  simple', 14, secondary);
      label('p₁  data', w - 78, accent);

      this.points.slice(0, 16).forEach(p => {
        c.beginPath();
        for (let j = 0; j <= 44; j++) {
          const q = px(this.trajectoryPoint(p, j / 44));
          j ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
        }
        c.strokeStyle = dark ? 'rgba(148,163,184,.22)' : 'rgba(100,116,139,.20)'; c.lineWidth = 1; c.stroke();
      });

      this.points.forEach((p, i) => {
        const q0 = px(p.p0), q1 = px(p.p1), q = px(this.trajectoryPoint(p, this.t));
        c.fillStyle = dark ? 'rgba(148,163,184,.26)' : 'rgba(100,116,139,.22)'; c.beginPath(); c.arc(q0.x, q0.y, 2.2, 0, TAU); c.fill();
        c.fillStyle = dark ? 'rgba(96,165,250,.24)' : 'rgba(37,99,235,.20)'; c.beginPath(); c.arc(q1.x, q1.y, 2.2, 0, TAU); c.fill();
        c.fillStyle = i % 2 ? accent : secondary; c.beginPath(); c.arc(q.x, q.y, 3.1, 0, TAU); c.fill();
      });
    }

    fieldAt(x, y, t) {
      const phase = TAU * t;
      return {
        x: 0.72 + 0.34 * Math.cos(phase + y * 2.7) - 0.18 * y,
        y: 0.60 * Math.sin(phase + x * 2.5) + 0.25 * Math.cos(phase * 2 - y * 1.8)
      };
    }

    integrate(seed, t) {
      const path = [{ ...seed }], n = Math.max(1, Math.ceil(t * 90)), dt = t / n;
      let p = { ...seed };
      for (let i = 0; i < n; i++) {
        const v = this.fieldAt(p.x, p.y, i * dt);
        p = { x: p.x + v.x * dt * 0.78, y: p.y + v.y * dt * 0.78 };
        path.push({ ...p });
      }
      return path;
    }

    arrow(x, y, vx, vy, color) {
      const c = this.ctx, mag = Math.hypot(vx, vy), ux = vx / mag, uy = vy / mag;
      const len = clamp(mag * 17, 8, 22), x2 = x + ux * len, y2 = y + uy * len;
      c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.25;
      c.beginPath(); c.moveTo(x - ux * len * .36, y - uy * len * .36); c.lineTo(x2, y2); c.stroke();
      c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - ux * 5 - uy * 3, y2 - uy * 5 + ux * 3); c.lineTo(x2 - ux * 5 + uy * 3, y2 - uy * 5 - ux * 3); c.closePath(); c.fill();
    }

    drawField() {
      const c = this.ctx, w = this.w, h = this.h;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const cols = w < 520 ? 10 : 16, rows = w < 520 ? 7 : 10;
      for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < cols; ix++) {
        const nx = ix / (cols - 1), ny = iy / (rows - 1), v = this.fieldAt(nx * 2 - 1, ny * 2 - 1, this.t);
        const mag = clamp(Math.hypot(v.x, v.y) / 1.35);
        const alpha = lerp(.34, .88, mag);
        this.arrow(18 + nx * (w - 36), 18 + ny * (h - 36), v.x, v.y, dark ? `rgba(96,165,250,${alpha})` : `rgba(37,99,235,${alpha})`);
      }
      const seeds = [{x:.06,y:.2},{x:.08,y:.48},{x:.05,y:.76}];
      seeds.forEach((seed, index) => {
        const path = this.integrate(seed, this.t);
        c.beginPath();
        path.forEach((p, i) => { const x = p.x*w, y=p.y*h; i ? c.lineTo(x,y) : c.moveTo(x,y); });
        c.strokeStyle = index === 1 ? (dark ? '#e2e8f0' : '#334155') : (dark ? 'rgba(226,232,240,.35)' : 'rgba(51,65,85,.3)'); c.lineWidth = index === 1 ? 1.8 : 1.1; c.stroke();
        const p = path[path.length-1]; c.fillStyle = index === 1 ? (dark ? '#e2e8f0' : '#334155') : (dark ? '#94a3b8' : '#64748b'); c.beginPath(); c.arc(p.x*w,p.y*h,index===1?4:3,0,TAU); c.fill();
      });
      c.fillStyle = dark ? '#cbd5e1' : '#475569'; c.font = '600 11px ui-monospace, monospace'; c.fillText('uₜ(x)', 14, 20);
    }

  }

  const init = () => document.querySelectorAll('[data-flow-viz]').forEach(root => {
    if (!root.__flowViz) root.__flowViz = new FlowViz(root);
  });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
