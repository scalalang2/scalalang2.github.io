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
      else if (this.kind === 'field') this.drawField();
      else if (this.kind === 'divergence') this.drawDivergence();
      else if (this.kind === 'diffusion-vs-flow') this.drawDiffusionVsFlow();
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

    drawDivergence() {
      const c = this.ctx, w = this.w, h = this.h;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const ink = dark ? '#e2e8f0' : '#334155';
      const muted = dark ? '#94a3b8' : '#64748b';
      const accent = dark ? '#60a5fa' : '#2563eb';
      const purple = dark ? '#a78bfa' : '#8b5cf6';
      const border = dark ? 'rgba(148,163,184,.22)' : 'rgba(100,116,139,.20)';
      const gap = Math.max(8, w * .018), margin = Math.max(10, w * .025);
      const panelW = (w - margin * 2 - gap * 2) / 3;
      const panels = [
        { mode: 'outflow', formula: '∇·u > 0', detail: '퍼져 나감', color: accent },
        { mode: 'inflow', formula: '∇·u < 0', detail: '한곳으로 모임', color: purple },
        { mode: 'same', formula: '∇·u = 0', detail: '그대로 통과', color: muted }
      ];

      panels.forEach((panel, panelIndex) => {
        const left = margin + panelIndex * (panelW + gap), top = 8, panelH = h - 18;
        const cx = left + panelW / 2, cy = top + panelH * .58;
        const radius = Math.min(panelW, panelH) * .34;
        c.strokeStyle = border; c.lineWidth = 1; c.strokeRect(left, top, panelW, panelH);
        c.textAlign = 'center'; c.fillStyle = panel.color;
        c.font = `700 ${w < 520 ? 9 : 11}px ui-monospace, monospace`; c.fillText(panel.formula, cx, 27);
        c.fillStyle = ink; c.font = `500 ${w < 520 ? 8 : 10}px system-ui, sans-serif`; c.fillText(panel.detail, cx, 43);

        if (panel.mode === 'same') {
          const cols = w < 520 ? 3 : 4, rows = 4;
          for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
            const x = left + 14 + col * ((panelW - 28) / (cols - 1));
            const y = top + 58 + row * ((panelH - 78) / (rows - 1));
            this.arrow(x, y, 1, 0, dark ? 'rgba(148,163,184,.54)' : 'rgba(71,85,105,.48)');
          }
          for (let i = 0; i < 14; i++) {
            const progress = (this.t + i / 14) % 1;
            const x = left + 7 + progress * (panelW - 14), y = cy + ((i % 4) - 1.5) * Math.min(22, panelH * .11);
            const alpha = .25 + .75 * Math.sin(Math.PI * progress);
            c.fillStyle = `rgba(100,116,139,${alpha})`; c.beginPath(); c.arc(x, y, 2.8, 0, TAU); c.fill();
          }
          return;
        }

        const direction = panel.mode === 'outflow' ? 1 : -1;
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU, ux = Math.cos(a), uy = Math.sin(a);
          this.arrow(cx + ux * radius * .42, cy + uy * radius * .42, ux * direction, uy * direction,
            panel.mode === 'outflow' ? (dark ? 'rgba(96,165,250,.68)' : 'rgba(37,99,235,.62)') : (dark ? 'rgba(167,139,250,.68)' : 'rgba(139,92,246,.62)'));
        }
        for (let i = 0; i < 18; i++) {
          const a = i * 2.399963, base = (this.t + i / 18) % 1;
          const progress = direction > 0 ? base : 1 - base;
          const r = lerp(6, radius, progress), alpha = .22 + .78 * Math.sin(Math.PI * progress);
          c.globalAlpha = alpha; c.fillStyle = panel.color; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.8, 0, TAU); c.fill(); c.globalAlpha = 1;
        }
        c.fillStyle = ink; c.beginPath(); c.arc(cx, cy, 3.5, 0, TAU); c.fill();
      });
      c.textAlign = 'start';
    }

    comparisonPoint(index, t, isDiffusion) {
      const start = { x: .10, y: .72 - index * .11 };
      const end = { x: .88, y: .31 + index * .095 };
      if (!isDiffusion) {
        return {
          x: lerp(start.x, end.x, t),
          y: lerp(start.y, end.y, t) - Math.sin(Math.PI * t) * (.09 + index * .008)
        };
      }
      const steps = 8, stepped = Math.floor(t * steps) / steps;
      const s = clamp(stepped);
      const zig = Math.sin(s * steps * Math.PI * .92 + index * 1.7) * .10 * Math.sin(Math.PI * s);
      return { x: lerp(start.x, end.x, s), y: lerp(start.y, end.y, s) + zig };
    }

    drawComparisonPath(panel, index, isDiffusion, color) {
      const c = this.ctx, steps = isDiffusion ? 8 : 44;
      c.beginPath();
      for (let j = 0; j <= steps; j++) {
        const q = this.comparisonPoint(index, j / steps, isDiffusion);
        const x = panel.left + q.x * panel.width, y = panel.top + q.y * panel.height;
        j ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.strokeStyle = color; c.lineWidth = 1.1; c.stroke();
    }

    drawDiffusionVsFlow() {
      const c = this.ctx, w = this.w, h = this.h;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const ink = dark ? '#e2e8f0' : '#334155', muted = dark ? '#94a3b8' : '#64748b', accent = dark ? '#60a5fa' : '#2563eb';
      const border = dark ? 'rgba(148,163,184,.22)' : 'rgba(100,116,139,.20)';
      const gap = Math.max(10, w * .025), margin = Math.max(10, w * .025), top = 42, panelH = h - top - 16;
      const panelW = (w - margin * 2 - gap) / 2;
      const panels = [
        { left: margin, top, width: panelW, height: panelH, title: 'Diffusion', subtitle: '여러 단계로 노이즈 제거', diffusion: true },
        { left: margin + panelW + gap, top, width: panelW, height: panelH, title: 'Flow', subtitle: '벡터장을 따라 연속 이동', diffusion: false }
      ];
      const step = Math.min(8, Math.floor(this.t * 8) + 1);

      panels.forEach(panel => {
        const cx = panel.left + panel.width / 2;
        c.strokeStyle = border; c.lineWidth = 1; c.strokeRect(panel.left, panel.top, panel.width, panel.height);
        c.textAlign = 'center'; c.fillStyle = ink; c.font = `700 ${w < 520 ? 11 : 13}px system-ui, sans-serif`; c.fillText(panel.title, cx, 17);
        c.fillStyle = muted; c.font = `500 ${w < 520 ? 8 : 10}px system-ui, sans-serif`; c.fillText(panel.subtitle, cx, 33);

        for (let i = 0; i < 5; i++) this.drawComparisonPath(panel, i, panel.diffusion, border);
        for (let i = 0; i < 5; i++) {
          const q0 = this.comparisonPoint(i, 0, panel.diffusion), q1 = this.comparisonPoint(i, 1, panel.diffusion), q = this.comparisonPoint(i, this.t, panel.diffusion);
          const map = p => ({ x: panel.left + p.x * panel.width, y: panel.top + p.y * panel.height });
          const a = map(q0), b = map(q1), p = map(q);
          c.fillStyle = dark ? 'rgba(148,163,184,.28)' : 'rgba(100,116,139,.24)'; c.beginPath(); c.arc(a.x, a.y, 2.2, 0, TAU); c.fill();
          c.fillStyle = dark ? 'rgba(96,165,250,.25)' : 'rgba(37,99,235,.20)'; c.beginPath(); c.arc(b.x, b.y, 2.2, 0, TAU); c.fill();
          c.fillStyle = i % 2 ? accent : ink; c.beginPath(); c.arc(p.x, p.y, 3.2, 0, TAU); c.fill();
        }
        c.fillStyle = muted; c.font = `600 ${w < 520 ? 8 : 10}px ui-monospace, monospace`;
        c.fillText(panel.diffusion ? `step ${step}/8` : `t = ${this.t.toFixed(2)}`, cx, panel.top + panel.height - 8);
      });
      c.textAlign = 'start';
    }

  }

  const init = () => document.querySelectorAll('[data-flow-viz]').forEach(root => {
    if (!root.__flowViz) root.__flowViz = new FlowViz(root);
  });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
