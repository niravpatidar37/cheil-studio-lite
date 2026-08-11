// True output dimensions per banner format. The editor previews at a scaled
// size but exports at these pixel dimensions.
export const BANNER_SPECS = {
  Website: { w: 1600, h: 900 },
  Desktop: { w: 1920, h: 1080 },
  Mobile: { w: 1080, h: 1920 },
  Hoarding: { w: 1920, h: 480 },
};

export function getSpec(bannerSize) {
  return BANNER_SPECS[bannerSize] || BANNER_SPECS.Website;
}

/**
 * The Samsung wordmark's width, as a percentage of the canvas *width*.
 *
 * `sizePct` is measured against the banner's longest edge, not its width, so
 * the mark keeps the same physical size whatever the shape. Scaling it by
 * width alone made it ~40% smaller on Mobile — the only portrait format —
 * than on every landscape one, which read as the logo being detached from the
 * layout rather than part of it.
 */
export function logoWidthPct(bannerSize, sizePct) {
  const { w, h } = getSpec(bannerSize);
  return (sizePct * Math.max(w, h)) / w;
}

// Aspect ratios actually requested from the image model — mirrors
// ASPECT_RATIOS in backend/gemini_service.py.
const GENERATED_ASPECT = {
  Website: 16 / 9,
  Desktop: 16 / 9,
  Mobile: 9 / 16,
  Hoarding: 21 / 9,
};

/**
 * How an AI background should sit inside the banner.
 *
 * "cover" where the generated frame nearly matches the banner — the couple of
 * percent that overflows is not worth a letterbox bar.
 *
 * "contain" where it does not. No supported generation ratio is anywhere near
 * Hoarding's 4:1, so covering it discards 42% of the height and reliably cuts
 * the product in half. Fitting the whole scene instead keeps it intact, and
 * the space left over becomes the text area rather than wasted bar.
 */
export function backgroundFit(bannerSize) {
  const { w, h } = getSpec(bannerSize);
  const target = w / h;
  const generated = GENERATED_ASPECT[bannerSize] ?? 16 / 9;
  const visible = generated < target ? generated / target : target / generated;
  return visible < 0.9 ? "contain" : "cover";
}

// How much of a contained image's width dissolves on its inner edge. Without
// this the scene ends on a hard vertical seam against the gradient and reads
// as two images pasted together.
export const CONTAIN_FADE = 0.18;

// The space a contained scene leaves over is filled with a blurred, dimmed
// copy of that same scene rather than the flat preset gradient. A near-black
// photograph next to a bright gradient still reads as two images however far
// the seam is feathered; a blurred extension of itself always matches.
// Blur is a percentage of width so the preview and the export agree.
export const BACKDROP_BLUR_PCT = 3;
export const BACKDROP_DIM = 0.55;
// Overscale so the blur samples past the edges instead of smearing them in.
export const BACKDROP_SCALE = 1.15;

/**
 * CSS mask that fades a contained image into the gradient beside it.
 *
 * The stops are expressed against the *container* width, not the image, since
 * that is what a CSS mask spans — so the image's fitted left edge has to be
 * worked out first. Uses the nominal generated ratio, which is within ~2% of
 * what the model returns; over a soft fade that error is invisible.
 */
export function containMaskCss(bannerSize) {
  const { w, h } = getSpec(bannerSize);
  const drawnW = h * (GENERATED_ASPECT[bannerSize] ?? 16 / 9);
  const start = Math.max(0, (w - drawnW) / w);
  const end = start + (drawnW / w) * CONTAIN_FADE;
  return `linear-gradient(to right, transparent ${(start * 100).toFixed(1)}%, #000 ${(
    end * 100
  ).toFixed(1)}%)`;
}

/**
 * Sizing for an on-screen banner box, capped so tall formats stay usable.
 * Mobile is 9:16, so at full column width it renders ~1170px tall and pushes
 * the controls off-screen; two of them (EN + FR) made the Edit step three
 * screens long.
 *
 * The cap is applied to *width*, derived from the target height, rather than
 * as a max-height. Setting max-height on an aspect-ratio box lets the box go
 * shorter than its ratio, which would desynchronise the preview from the
 * exported PNG — every layer position is a percentage of this box.
 */
export function previewStyle(bannerSize, maxHeightPx) {
  const { w, h } = getSpec(bannerSize);
  return {
    aspectRatio: `${w} / ${h}`,
    maxWidth: `${Math.round(maxHeightPx * (w / h))}px`,
    marginInline: "auto",
  };
}

export function defaultLayers(headline, body, productImage = null, productImages = [], format = "Desktop") {
  const images = productImages?.length ? productImages : (productImage ? [productImage] : []);
  const addedProducts = {};

  const isPortrait = format === "Mobile";

  if (isPortrait) {
    if (images.length === 1) {
      addedProducts.product = { src: images[0], xPct: 25, yPct: 35, sizePct: 35 };
    } else if (images.length === 2) {
      addedProducts.product0 = { src: images[0], xPct: 8, yPct: 35, sizePct: 28 };
      addedProducts.product1 = { src: images[1], xPct: 52, yPct: 42, sizePct: 24 };
    } else if (images.length > 0) {
      images.forEach((img, i) => {
        addedProducts[`product${i}`] = { src: img, xPct: 8 + (i * 24), yPct: 40, sizePct: 22 };
      });
    }
    return {
      headline: { text: headline, xPct: 8, yPct: 72, sizePct: 9, widthPct: 84, color: "#FFFFFF", weight: 700 },
      body: { text: body, xPct: 8, yPct: 84, sizePct: 4.5, widthPct: 84, color: "#E5E5E5", weight: 400 },
      ...addedProducts
    };
  }

  if (images.length === 1) {
    addedProducts.product = { src: images[0], xPct: 38, yPct: 20, sizePct: 35 };
  } else if (images.length === 2) {
    addedProducts.product0 = { src: images[0], xPct: 33, yPct: 20, sizePct: 28 };
    addedProducts.product1 = { src: images[1], xPct: 58, yPct: 26, sizePct: 22 };
  } else if (images.length > 0) {
    images.forEach((img, i) => {
      addedProducts[`product${i}`] = { src: img, xPct: 32 + (i * 18), yPct: 25, sizePct: 18 };
    });
  }

  return {
    headline: { text: headline, xPct: 6, yPct: 62, sizePct: 7.5, widthPct: 44, color: "#FFFFFF", weight: 700 },
    body: { text: body, xPct: 6, yPct: 78, sizePct: 3.2, widthPct: 44, color: "#E5E5E5", weight: 400 },
    ...addedProducts
  };
}
