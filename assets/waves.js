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

  // The glow is faked with a few wide, faint strokes of the same path.
  // (ctx.shadowBlur looked the same but cost 23-87 ms per frame; this is 3-5 ms.)
  const layers = [
    (wv) => [wv.glow * 1.6, 0.025],
    (wv) => [wv.glow * 0.7, 0.05],
    (wv) => [wv.width * 3, 0.12],
    (wv) => [wv.width, 0.5],
  ];

  function draw(wave) {
    const step = Math.max(4, w / 320);
    ctx.beginPath();
    ctx.moveTo(0, y(wave, 0));
    for (let x = step; x <= w + step; x += step) ctx.lineTo(x, y(wave, x));
    const dim = w < 700 ? 0.6 : 1;
    for (const layer of layers) {
      const [lineWidth, alpha] = layer(wave);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = `rgba(${wave.rgb},${alpha * dim})`;
      ctx.stroke();
    }
  }

  function frame(now) {
    const dt = Math.min(50, now - (prev || now)) / 1000;
    prev = now;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const wave of waves) {
      if (!still) wave.phase += wave.speed * dt;
      draw(wave);
    }
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
