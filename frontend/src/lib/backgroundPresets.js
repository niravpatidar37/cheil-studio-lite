// Curated backgrounds that read as "Samsung premium" — deep neutrals plus a
// couple of on-brand accent gradients (violet echoes the Galaxy S26 hero
// shot, ice blue echoes the Galaxy palette).
export const BACKGROUND_PRESETS = [
  { label: "Deep Black Solid", css: "#0B0B0B" },
  { label: "Graphite Solid", css: "#1E1E1E" },
  { label: "Titanium Solid", css: "#2D2D2D" },
  { label: "Midnight Blue Solid", css: "#0A1128" },
  { label: "Galaxy Violet Gradient", css: "linear-gradient(135deg, #2A0845 0%, #6441A5 100%)" },
  { label: "Ice Blue Gradient", css: "linear-gradient(135deg, #1C92D2 0%, #F2FCFE 100%)" },
];

export function getBackgroundCss(label) {
  return BACKGROUND_PRESETS.find((b) => b.label === label)?.css || "#0B0B0B";
}
