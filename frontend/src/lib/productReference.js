// The catalog ships product shots as AVIF, which the image model does not
// accept as input (PNG / JPEG / WEBP only). Browsers decode AVIF natively, so
// the conversion happens here rather than adding an image-codec dependency to
// the backend — and it guarantees the reference sent to the model is exactly
// the image the user picked on the Product step.

const cache = new Map();

/** Decode a catalog product image and return it as a PNG data URL. */
export function productReferencePng(url) {
  if (!url) return Promise.resolve("");
  if (cache.has(url)) return cache.get(url);

  const job = (async () => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    } catch {
      // Generation still works without a reference, just ungrounded — better
      // than failing the whole step over a missing thumbnail.
      return "";
    }
  })();

  cache.set(url, job);
  return job;
}
