import { BACKGROUND_PRESETS } from "../lib/backgroundPresets";
import { TextArea } from "../components/form";

const TEXT_COLORS = ["#FFFFFF", "#E5E5E5", "#000000", "#111111", "#6C5CE7", "#7FD8E8"];

function Row({ label, children }) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

function Swatches({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TEXT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          className={`h-6 w-6 rounded-full border transition-transform ${value === c ? "border-white scale-110" : "border-neutral-700 hover:border-neutral-500"
            }`}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 cursor-pointer rounded-full border border-neutral-700 bg-transparent p-0"
        title="Custom colour"
      />
    </div>
  );
}

export default function BannerControls({
  selectedId,
  layers,
  onLayersChange,
  logo,
  onLogoChange,
  backgroundMode,
  onBackgroundModeChange,
  backgroundStyle,
  onBackgroundStyleChange,
  onGenerateBackground,
  generating,
  hasAiImage,
  onFieldChange,
}) {
  const isLogo = selectedId === "logo";
  const layer = !isLogo && selectedId ? layers[selectedId] : null;

  const update = (patch) => onLayersChange({ ...layers, [selectedId]: { ...layer, ...patch } });

  return (
    <div className="space-y-5 rounded-xl border border-neutral-800 bg-[#111111] p-4">
      {/* Background */}
      <div>
        <p className="mb-2 text-sm font-semibold text-white">Background</p>
        <div className="mb-3 flex gap-1.5">
          {["ai", "preset"].map((m) => (
            <button
              key={m}
              onClick={() => onBackgroundModeChange(m)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${backgroundMode === m
                  ? "border-white bg-white font-semibold text-black"
                  : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                }`}
            >
              {m === "ai" ? "AI image" : "Gradient / solid"}
            </button>
          ))}
        </div>

        {backgroundMode === "ai" ? (
          <button
            onClick={onGenerateBackground}
            disabled={generating}
            className="w-full rounded-md border border-white bg-white py-2 text-xs font-semibold text-black transition-colors hover:bg-[#0b0b0b] hover:text-white disabled:opacity-40"
          >
            {generating ? "Generating image…" : hasAiImage ? "Regenerate image" : "Generate AI image"}
          </button>
        ) : (
          <div className="space-y-1.5">
            {BACKGROUND_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => onBackgroundStyleChange(p.label)}
                className={`flex w-full items-center gap-2 rounded-md border p-1.5 text-left transition-colors ${backgroundStyle === p.label ? "border-white bg-white/5" : "border-neutral-800 hover:border-neutral-600"
                  }`}
              >
                <div className="h-5 w-5 shrink-0 rounded-[4px] border border-white/15 shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)]" style={{ background: p.css }} />
                <span className="text-xs text-neutral-300">{p.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <hr className="border-neutral-800" />

      {/* Layer controls */}
      <div>
        <p className="mb-2 text-sm font-semibold text-white">
          {isLogo ? "Samsung logo" : layer ? `${selectedId === "headline" ? "Headline" : "Body"} text` : "Layer"}
        </p>

        {!selectedId && (
          <p className="text-xs leading-relaxed text-neutral-500">
            Click any text or the logo on the canvas to select it — then edit the wording,
            restyle it, or drag to reposition.
          </p>
        )}

        {isLogo && (
          <>
            <Row label={`Size — ${logo.sizePct.toFixed(1)}%`}>
              <input
                type="range"
                min="4"
                max="30"
                step="0.5"
                value={logo.sizePct}
                onChange={(e) => onLogoChange({ ...logo, sizePct: Number(e.target.value) })}
                className="w-full accent-white"
              />
            </Row>
            <Row label="Colour">
              <div className="flex gap-1.5">
                {["#FFFFFF", "#000000"].map((c) => (
                  <button
                    key={c}
                    onClick={() => onLogoChange({ ...logo, color: c })}
                    className={`h-6 w-6 rounded-full border ${logo.color === c ? "border-white scale-110" : "border-neutral-700"
                      }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </Row>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={logo.show}
                onChange={(e) => onLogoChange({ ...logo, show: e.target.checked })}
                className="h-3.5 w-3.5 accent-white"
              />
              Show logo
            </label>
          </>
        )}

        {layer && (
          <>
            {/* Edits go up to the campaign's copy, not into the canvas layer.
                The layer text is fed back down from there, so the banner, the
                quality check and the exported .txt can never disagree. */}
            <Row label="Text">
              <TextArea
                value={layer.text || ""}
                onChange={(v) => onFieldChange?.(selectedId, v)}
                rows={selectedId === "headline" ? 2 : 4}
              />
            </Row>
            <Row label={`Size — ${layer.sizePct.toFixed(1)}%`}>
              <input
                type="range"
                min="1"
                max="20"
                step="0.1"
                value={layer.sizePct}
                onChange={(e) => update({ sizePct: Number(e.target.value) })}
                className="w-full accent-white"
              />
            </Row>
            <Row label="Weight">
              <div className="flex gap-1.5">
                {[400, 600, 700, 800].map((w) => (
                  <button
                    key={w}
                    onClick={() => update({ weight: w })}
                    className={`flex-1 rounded-md border py-1 text-xs transition-colors ${layer.weight === w
                        ? "border-white bg-white font-semibold text-black"
                        : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                      }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Colour">
              <Swatches value={layer.color} onChange={(c) => update({ color: c })} />
            </Row>
          </>
        )}
      </div>
    </div>
  );
}
