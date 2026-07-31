import { CheckIcon } from "../components/icons";

export default function SquarePreviewCard({ audience, blurb, imageUrl, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative aspect-square overflow-hidden rounded-xl border text-left transition-all ${
        selected ? "border-white ring-2 ring-white/30" : "border-neutral-800 hover:border-neutral-600"
      }`}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          onError={(e) => (e.currentTarget.style.display = "none")}
          className="absolute inset-0 h-full w-full object-cover opacity-70 grayscale transition-all group-hover:opacity-90 group-hover:grayscale-0"
        />
      )}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/60 to-transparent p-4">
        <span className="mb-1 text-sm font-bold text-white">{audience}</span>
        <span className="text-xs leading-snug text-neutral-300">{blurb}</span>
      </div>
      {selected && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white">
          <CheckIcon />
        </span>
      )}
    </button>
  );
}
