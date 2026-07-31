import { CheckIcon } from "../components/icons";

export default function FormatSquareGrid({ options, selected, onChange, aspects }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter((o) => o !== opt));
    else onChange([...selected, opt]);
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {options.map((opt) => {
        const active = selected.includes(opt);
        const aspect = aspects?.[opt];
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border p-4 transition-colors ${
              active ? "border-white bg-white/5" : "border-neutral-800 hover:border-neutral-600"
            }`}
          >
            {aspect && (
              <div className="flex h-12 w-full items-center justify-center">
                <div
                  className={`rounded-[2px] border ${active ? "border-white" : "border-neutral-600"}`}
                  style={{ width: aspect.w, height: aspect.h }}
                />
              </div>
            )}
            <span className={`text-sm font-medium ${active ? "text-white" : "text-neutral-300"}`}>{opt}</span>
            {active && (
              <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                <CheckIcon size={11} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
