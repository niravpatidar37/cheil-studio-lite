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
  const d = design || {};
  const variant = templateFor(emailType);
  const set = (patch) => onDesignChange?.({ ...d, ...patch });

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
              className={`flex w-full items-center gap-2 rounded-md border p-1.5 text-left transition-colors ${background === p.label
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
        <p className="mb-2 text-sm font-semibold text-white">Design & Typography</p>

        <Row label="Layout Theme">
          <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
            {["classic", "prestige", "bold"].map((th) => (
              <button
                key={th}
                onClick={() => set({ theme: th })}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${(d.theme || "classic") === th
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                  }`}
              >
                {th}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Button colour">
          <div className="flex flex-wrap gap-1.5">
            {ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => set({ accent: c })}
                title={c}
                className={`h-6 w-6 rounded-full border transition-transform ${(d.accent || "#111111") === c
                  ? "scale-110 border-white"
                  : "border-neutral-700 hover:border-neutral-500"
                  }`}
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              value={d.accent || "#111111"}
              onChange={(e) => set({ accent: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded-full border border-neutral-700 bg-transparent p-0"
              title="Custom colour"
            />
          </div>
        </Row>

        <label className="mt-5 flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={d.showProduct !== false}
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
