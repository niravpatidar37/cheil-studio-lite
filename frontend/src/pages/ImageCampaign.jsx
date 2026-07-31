import { useParams } from "react-router-dom";
import CampaignWizard from "../wizard/CampaignWizard";
import BannerStudio from "../wizard/BannerStudio";
import { Field, TextInput, TextArea } from "../components/form";
import { generateImageAssets } from "../lib/mockAgents";
import { BACKGROUND_PRESETS } from "../lib/backgroundPresets";

const BANNER_SIZES = ["Website", "Mobile", "Desktop", "Hoarding"];

const BANNER_ASPECTS = {
  Website: { w: 44, h: 26 },
  Mobile: { w: 20, h: 38 },
  Desktop: { w: 46, h: 26 },
  Hoarding: { w: 52, h: 12 },
};

export default function ImageCampaign() {
  // Present when resuming a saved campaign from the home page.
  const { id } = useParams();
  return (
    <CampaignWizard
      resumeId={id}
      title="Image Campaign"
      campaignType="image"
      ideaPlaceholder="e.g. Back to school promo, 40% off..."
      formatLabel="Banner Sizes"
      formatOptions={BANNER_SIZES}
      formatAspects={BANNER_ASPECTS}
      secondaryLabel="Background Style"
      secondaryOptions={BACKGROUND_PRESETS.map((p) => p.label)}
      secondaryPresets={BACKGROUND_PRESETS}
      fallbackAssets={generateImageAssets}
      renderAssetTab={(format, lang, data, onFieldChange) => (
        <div className="space-y-3">
          <Field label="Headline">
            <TextInput value={data.headline} onChange={(v) => onFieldChange("headline", v)} />
          </Field>
          <Field label="Body Copy">
            <TextArea value={data.body} onChange={(v) => onFieldChange("body", v)} rows={3} />
          </Field>
        </div>
      )}
      renderEditor={(format, lang, data, ctx) => (
        <BannerStudio
          key={`${format}-${lang}`}
          bannerSize={format}
          headline={data.headline}
          body={data.body}
          product={ctx.product}
          ideaEn={ctx.ideaEn}
          audiences={ctx.audiences}
          initialStyle={ctx.secondary}
          productImage={ctx.productImage}
          initialImage={ctx.image}
          onConfigChange={(cfg) => ctx.onBannerConfig?.(format, lang, cfg)}
          // Canvas text edits write back to the campaign copy, so the banner,
          // the quality check and the exported .txt stay in agreement.
          onFieldChange={(field, value) => ctx.onAssetChange?.(format, lang, field, value)}
        />
      )}
      buildExportFiles={({ product, formats, assets }) => {
        const files = [];
        formats.forEach((format) => {
          const asset = assets[format];
          if (!asset) return;
          ["en", "fr"].forEach((lang) => {
            files.push({
              name: `${product.replace(/\s+/g, "_")}_${format}_${lang.toUpperCase()}.txt`,
              content: `${asset[lang].headline}\n\n${asset[lang].body}`,
            });
          });
        });
        return files;
      }}
      exportZipName={(product) => `${product.replace(/\s+/g, "_")}_image_campaign.zip`}
    />
  );
}
