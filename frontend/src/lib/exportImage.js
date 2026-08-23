import {
  getSpec,
  backgroundFit,
  CONTAIN_FADE,
  BACKDROP_BLUR_PCT,
  BACKDROP_DIM,
  BACKDROP_SCALE,
} from "./bannerSpecs";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Paint a CSS-style background value (solid hex or linear-gradient) onto the canvas. */
function paintBackground(ctx, css, w, h) {
  if (css.startsWith("linear-gradient")) {
    // Parse the colour stops out of the gradient string; we always render it
    // as a top-left → bottom-right diagonal, which matches the CSS 135deg used
    // in the presets closely enough for a banner.
    const stops = css.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g) || ["#000000", "#000000"];
    const grad = ctx.createLinearGradient(0, 0, w, h);
    stops.forEach((c, i) => grad.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = css;
  }
  ctx.fillRect(0, 0, w, h);
}

/** Word-wrap text to a max width, returning the lines. */
function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Composite a banner to a PNG blob at the format's true dimensions.
 * Layer order: background → logo → text layers.
 */
export async function renderBanner({ bannerSize, backgroundCss, backgroundImage, layers, logo }) {
  const { w, h } = getSpec(bannerSize);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // 1. Background — always paint the CSS value first, then lay the AI image
  // over it using the same fit rule as the on-screen preview. A "contain" fit
  // deliberately leaves gradient visible beside the scene, so the base coat
  // must be there. Preview and export have to agree exactly: every layer below
  // is positioned as a percentage of this same box.
  paintBackground(ctx, backgroundCss, w, h);
  if (backgroundImage) {
    try {
      const img = await loadImage(backgroundImage);
      const fit = backgroundFit(bannerSize);
      const scale =
        fit === "cover"
          ? Math.max(w / img.width, h / img.height)
          : Math.min(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      // "contain" anchors right (object-position: right center); "cover" centres.
      const dx = fit === "contain" ? w - dw : (w - dw) / 2;
      const dy = (h - dh) / 2;

      if (fit === "contain") {
        // Fill the whole canvas with a blurred, dimmed copy first, so the
        // scene extends into itself instead of ending against a flat gradient.
        // Matches the backdrop layer in the preview.
        const bScale = Math.max(w / img.width, h / img.height) * BACKDROP_SCALE;
        const bw = img.width * bScale;
        const bh = img.height * bScale;
        ctx.save();
        ctx.filter = `blur(${(w * BACKDROP_BLUR_PCT) / 100}px) brightness(${BACKDROP_DIM})`;
        ctx.drawImage(img, (w - bw) / 2, (h - bh) / 2, bw, bh);
        ctx.restore();

        // Dissolve the inner edge into that backdrop, matching the CSS mask on
        // the preview. Done on an offscreen canvas because destination-in
        // would otherwise erase everything already painted underneath.
        const off = document.createElement("canvas");
        off.width = Math.ceil(dw);
        off.height = Math.ceil(dh);
        const octx = off.getContext("2d");
        octx.drawImage(img, 0, 0, off.width, off.height);
        octx.globalCompositeOperation = "destination-in";
        const fade = octx.createLinearGradient(0, 0, off.width * CONTAIN_FADE, 0);
        fade.addColorStop(0, "rgba(0,0,0,0)");
        fade.addColorStop(1, "rgba(0,0,0,1)");
        octx.fillStyle = fade;
        octx.fillRect(0, 0, off.width, off.height);
        ctx.drawImage(off, dx, dy);
      } else {
        ctx.drawImage(img, dx, dy, dw, dh);
      }
    } catch {
      /* the gradient underneath already covers this case */
    }
  }

  // 2. Samsung logo, top-left.
  if (logo?.show) {
    try {
      const img = await loadImage("/samsung-logo.png");
      // Measured against the longest edge, matching the cqmax preview.
      const logoW = (logo.sizePct / 100) * Math.max(w, h);
      const logoH = (img.height / img.width) * logoW;
      const x = (logo.xPct / 100) * w;
      const y = (logo.yPct / 100) * h;

      // The source wordmark is black; recolour it by masking when white is wanted.
      if (logo.color === "#FFFFFF") {
        const off = document.createElement("canvas");
        off.width = Math.ceil(logoW);
        off.height = Math.ceil(logoH);
        const octx = off.getContext("2d");
        octx.drawImage(img, 0, 0, off.width, off.height);
        octx.globalCompositeOperation = "source-in";
        octx.fillStyle = "#FFFFFF";
        octx.fillRect(0, 0, off.width, off.height);
        ctx.drawImage(off, x, y);
      } else {
        ctx.drawImage(img, x, y, logoW, logoH);
      }
    } catch {
      /* logo is optional — skip if it fails to load */
    }
  }

  // 3. Text layers and Product overlays.
  ctx.textBaseline = "top";
  for (const layer of Object.values(layers)) {
    if (layer.src) {
      try {
        const img = await loadImage(layer.src);
        // cqmax matching: scaled against longest edge
        const drawW = (layer.sizePct / 100) * Math.max(w, h);
        const drawH = (img.height / img.width) * drawW;
        const x = (layer.xPct / 100) * w;
        const y = (layer.yPct / 100) * h;
        ctx.drawImage(img, x, y, drawW, drawH);
      } catch {
        /* skip missing product overlay */
      }
      continue;
    }

    if (!layer.text?.trim()) continue;
    // Matches the cqmin basis used by the on-screen editor.
    const fontSize = (layer.sizePct / 100) * Math.min(w, h);
    ctx.font = `${layer.weight} ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = layer.color;

    const x = (layer.xPct / 100) * w;
    const y = (layer.yPct / 100) * h;
    const maxWidth = layer.widthPct ? (layer.widthPct / 100) * w : w - x - (0.06 * w);
    const lines = wrapLines(ctx, layer.text, maxWidth);
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * fontSize * 1.2));
  }

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function renderBannerDataUrl(opts) {
  const blob = await renderBanner(opts);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
