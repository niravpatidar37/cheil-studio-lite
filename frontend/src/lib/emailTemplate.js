/**
 * Export-ready HTML email.
 *
 * Written to email-client rules, not web rules: table layout, inline styles,
 * no flexbox/grid, fixed 600px body. Outlook renders this with Word's engine,
 * so anything modern silently collapses.
 *
 * Images are embedded as data URIs, which makes an exported .html file
 * self-contained and correct when opened locally. Real sending would host them
 * instead — Gmail and Outlook.com strip data URIs — so this is the right
 * trade for a reviewable artefact and the wrong one for a broadcast.
 */

import { getBackgroundCss } from "./backgroundPresets";

const escape = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Real companies do not send one layout for every email, so neither does this.
 * Each type maps to the shape that fits its job.
 */
const TEMPLATE_BY_TYPE = {
  "Re-engagement": "preference", // choices are the point, so they lead
  "Promotional Blast": "offer", // offer band up top, one loud CTA
  "Loyalty Offer": "offer",
  Newsletter: "editorial", // no product hero; it is a read, not a pitch
  "Product & Feature Update": "update", // for people who already own it
  "New Product Launch": "hero",
  "Abandoned Cart": "hero",
};

export function templateFor(emailType) {
  return TEMPLATE_BY_TYPE[emailType] || "hero";
}

/** First colour in a CSS background value — the Outlook fallback. */
function solidFallback(css) {
  const m = String(css).match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
  return m ? m[0] : "#0B0B0B";
}

/** Pick readable text for a background — the presets include Solid White. */
function readableOn(color) {
  const hex = String(color).replace("#", "");
  if (hex.length < 6) return "#FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? "#111111" : "#FFFFFF";
}

const paragraphs = (body, color = "#424245", alignment = "left") =>
  String(body ?? "")
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:${color};text-align:${alignment};">${escape(p)}</p>`
    )
    .join("");

function button(label, accent, alignment = "left") {
  const text = readableOn(accent);
  const alignStyle = alignment === "center" ? 'auto' : '0';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${alignment}">
                <tr>
                  <td bgcolor="${accent}" style="background:${accent};border-radius:100px;">
                    <a href="#cta" style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:600;color:${text};text-decoration:none;">${escape(
    label
  )}</a>
                  </td>
                </tr>
              </table>`;
}

/** Preference chips — the re-engagement mechanism, rendered as tappable rows. */
function preferenceRows(options, lang) {
  if (!options?.length) return "";
  const label = lang === "fr" ? "Choisissez ce qui vous intéresse" : "Choose what you hear about";
  const rows = options
    .map(
      (opt) => `
              <tr><td style="padding:0 0 8px;">
                <a href="#preferences" style="display:block;padding:12px 16px;border:1px solid #d4d4d4;border-radius:6px;font-size:14px;color:#111111;text-align:center;text-decoration:none;background:#fafafa;">${escape(
        opt
      )}</a>
              </td></tr>`
    )
    .join("");
  return `
          <tr><td style="padding:8px 32px 0;">
            <p style="margin:0 0 12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#767676;text-align:${alignment};">${escape(
    label
  )}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
          </td></tr>`;
}

// The content column is 600px with 32px padding each side, so this is as wide
// as a shot can go without the row breaking out of it.
const SHOT_MAX_WIDTH = 520;

/**
 * A row of product shots. A bundle campaign covers several products in one
 * email, so they sit side by side as table cells — email clients have no
 * flexbox, and floated images collapse into a stack in Outlook.
 *
 * The row grows with the number of products rather than dividing a fixed width
 * between them, so two products are not each rendered half-size.
 */
function shotRow(images, product, baseWidth) {
  const list = (images || []).filter(Boolean);
  if (!list.length) return "";
  const each = Math.floor(Math.min(baseWidth * list.length, SHOT_MAX_WIDTH) / list.length);
  const cells = list
    .map(
      (src) =>
        `<td align="center" valign="bottom" style="padding:0 6px;">
           <img src="${src}" alt="${escape(product)}" width="${each}" style="display:block;border:0;width:${each}px;max-width:100%;height:auto;" />
         </td>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${cells}</tr></table>`;
}

/**
 * The branded band. Uses the campaign's chosen gradient or solid — the same
 * presets image generation uses — with a solid `bgcolor` beneath it because
 * Outlook's Word engine ignores CSS gradients entirely.
 */
function heroBand({ css, fallback, onColor, logoImage, productImages, product, tall, alignment }) {
  const logo = logoImage
    ? `<img src="${logoImage}" width="110" alt="Samsung" style="display:block;border:0;width:110px;height:auto;${onColor === "#FFFFFF" ? "filter:brightness(0) invert(1);" : ""
    }" />`
    : `<span style="font-size:18px;font-weight:700;letter-spacing:.14em;color:${onColor};">SAMSUNG</span>`;

  const shot =
    productImages?.length && tall
      ? `<tr><td align="center" style="padding:0px 48px 48px;">
             ${shotRow(productImages, product, 280)}
           </td></tr>`
      : "";

  return `<tr>
            <td bgcolor="${fallback}" style="background:${fallback};background-image:${css};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td align="${alignment}" style="padding:48px 48px ${tall ? "24px" : "48px"};">${logo}</td></tr>
                ${shot}
              </table>
            </td>
          </tr>`;
}

