// Curated backgrounds that read as "Samsung premium" — deep neutrals plus a
// couple of on-brand accent gradients (violet echoes the Galaxy S26 hero
// shot, ice blue echoes the Galaxy palette).
export const BACKGROUND_PRESETS = [
  { label: "Solid Black", css: "#0B0B0B" },
  { label: "Solid White", css: "#FFFFFF" },
  { label: "Onyx Gradient", css: "linear-gradient(135deg, #2E2E2E 0%, #000000 100%)" },
  { label: "Galaxy Violet Gradient", css: "linear-gradient(135deg, #6C5CE7 0%, #14142B 100%)" },
  { label: "Titanium Gradient", css: "linear-gradient(135deg, #E4E4E4 0%, #4B4B4B 100%)" },
  { label: "Ice Blue Gradient", css: "linear-gradient(135deg, #7FD8E8 0%, #0F2027 100%)" },
];

export function getBackgroundCss(label) {
  return BACKGROUND_PRESETS.find((b) => b.label === label)?.css || "#0B0B0B";
}
