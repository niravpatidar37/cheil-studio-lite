import { BACKGROUND_PRESETS } from "../lib/backgroundPresets";
import { templateFor } from "../lib/emailTemplate";

const ACCENTS = ["#111111", "#1428A0", "#6C5CE7", "#0F2027", "#B00020"];

const VARIANT_NOTE = {
  preference: "Choices lead the layout — the reader tailors what they receive.",
  offer: "Headline reverses out of the brand colour, with one prominent action.",
  editorial: "A read rather than a pitch, so there is no product hero.",
  update: "Product-led, aimed at someone who already owns it.",
  hero: "Full product hero for a first introduction.",
};

function Row({ label, children }) {
  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Design controls for the email, matching what the banner editor offers:
 * the same background presets, plus the choices that actually mean something
 * in an email (accent colour, product shot on or off).
 */
export default function EmailControls({
  background,
  onBackgroundChange,
  design = {},
  onDesignChange,
  emailType,
}) {
  const variant = templateFor(emailType);
  const set = (patch) => onDesignChange?.({ ...design, ...patch });

  return (
    <div className="space-y-5 rounded-xl border border-neutral-800 bg-[#111111] p-4">
      <div>
        <p className="mb-1 text-sm font-semibold text-white">Template</p>
        <p className="text-xs leading-relaxed text-neutral-500">
          <span className="text-neutral-300">{emailType}</span> — {VARIANT_NOTE[variant]}
        </p>
      </div>

      <hr className="border-neutral-800" />

      <div>
        <p className="mb-2 text-sm font-semibold text-white">Background</p>
        <div className="space-y-1.5">
          {BACKGROUND_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => onBackgroundChange?.(p.label)}
              className={`flex w-full items-center gap-2 rounded-md border p-1.5 text-left transition-colors ${
                background === p.label
                  ? "border-white bg-white/5"
                  : "border-neutral-800 hover:border-neutral-600"
              }`}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-full border border-neutral-700"
                style={{ background: p.css }}
              />
              <span className="text-xs text-neutral-300">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <hr className="border-neutral-800" />

      <div>
        <p className="mb-2 text-sm font-semibold text-white">Design</p>
        <Row label="Button colour">
          <div className="flex flex-wrap gap-1.5">
            {ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => set({ accent: c })}
                title={c}
                className={`h-6 w-6 rounded-full border transition-transform ${
                  (design.accent || "#111111") === c
                    ? "scale-110 border-white"
                    : "border-neutral-700 hover:border-neutral-500"
                }`}
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              value={design.accent || "#111111"}
              onChange={(e) => set({ accent: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded-full border border-neutral-700 bg-transparent p-0"
              title="Custom colour"
            />
          </div>
        </Row>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={design.showProduct !== false}
            onChange={(e) => set({ showProduct: e.target.checked })}
            className="h-3.5 w-3.5 accent-white"
          />
          Show product image
          {variant === "editorial" && (
            <span className="text-neutral-600">(not used by this template)</span>
          )}
        </label>
      </div>
    </div>
  );
}
