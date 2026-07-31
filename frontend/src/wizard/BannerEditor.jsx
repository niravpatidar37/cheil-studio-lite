import { useRef, useState, useCallback } from "react";
import {
  previewStyle,
  backgroundFit,
  containMaskCss,
  logoWidthPct,
  BACKDROP_BLUR_PCT,
  BACKDROP_DIM,
  BACKDROP_SCALE,
} from "../lib/bannerSpecs";
import { snapLogoY, LOGO_TOP_MAX_PCT, LOGO_BOTTOM_MIN_PCT } from "../lib/logoZones";

/**
 * Interactive banner canvas. Text layers and the Samsung logo are draggable
 * DOM overlays positioned in percentages, so the same coordinates drive both
 * this preview and the full-resolution PNG export.
 */
export default function BannerEditor({
  bannerSize,
  backgroundCss,
  backgroundImage,
  layers,
  onLayersChange,
  logo,
  onLogoChange,
  selectedId,
  onSelect,
}) {
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback(
    (e, id) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(id);
      const rect = frameRef.current.getBoundingClientRect();
      const current = id === "logo" ? logo : layers[id];
      dragRef.current = {
        id,
        rect,
        offsetX: e.clientX - rect.left - (current.xPct / 100) * rect.width,
        offsetY: e.clientY - rect.top - (current.yPct / 100) * rect.height,
      };
      setIsDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [layers, logo, onSelect]
  );

  const onDrag = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d) return;
      const xPct = ((e.clientX - d.rect.left - d.offsetX) / d.rect.width) * 100;
      const yPct = ((e.clientY - d.rect.top - d.offsetY) / d.rect.height) * 100;

      // Clamp against the element's own footprint so a layer can never be
      // dragged mostly off-canvas (which would clip it in the export).
      const clampTo = (v, maxPct) => Math.max(0, Math.min(maxPct, v));

      if (d.id === "logo") {
        // Brand rule: the logo lives in the top or bottom band only, so the
        // vertical position snaps to the nearest legal band while dragging
        // rather than being freely placeable over the artwork.
        // Clamp against the mark's real on-canvas width, which is no longer
        // the same number as sizePct once the longest edge drives the scale.
        onLogoChange({
          ...logo,
          xPct: clampTo(xPct, 100 - logoWidthPct(bannerSize, logo.sizePct)),
          yPct: snapLogoY(yPct, logo.sizePct * 0.25),
        });
      } else {
        onLayersChange({
          ...layers,
          [d.id]: { ...layers[d.id], xPct: clampTo(xPct, 85), yPct: clampTo(yPct, 92) },
        });
      }
    },
    [bannerSize, layers, logo, onLayersChange, onLogoChange]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  // The gradient always paints; an AI image sits on top of it as its own layer
  // so a "contain" fit leaves gradient showing rather than empty bars.
  const fit = backgroundFit(bannerSize);

  return (
    <div
      ref={frameRef}
      onPointerMove={onDrag}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onClick={() => onSelect(null)}
      className={`relative w-full overflow-hidden rounded-xl border border-neutral-700 select-none ${
        isDragging ? "cursor-grabbing" : ""
      }`}
      style={{ ...previewStyle(bannerSize, 560), containerType: "size", background: backgroundCss }}
    >
      {backgroundImage && (
        <>
          {fit === "contain" && (
            <img
              src={backgroundImage}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{
                filter: `blur(${BACKDROP_BLUR_PCT}cqw) brightness(${BACKDROP_DIM})`,
                transform: `scale(${BACKDROP_SCALE})`,
              }}
            />
          )}
          <img
            src={backgroundImage}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{
              objectFit: fit,
              objectPosition: fit === "contain" ? "right center" : "center",
              ...(fit === "contain"
                ? {
                    maskImage: containMaskCss(bannerSize),
                    WebkitMaskImage: containMaskCss(bannerSize),
                  }
                : {}),
            }}
          />
        </>
      )}

      {/* Legal logo bands, surfaced only while the logo is being moved. */}
      {logo.show && (selectedId === "logo" || isDragging) && (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-white/30 bg-white/5"
            style={{ height: `${LOGO_TOP_MAX_PCT}%` }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-white/30 bg-white/5"
            style={{ height: `${100 - LOGO_BOTTOM_MIN_PCT}%` }}
          />
        </>
      )}

      {/* Samsung logo */}
      {logo.show && (
        <img
          src="/samsung-logo.png"
          alt="Samsung"
          draggable={false}
          onPointerDown={(e) => startDrag(e, "logo")}
          className={`absolute cursor-grab active:cursor-grabbing ${
            selectedId === "logo" ? "outline-2 outline-dashed outline-white/80" : ""
          }`}
          style={{
            left: `${logo.xPct}%`,
            top: `${logo.yPct}%`,
            // cqmax = 1% of the container's longer edge, matching the export.
            width: `${logo.sizePct}cqmax`,
            filter: logo.color === "#FFFFFF" ? "brightness(0) invert(1)" : "brightness(0)",
          }}
        />
      )}

      {/* Text layers */}
      {Object.entries(layers).map(([id, layer]) =>
        layer.text?.trim() ? (
          <div
            key={id}
            onPointerDown={(e) => startDrag(e, id)}
            className={`absolute cursor-grab whitespace-pre-wrap active:cursor-grabbing ${
              selectedId === id ? "outline-2 outline-dashed outline-white/80" : ""
            }`}
            style={{
              left: `${layer.xPct}%`,
              top: `${layer.yPct}%`,
              width: `${94 - layer.xPct}%`,
              // cqmin, not cqh: sized against height, a 9:16 mobile canvas gives
              // a 144px headline that wraps onto three lines and collides with
              // the body copy. The smaller edge is the stable basis across every
              // aspect ratio, and leaves the wide formats unchanged.
              fontSize: `${layer.sizePct}cqmin`,
              lineHeight: 1.2,
              color: layer.color,
              fontWeight: layer.weight,
            }}
          >
            {layer.text}
          </div>
        ) : null
      )}
    </div>
  );
}
