import { useEffect, useRef, useState } from "react";
import { buildEmailHtml } from "../lib/emailTemplate";

// Emails are laid out at a fixed 600px. Letting the iframe be narrower does
// not reflow them — a table that wide simply overflows and gets clipped — so
// the frame stays 600px and is scaled down to fit the column instead.
const EMAIL_WIDTH = 600;

/**
 * Read-only render of the exact HTML the ZIP contains.
 *
 * An iframe, not React markup: the layout has to stand up in a mail client on
 * its own, and rendering it inline would let the app's stylesheet quietly prop
 * it up.
 */
export default function EmailPreview({
  data,
  product,
  inline,
  lang,
  emailType,
  background,
  design,
  height = 560,
}) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    // clientWidth is 0 before the first layout pass; scaling by that would
    // divide the iframe height into Infinity.
    const measure = () =>
      setScale(el.clientWidth > 0 ? Math.min(1, el.clientWidth / EMAIL_WIDTH) : 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const html = buildEmailHtml({
    copy: data,
    product,
    productImage: inline?.productImage,
    productImages: inline?.productImages,
    logoImage: inline?.logoImage,
    lang,
    emailType,
    background,
    design,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="border-b border-neutral-800 px-3 py-2">
        <p className="truncate text-xs text-neutral-400">
          <span className="text-neutral-200">Samsung</span> · {data.subject || "(no subject)"}
        </p>
        <p className="truncate text-[11px] text-neutral-600">{data.preheader}</p>
      </div>
      <div ref={wrapRef} className="overflow-hidden bg-white" style={{ height }}>
        <iframe
          title={`Email preview ${lang}`}
          srcDoc={html}
          scrolling="no"
          className="border-0 bg-white"
          style={{
            width: EMAIL_WIDTH,
            // Taller by the inverse of the scale so the visible area still
            // fills the box once it shrinks.
            height: height / scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}