export function buildEmailHtml({
  copy,
  product,
  // A single shot, or one per product when the campaign covers a bundle.
  productImage,
  productImages,
  logoImage,
  lang = "en",
  emailType,
  background,
  design = {},
}) {
  const c = copy || {};
  const variant = templateFor(emailType);
  const css = getBackgroundCss(background);
  const fallback = solidFallback(css);
  const onColor = readableOn(fallback);
  const d = design || {};
  const accent = d.accent || "#111111";
  const showProduct = d.showProduct !== false;
  const theme = d.theme || "classic";

  const fontFamily = theme === "prestige"
    ? "'Helvetica Neue', Helvetica, Arial, sans-serif"
    : theme === "bold"
      ? "'Arial Black', Impact, sans-serif"
      : "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const headlineSize = theme === "prestige" ? "36px" : theme === "bold" ? "42px" : "28px";
  const headlineWeight = theme === "prestige" ? "400" : theme === "bold" ? "900" : "700";
  const headlineSpacing = theme === "bold" ? "-1px" : "normal";
  const alignment = theme === "prestige" ? "center" : "left";

  const footer =
    lang === "fr"
      ? {
        why: "Vous recevez ce courriel parce que vous avez un compte Samsung.",
        prefs: "Gérer mes préférences",
        unsub: "Se désabonner",
      }
      : {
        why: "You are receiving this because you have a Samsung account.",
        prefs: "Manage preferences",
        unsub: "Unsubscribe",
      };

  // Callers may pass a list (a bundle) or the single shot the template took
  // before bundles existed; normalise so the rest of this only handles a list.
  const shots = (productImages?.length ? productImages : [productImage]).filter(Boolean);

  // Which layout gets a product shot inside the coloured band.
  const tallHero = showProduct && shots.length > 0 && (variant === "hero" || variant === "update");

  const hero = heroBand({
    css,
    fallback,
    onColor,
    logoImage,
    productImages: shots,
    product,
    tall: tallHero,
    alignment,
  });

  // Editorial leads with a rule rather than a slab; offer reverses the
  // headline out of the colour; the rest state the headline on white.
  const headlineBlock =
    variant === "offer"
      ? `<tr><td align="${alignment}" bgcolor="${fallback}" style="background:${fallback};background-image:${css};padding:12px 48px 48px;">
           <h1 style="margin:0;font-size:${headlineSize};line-height:1.15;font-weight:${headlineWeight};letter-spacing:${headlineSpacing};color:${onColor};">${escape(
        c.headline
      )}</h1>
         </td></tr>
         <tr><td align="${alignment}" style="padding:48px 48px 0;">${paragraphs(c.body, "#1D1D1F", alignment)}</td></tr>`
      : `<tr><td align="${alignment}" style="padding:${variant === "editorial" ? "40px" : "48px"} 48px 0;">
           ${variant === "editorial"
        ? `<div style="width:44px;height:3px;background:${fallback};margin:0 0 20px ${alignment === 'center' ? 'auto' : '0'};"></div>`
        : ""
      }
           <h1 style="margin:0 0 20px;font-size:${headlineSize};line-height:1.15;font-weight:${headlineWeight};letter-spacing:${headlineSpacing};color:#1D1D1F;">${escape(
        c.headline
      )}</h1>
           ${paragraphs(c.body, "#424245", alignment)}
         </td></tr>`;

  // A product shot that did not go in the band sits inline, except for
  // editorial, which deliberately has none.
  const inlineShot =
    showProduct && shots.length > 0 && !tallHero && variant !== "editorial"
      ? `<tr><td align="center" style="padding:8px 32px 0;">
           ${shotRow(shots, product, 200)}
         </td></tr>`
      : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFC;-webkit-font-smoothing:antialiased;">
  <!-- Preheader: shown next to the subject in the inbox, hidden once opened. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escape(
    c.preheader
  )}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAFAFC;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:24px;border:1px solid #EAEAEA;box-shadow:0 20px 40px rgba(0,0,0,0.06);overflow:hidden;font-family:${fontFamily};">
${hero}
${inlineShot}
${headlineBlock}
${preferenceRows(c.preference_options, lang)}
          <tr>
            <td style="padding:24px 48px 48px;">
              ${button(c.cta_label, accent, alignment)}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 48px 40px;border-top:1px solid #F0F0F0;background:#FCFCFC;">
              <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#86868B;">${escape(
    footer.why
  )}</p>
              <p style="margin:0;font-size:13px;color:#86868B;">
                <a href="#preferences" style="color:#86868B;text-decoration:underline;">${escape(footer.prefs)}</a>
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <a href="#unsubscribe" style="color:#86868B;text-decoration:underline;">${escape(footer.unsub)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
