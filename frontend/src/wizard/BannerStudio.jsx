import { useEffect, useRef, useState } from "react";
import BannerEditor from "./BannerEditor";
import BannerControls from "./BannerControls";
import { defaultLayers } from "../lib/bannerSpecs";
import { getBackgroundCss } from "../lib/backgroundPresets";
import { runImageJob, imageUrl } from "../lib/api";
import { productReferencePng } from "../lib/productReference";

/**
 * Editable banner canvas for one format + language. Owns its own layer state,
 * seeded from the generated copy, and reports the composited config upward so
 * the export step can render it at full resolution.
 */
export default function BannerStudio({
  bannerSize,
  headline,
  body,
  product,
  ideaEn,
  audiences,
  initialStyle,
  productImage,
  productImages,
  initialImage,
  onConfigChange,
  onFieldChange,
}) {
  const [layers, setLayers] = useState(() => defaultLayers(headline, body, productImage, productImages, bannerSize));
  const [logo, setLogo] = useState({ show: true, xPct: 4, yPct: 6, sizePct: 12, color: "#FFFFFF" });
  const [selectedId, setSelectedId] = useState(null);

  // Start on the AI image when one was generated upstream in the Assets step.
  const [backgroundMode, setBackgroundMode] = useState(initialImage ? "ai" : "preset");
  const [backgroundStyle, setBackgroundStyle] = useState(initialStyle);
  const [aiImage, setAiImage] = useState(initialImage || null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Keep layer text in sync when the upstream copy is edited.
  useEffect(() => {
    setLayers((prev) => ({
      ...prev,
      headline: { ...prev.headline, text: headline },
      body: { ...prev.body, text: body },
    }));
  }, [headline, body]);

  // Image generation may still be in flight when this mounts, so adopt the
  // upstream image whenever it arrives.
  useEffect(() => {
    if (initialImage) {
      setAiImage(initialImage);
      setBackgroundMode("ai");
    }
  }, [initialImage]);

  const backgroundCss = getBackgroundCss(backgroundStyle);
  const backgroundImage = backgroundMode === "ai" ? aiImage : null;

  // Publish the current config so the export step can re-render it.
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;
  useEffect(() => {
    onConfigChangeRef.current?.({ bannerSize, backgroundCss, backgroundImage, layers, logo });
  }, [bannerSize, backgroundCss, backgroundImage, layers, logo]);

  const handleGenerateBackground = async () => {
    setGenerating(true);
    setError(null);
    try {
      // Same product grounding as the batch step, so regenerating one banner
      // cannot swap in a different-looking device. Uses the same job pipeline —
      // a single regenerate is just a one-format batch.
      const reference = await productReferencePng(productImage);
      const result = await runImageJob({
        product,
        ideaEn,
        style: backgroundStyle,
        bannerSizes: [bannerSize],
        audiences,
        productImage: reference,
      });
      setAiImage(imageUrl(result.images[bannerSize]));
      setBackgroundMode("ai");
    } catch (err) {
      setError(err.message);
      setBackgroundMode("preset");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
          Image generation failed — {error}. Using a preset background.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_240px]">
        <BannerEditor
          bannerSize={bannerSize}
          backgroundCss={backgroundCss}
          backgroundImage={backgroundImage}
          layers={layers}
          onLayersChange={setLayers}
          logo={logo}
          onLogoChange={setLogo}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <BannerControls
          selectedId={selectedId}
          layers={layers}
          onLayersChange={setLayers}
          logo={logo}
          onLogoChange={setLogo}
          backgroundMode={backgroundMode}
          onBackgroundModeChange={setBackgroundMode}
          backgroundStyle={backgroundStyle}
          onBackgroundStyleChange={setBackgroundStyle}
          onGenerateBackground={handleGenerateBackground}
          generating={generating}
          hasAiImage={!!aiImage}
          onFieldChange={onFieldChange}
        />
      </div>
    </div>
  );
}
