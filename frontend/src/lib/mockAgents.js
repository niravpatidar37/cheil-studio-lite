// Mocked multi-agent content generation, ported client-side so every wizard
// step (including live-editing previews) resolves instantly. Mirrors the
// tone/content of the original backend mock agents.

const AUDIENCE_BLURBS = {
  Students: "Budget-friendly framing with a campus-life angle.",
  Families: "Emphasize togetherness and everyday reliability.",
  Seniors: "Lead with simplicity, trust, and ease of use.",
  "Young professionals": "Highlight performance and premium status.",
  "Pet owners": "Tie the benefit to a pet-friendly, at-home moment.",
};

// Each direction carries its own headline and body copy, because that copy is
// what the banner renders. Without it the offline fallback produced banners
// with an empty headline.
export function generateIdeas(brief) {
  const base = brief?.trim() || "your next campaign";
  return [
    {
      id: 1,
      en: `Highlight how this fits perfectly into daily life around "${base}".`,
      fr: `Montrez comment cela s'intègre parfaitement au quotidien autour de « ${base} ».`,
      headline_en: "Made for the way you live",
      headline_fr: "Conçu pour votre quotidien",
      body_en: "Technology that keeps up with your day, from the first alarm to the last message.",
      body_fr:
        "Une technologie qui suit le rythme de vos journées, du premier réveil au dernier message.",
    },
    {
      id: 2,
      en: `Focus strictly on premium design and a limited-time offer for "${base}".`,
      fr: `Misez uniquement sur le design premium et une offre à durée limitée pour « ${base} ».`,
      headline_en: "Premium design, on your terms",
      headline_fr: "Un design premium, à vos conditions",
      body_en: "Crafted materials and a considered finish, available for a limited time.",
      body_fr: "Des matériaux soignés et une finition réfléchie, offerts pour une durée limitée.",
    },
    {
      id: 3,
      en: `An emotion-driven angle about simplifying life, tied to "${base}".`,
      fr: `Un angle émotionnel sur la simplification du quotidien, lié à « ${base} ».`,
      headline_en: "Less to think about",
      headline_fr: "Moins de choses en tête",
      body_en: "Everything works together, so the small decisions stop getting in your way.",
      body_fr:
        "Tout fonctionne ensemble, pour que les petites décisions cessent de vous ralentir.",
    },
  ];
}

export function generateAudiencePreviews(audiences) {
  return audiences.reduce((acc, a) => {
    acc[a] = AUDIENCE_BLURBS[a] || "A tailored angle for this segment.";
    return acc;
  }, {});
}

// --- Image campaign ---
export function generateImageLayouts(product, sizes, background) {
  return sizes.reduce((acc, size) => {
    acc[size] = `Minimalist ${size.toLowerCase()} layout featuring the ${product}. ${background} background, high-contrast white text, logo anchored bottom right.`;
    return acc;
  }, {});
}

export function generateImageAssets({ product, idea, formats, audiences }) {
  const audienceLabel = (audiences[0] || "everyone").toLowerCase();
  return formats.reduce((acc, size) => {
    acc[size] = {
      en: {
        headline: `Experience the new ${product}.`,
        body: `Designed for ${audienceLabel} who expect the best. ${idea.en}`,
      },
      fr: {
        headline: `Découvrez le nouveau ${product}.`,
        body: `Conçu pour ${audienceLabel}. ${idea.fr}`,
      },
    };
    return acc;
  }, {});
}

// --- Video campaign ---
export function generateVideoFormats(product, formats, platform) {
  return formats.reduce((acc, format) => {
    acc[format] =
      `Storyboard for a ${format.toLowerCase()} on ${platform}: hero shot of the ${product}, ` +
      `lifestyle cut-in, callout of the key benefit, end card with CTA.`;
    return acc;
  }, {});
}

export function generateVideoAssets({ product, idea, formats, audiences }) {
  const audienceLabel = (audiences[0] || "everyone").toLowerCase();
  return formats.reduce((acc, format) => {
    acc[format] = {
      en: {
        hook: `Bold close-up of the ${product}.`,
        scenes: [
          "Scene 1 (0-3s): Fast cut hero shot on a clean set.",
          `Scene 2: A ${audienceLabel} using the ${product} in a real moment.`,
          "Scene 3: On-screen callout of the standout feature.",
          "Scene 4: End card — logo, product name, CTA.",
        ],
        cta: `Learn more about the ${product}. ${idea.en}`,
      },
      fr: {
        hook: `Gros plan saisissant sur le ${product}.`,
        scenes: [
          "Scène 1 (0-3s) : plan héros en coupe rapide sur fond neutre.",
          `Scène 2 : un(e) ${audienceLabel} utilisant le ${product} au quotidien.`,
          "Scène 3 : mise en avant à l'écran de la fonctionnalité clé.",
          "Scène 4 : écran de fin — logo, nom du produit, appel à l'action.",
        ],
        cta: `En savoir plus sur le ${product}. ${idea.fr}`,
      },
    };
    return acc;
  }, {});
}

// --- Email campaign ---
export function generateEmailFormats(product, types, tone) {
  return types.reduce((acc, type) => {
    acc[type] = `${tone} tone ${type.toLowerCase()} email concept for the ${product}, structured for a quick scan and a clear CTA.`;
    return acc;
  }, {});
}

// Re-engagement hands the reader control instead of naming their inactivity, so
// the offline fallback has to carry preference options too — otherwise the
// degraded path silently drops the mechanic that defines the type.
const REENGAGEMENT_PREFS = {
  en: ["New product launches", "Offers and trade-in deals", "Tips for my devices", "Once a month only"],
  fr: ["Nouveaux produits", "Offres et reprises", "Conseils pour mes appareils", "Une fois par mois"],
};

export function generateEmailAssets({ product, idea, formats, audiences }) {
  const audienceLabel = (audiences[0] || "everyone").toLowerCase();
  return formats.reduce((acc, type) => {
    const reengage = type === "Re-engagement";
    acc[type] = {
      en: {
        subject: reengage ? "Choose what you hear about" : `${product} is here`,
        preheader: reengage
          ? "Set your topics and how often we write."
          : `Built with ${audienceLabel} in mind.`,
        headline: reengage ? "Your inbox, your rules" : `Meet the ${product}`,
        body: reengage
          ? `Pick the topics that matter to you and how often you would like to hear from us. You can change this at any time.`
          : `${idea.en}\n\nExplore what the ${product} can do for you.`,
        cta_label: reengage ? "Set preferences" : "Explore now",
        preference_options: reengage ? REENGAGEMENT_PREFS.en : [],
      },
      fr: {
        subject: reengage ? "Choisissez vos sujets" : `Le ${product} est arrivé`,
        preheader: reengage
          ? "Définissez vos sujets et la fréquence."
          : `Conçu en pensant à vous.`,
        headline: reengage ? "Votre boîte, vos règles" : `Découvrez le ${product}`,
        body: reengage
          ? `Choisissez les sujets qui vous intéressent et la fréquence des courriels. Vous pouvez modifier ces choix à tout moment.`
          : `${idea.fr}\n\nDécouvrez tout ce que le ${product} peut faire pour vous.`,
        cta_label: reengage ? "Définir mes préférences" : "Découvrir",
        preference_options: reengage ? REENGAGEMENT_PREFS.fr : [],
      },
    };
    return acc;
  }, {});
}
