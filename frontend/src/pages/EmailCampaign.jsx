import { useParams } from "react-router-dom";
import CampaignWizard from "../wizard/CampaignWizard";
import EmailStudio from "../wizard/EmailStudio";
import EmailPreview from "../wizard/EmailPreview";
import { BACKGROUND_PRESETS } from "../lib/backgroundPresets";
import { buildEmailHtml } from "../lib/emailTemplate";
import { generateEmailAssets } from "../lib/mockAgents";

const EMAIL_TYPES = [
  "Promotional Blast",
  "New Product Launch",
  "Product & Feature Update",
  "Abandoned Cart",
  "Re-engagement",
  "Newsletter",
  "Loyalty Offer",
];
// Emails use the same background presets as image generation, so a campaign
// carries one palette across every asset it produces.

export default function EmailCampaign() {
  // Present when resuming a saved campaign from the home page.
  const { id } = useParams();
  return (
    <CampaignWizard
      resumeId={id}
      title="Email Campaign"
      campaignType="email"
      ideaPlaceholder="e.g. Weekend flash sale, new arrivals..."
      formatLabel="Email Types"
      formatOptions={EMAIL_TYPES}
      secondaryLabel="Background Style"
      secondaryOptions={BACKGROUND_PRESETS.map((p) => p.label)}
      secondaryPresets={BACKGROUND_PRESETS}
      fallbackAssets={generateEmailAssets}
      // Asset Generation is for reviewing what came back, so it shows the
      // rendered email only. Editing belongs on the Edit step, where there is
      // room for the fields and the design controls.
      renderAssetTab={(format, lang, data, _onFieldChange, ctx) => (
        <EmailPreview
          data={data}
          product={ctx.product}
          inline={ctx.inline}
          lang={lang}
          emailType={format}
          background={ctx.secondary}
          design={ctx.design}
        />
      )}
      renderEditor={(format, lang, data, ctx) => (
        <EmailStudio
          key={`${format}-${lang}`}
          data={data}
          onFieldChange={(field, value) => ctx.onAssetChange?.(format, lang, field, value)}
          product={ctx.product}
          inline={ctx.inline}
          lang={lang}
          emailType={format}
          background={ctx.secondary}
          onBackgroundChange={ctx.onSecondaryChange}
          design={ctx.design}
          onDesignChange={ctx.onDesignChange}
        />
      )}
      buildExportFiles={({ product, formats, assets, inline, secondary, design }) => {
        const files = [];
        const slug = (s) => s.replace(/\s+/g, "_");
        formats.forEach((format) => {
          const asset = assets[format];
          if (!asset) return;
          ["en", "fr"].forEach((lang) => {
            const a = asset[lang];
            const base = `${slug(product)}_${slug(format)}_${lang.toUpperCase()}`;
            // The HTML is the deliverable; the .txt sits beside it so copy can
            // be reviewed and translated without opening a browser.
            files.push({
              name: `${base}.html`,
              content: buildEmailHtml({
                copy: a,
                product,
                lang,
                // Everything the preview rendered with, so the exported file
                // is what was reviewed rather than an approximation.
                productImage: inline?.productImage,
                productImages: inline?.productImages,
                logoImage: inline?.logoImage,
                emailType: format,
                background: secondary,
                design,
              }),
            });
            files.push({
              name: `${base}.txt`,
              content: [
                `Subject: ${a.subject}`,
                `Preheader: ${a.preheader || ""}`,
                "",
                a.headline || "",
                "",
                a.body || "",
                "",
                `CTA: ${a.cta_label || ""}`,
                ...(a.preference_options?.length
                  ? ["", `Preferences: ${a.preference_options.join(" | ")}`]
                  : []),
              ].join("\n"),
            });
          });
        });
        return files;
      }}
      exportZipName={(product) => `${product.replace(/\s+/g, "_")}_email_campaign.zip`}
    />
  );
}
