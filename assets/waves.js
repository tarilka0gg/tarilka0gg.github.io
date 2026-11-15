// Three slow glowing sine waves on a full-screen canvas.
// Colours match the profile README: violet, cyan, green.
(function () {
  "use strict";
  const canvas = document.querySelector(".waves canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const waves = [
    { rgb: "124,92,255", amp: 0.16, freq: 0.75, speed: 0.11, phase: 0.0, width: 1.6, glow: 18 },
    { rgb: "34,211,238", amp: 0.11, freq: 1.15, speed: 0.17, phase: 1.9, width: 1.2, glow: 14 },
    { rgb: "126,231,135", amp: 0.07, freq: 1.70, speed: 0.23, phase: 3.4, width: 1.0, glow: 11 },
  ];

  let w = 0, h = 0, center = 0, ampBase = 0, prev = 0, running = true;

  function layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Sit the waves in the empty band between the motto/content and the footer.
    const mobile = w < 700;
    const inner = document.body.classList.contains("inner");
    center = h * (inner ? 0.88 : mobile ? 0.6 : 0.66);
    ampBase = h * (inner ? 0.06 : mobile ? 0.08 : 0.14);
  }

  function y(wave, x) {
    const breathe = 0.75 + 0.25 * Math.sin(wave.phase * 0.6);
    const t = (x / w) * Math.PI * 2 * wave.freq + wave.phase;
    return center + Math.sin(t) * ampBase * (wave.amp / 0.16) * breathe;
  }

  function stroke(wave, lineWidth, alpha, blur) {
    const step = Math.max(3, w / 300);
    ctx.beginPath();
    ctx.moveTo(0, y(wave, 0));
    for (let x = step; x <= w + step; x += step) ctx.lineTo(x, y(wave, x));
    const a = w < 700 ? alpha * 0.6 : alpha;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `rgba(${wave.rgb},${a})`;
    ctx.shadowColor = `rgba(${wave.rgb},${a})`;
    ctx.shadowBlur = blur;
    ctx.stroke();
  }

  function frame(now) {
    const dt = Math.min(50, now - (prev || now)) / 1000;
    prev = now;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const wave of waves) {
      if (!still) wave.phase += wave.speed * dt;
      stroke(wave, wave.glow, 0.04, wave.glow * 1.5); // soft halo
    }
    for (const wave of waves) stroke(wave, wave.width, 0.45, wave.glow * 0.4); // bright core
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    if (running && !still) requestAnimationFrame(frame);
  }

  layout();
  window.addEventListener("resize", () => { layout(); if (still) frame(0); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !still) { prev = 0; requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
})();
