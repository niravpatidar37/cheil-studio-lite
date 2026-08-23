/**
 * Export-ready HTML email.
 *
 * Designed with modern, ultra-premium aesthetics typical of Samsung/Apple marketing.
 * Focuses on extreme minimalism, massive hero graphics, tight geometric typography, 
 * and edge-to-edge fluidity while surviving Outlook's Word rendering engine.
 */

import { getBackgroundCss } from "./backgroundPresets";

/**
 * Maps email type to layout variant.
 */
const TEMPLATE_BY_TYPE = {
  "Re-engagement": "preference",
  "Promotional Blast": "offer",
  "Loyalty Offer": "offer",
  Newsletter: "editorial",
  "Product & Feature Update": "update",
  "New Product Launch": "hero",
  "Abandoned Cart": "hero",
};

export function templateFor(emailType) {
  return TEMPLATE_BY_TYPE[emailType] || "hero";
}

const escape = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** First colour in a CSS background value — the Outlook fallback. */
function solidFallback(css) {
  const m = String(css).match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
  return m ? m[0] : "#0B0B0B";
}

/** Pick readable text for a background. */
function readableOn(color) {
  const hex = String(color).replace("#", "");
  if (hex.length < 6) return "#FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? "#111111" : "#FFFFFF";
}

const paragraphs = (body, color = "#424245") =>
  String(body ?? "")
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 24px;font-size:18px;line-height:1.6;color:${color};text-align:center;letter-spacing:-0.2px;">${escape(p)}</p>`
    )
    .join("");

function button(label, accent) {
  const text = readableOn(accent);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td bgcolor="${accent}" style="background:${accent};border-radius:100px;">
                    <a href="#cta" style="display:inline-block;padding:18px 42px;font-size:16px;font-weight:600;color:${text};text-decoration:none;letter-spacing:0.5px;">${escape(label)}</a>
                  </td>
                </tr>
              </table>`;
}

/** Preference chips. */
function preferenceRows(options, lang) {
  if (!options?.length) return "";
  const label = lang === "fr" ? "Choisissez ce qui vous intéresse" : "Choose what you hear about";
  const rows = options
    .map(
      (opt) => `
              <tr><td style="padding:0 0 12px;">
                <a href="#preferences" style="display:block;padding:16px 24px;border:1px solid rgba(0,0,0,0.1);border-radius:12px;font-size:15px;color:#111111;text-align:center;text-decoration:none;background:rgba(255,255,255,0.8);">${escape(
        opt
      )}</a>
              </td></tr>`
    )
    .join("");
  return `
          <tr><td style="padding:16px 48px 0;">
            <p style="margin:0 0 16px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#86868B;text-align:center;font-weight:600;">${escape(
    label
  )}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
          </td></tr>`;
}

const SHOT_MAX_WIDTH = 550;

function shotRow(images, product, baseWidth) {
  const list = (images || []).filter(Boolean);
  if (!list.length) return "";

  const chunks = list.length > 3 ? Array.from({ length: Math.ceil(list.length / 3) }, (_, i) => list.slice(i * 3, i * 3 + 3)) : [list];

  return chunks.map(chunk => {
    const each = Math.floor(Math.min(baseWidth * chunk.length, SHOT_MAX_WIDTH) / chunk.length);
    const cells = chunk
      .map(
        (src) =>
          `<td align="center" valign="middle" style="padding:12px;">
             <img src="${src}" alt="${escape(product)}" width="${each}" style="display:block;border:0;width:${each}px;max-width:100%;height:auto;" />
           </td>`
      )
      .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom:0px;"><tr>${cells}</tr></table>`;
  }).join("");
}

export function buildEmailHtml({
  copy,
  product,
  productImage,
  productImages,
  logoImage,
  lang = "en",
  emailType,
  background,
  design = {},
}) {
  const c = copy || {};
  const css = getBackgroundCss(background);
  const fallback = solidFallback(css);
  const onColor = readableOn(fallback);
  const d = design || {};
  const accent = d.accent || (onColor === "#FFFFFF" ? "#FFFFFF" : "#000000");

  // Enforce the bold, minimalist Samsung aesthetic universally.
  const fontFamily = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const headlineSize = "48px";
  const headlineWeight = "800";
  const headlineSpacing = "-1.5px";

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

  const shots = (productImages?.length ? productImages : [productImage]).filter(Boolean);

  // Render the logo cleanly aligned to center.
  const logo = logoImage
    ? `<img src="${logoImage}" width="140" alt="Samsung" style="display:block;border:0;width:140px;height:auto;${onColor === "#FFFFFF" ? "filter:brightness(0) invert(1);" : ""}" />`
    : `<span style="font-size:20px;font-weight:900;letter-spacing:2px;color:${onColor};text-transform:uppercase;">SAMSUNG</span>`;

  const heroImageBlock = shots.length > 0
    ? `<tr><td align="center" style="padding:0px 24px 32px;">
         ${shotRow(shots, product, 360)}
       </td></tr>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(c.subject)}</title>
<!-- Optionally link Inter if local viewing supports web fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#EAEAEA;-webkit-font-smoothing:antialiased;font-family:${fontFamily};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escape(c.preheader)}</div>
  
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#EAEAEA;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        
        <!-- Main Email Canvas - Flawless unified stage -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;margin:0 auto;background:${fallback};background-image:${css};border-radius:28px;box-shadow:0 30px 60px rgba(0,0,0,0.12);overflow:hidden;">
          
          <!-- Logo Block -->
          <tr><td align="center" style="padding:56px 48px 32px;">${logo}</td></tr>
          
          <!-- Hero Product Image -->
          ${heroImageBlock}
          
          <!-- Headline & Copy Structure -->
          <tr>
             <td align="center" style="padding:0 48px;">
               <h1 style="margin:0 0 24px;font-size:${headlineSize};line-height:1.1;font-weight:${headlineWeight};letter-spacing:${headlineSpacing};color:${onColor};">${escape(c.headline)}</h1>
               ${paragraphs(c.body, onColor === "#FFFFFF" ? "rgba(255,255,255,0.85)" : "#555555")}
             </td>
          </tr>
          
          <!-- Preference Chips (if active) -->
          ${preferenceRows(c.preference_options, lang)}
          
          <!-- CTA Button -->
          <tr>
            <td style="padding:40px 48px 72px;">
              ${button(c.cta_label, accent)}
            </td>
          </tr>
          
        </table>

        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;margin:24px auto 0;">
          <tr>
            <td align="center" style="padding:24px 32px;">
              <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#86868B;">${escape(footer.why)}</p>
              <p style="margin:0;font-size:12px;color:#86868B;">
                <a href="#preferences" style="color:#86868B;text-decoration:underline;">${escape(footer.prefs)}</a>
                &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;
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

