import { CheckIcon } from "../components/icons";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/40 backdrop-blur-md px-4 py-3 text-sm text-white outline-none transition-all duration-300 focus:border-[#1C92D2] focus:bg-white/5 focus:shadow-[0_0_15px_rgba(28,146,210,0.3)]";

function FieldPair({ label, enKey, frKey, idea, displayLang, isTranslating, onChange, multiline, bold }) {
  const stop = (e) => e.stopPropagation();
  const Input = multiline ? "textarea" : "input";
  const extra = multiline ? { rows: 2 } : {};

  const key = displayLang === "en" ? enKey : frKey;
  const langLabel = displayLang === "en" ? "English" : "Français";

  const val = idea[key];
  const loading = displayLang === "fr" && isTranslating;

  return (
    <div className="grid grid-cols-1" onClick={stop}>
      <span className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label} — {langLabel}
      </span>
      {loading ? (
        <div className={`w-full rounded-xl border border-white/5 bg-white/5 backdrop-blur-md px-4 py-3 ${multiline ? "h-20" : "h-12"} animate-pulse flex items-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]`}>
          <span className="text-neutral-500 italic text-sm">Translating...</span>
        </div>
      ) : (
        <Input
          value={val || ""}
          onChange={(e) => onChange(key, e.target.value)}
          className={`${inputClass} ${bold ? "font-semibold" : ""}`}
          {...extra}
        />
      )}
    </div>
  );
}

export default function IdeaCard({ idea, selected, displayLang = "en", isTranslating = false, onSelect, onChange }) {
  return (
    <div
      onClick={onSelect}
      className={`glass-pane cursor-pointer rounded-3xl p-7 transition-all duration-300 relative group overflow-hidden ${selected ? "border-[#6441a5]/50 bg-[#6441a5]/10 shadow-[0_0_30px_rgba(100,65,165,0.25)] scale-[1.01]" : "border-white/5 hover:border-white/20 hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl"
        }`}
    >
      {selected && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C92D2]/10 via-[#6441a5]/10 to-transparent pointer-events-none" />
      )}
      <div className="mb-5 flex items-center gap-3 relative z-10">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${selected ? "border-[#1C92D2] bg-[#1C92D2]/20 text-[#1C92D2]" : "border-neutral-600 bg-transparent group-hover:border-neutral-400"
            }`}
        >
          {selected && <CheckIcon size={12} />}
        </span>
        <span className={`text-base font-bold tracking-wide transition-colors ${selected ? "text-white" : "text-neutral-300 group-hover:text-white"}`}>Direction {idea.id}</span>
        <span className="truncate text-xs text-neutral-500 ml-auto bg-black/40 px-3 py-1.5 rounded-full border border-white/5">{idea.en}</span>
      </div>

      <div className="space-y-5 relative z-10">
        <FieldPair label="Headline" enKey="headline_en" frKey="headline_fr" idea={idea} displayLang={displayLang} isTranslating={isTranslating} onChange={onChange} bold />
        <FieldPair label="Body copy" enKey="body_en" frKey="body_fr" idea={idea} displayLang={displayLang} isTranslating={isTranslating} onChange={onChange} multiline />
      </div>
    </div>
  );
}
