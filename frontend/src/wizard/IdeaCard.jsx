import { CheckIcon } from "../components/icons";

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-[#151515] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white";

function FieldPair({ label, enKey, frKey, idea, onChange, multiline, bold }) {
  const stop = (e) => e.stopPropagation();
  const Input = multiline ? "textarea" : "input";
  const extra = multiline ? { rows: 2 } : {};
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[
        ["EN", enKey],
        ["FR", frKey],
      ].map(([lang, key]) => (
        <div key={key} onClick={stop}>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            {label} — {lang}
          </span>
          <Input
            value={idea[key] || ""}
            onChange={(e) => onChange(key, e.target.value)}
            className={`${inputClass} ${bold ? "font-semibold" : ""}`}
            {...extra}
          />
        </div>
      ))}
    </div>
  );
}

export default function IdeaCard({ idea, selected, onSelect, onChange }) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border p-5 transition-colors ${
        selected ? "border-white bg-white/5" : "border-neutral-800 hover:border-neutral-600"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            selected ? "border-white bg-white" : "border-neutral-600"
          }`}
        >
          {selected && <CheckIcon size={11} />}
        </span>
        <span className="text-sm font-semibold text-white">Direction {idea.id}</span>
        <span className="truncate text-xs text-neutral-500">{idea.en}</span>
      </div>

      <div className="space-y-3">
        <FieldPair label="Headline" enKey="headline_en" frKey="headline_fr" idea={idea} onChange={onChange} bold />
        <FieldPair label="Body copy" enKey="body_en" frKey="body_fr" idea={idea} onChange={onChange} multiline />
      </div>
    </div>
  );
}
