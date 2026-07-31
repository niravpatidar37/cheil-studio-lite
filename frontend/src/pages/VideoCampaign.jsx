import { useParams } from "react-router-dom";
import CampaignWizard from "../wizard/CampaignWizard";
import { Field, TextInput, TextArea } from "../components/form";
import { VideoIcon } from "../components/icons";
import { generateVideoAssets } from "../lib/mockAgents";

const VIDEO_FORMATS = ["15s Social Ad", "30s Social Ad", "6s Bumper Ad", "60s Brand Film"];
const PLATFORMS = ["Instagram Reels", "YouTube Shorts", "TikTok", "YouTube Pre-roll"];

function VideoPreview({ data, product, productImage }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800">
      <div className="relative flex h-52 items-center justify-center bg-[#0b0b0b] p-6">
        <img
          src={productImage}
          alt={product}
          onError={(e) => (e.currentTarget.style.display = "none")}
          className="h-full max-h-32 object-contain opacity-70"
        />
        <span className="absolute flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/40">
          <VideoIcon size={20} />
        </span>
        <div className="absolute inset-x-4 bottom-4">
          <p className="text-sm font-bold leading-tight text-white drop-shadow">{data.hook}</p>
        </div>
      </div>
    </div>
  );
}

export default function VideoCampaign() {
  // Present when resuming a saved campaign from the home page.
  const { id } = useParams();
  return (
    <CampaignWizard
      resumeId={id}
      title="Video Campaign"
      campaignType="video"
      ideaPlaceholder="e.g. Launch teaser, feature highlight..."
      formatLabel="Video Formats"
      formatOptions={VIDEO_FORMATS}
      secondaryLabel="Platform"
      secondaryOptions={PLATFORMS}
      fallbackAssets={generateVideoAssets}
      renderAssetTab={(format, lang, data, onFieldChange, ctx) => (
        <div className="space-y-3">
          <Field label="Hook">
            <TextInput value={data.hook} onChange={(v) => onFieldChange("hook", v)} />
          </Field>
          <Field label="Scenes">
            <TextArea
              value={data.scenes.join("\n")}
              onChange={(v) => onFieldChange("scenes", v.split("\n"))}
              rows={4}
            />
          </Field>
          <Field label="Call to Action">
            <TextInput value={data.cta} onChange={(v) => onFieldChange("cta", v)} />
          </Field>
          <VideoPreview data={data} product={ctx.product} productImage={ctx.productImage} />
        </div>
      )}
      buildExportFiles={({ product, formats, assets }) => {
        const files = [];
        formats.forEach((format) => {
          const asset = assets[format];
          if (!asset) return;
          ["en", "fr"].forEach((lang) => {
            const a = asset[lang];
            files.push({
              name: `${product.replace(/\s+/g, "_")}_${format.replace(/\s+/g, "_")}_${lang.toUpperCase()}.txt`,
              content: `${a.hook}\n\n${a.scenes.join("\n")}\n\n${a.cta}`,
            });
          });
        });
        return files;
      }}
      exportZipName={(product) => `${product.replace(/\s+/g, "_")}_video_campaign.zip`}
    />
  );
}
