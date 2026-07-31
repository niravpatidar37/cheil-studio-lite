import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import WizardShell from "./WizardShell";
import IdeaCard from "./IdeaCard";
import SquarePreviewCard from "./SquarePreviewCard";
import FormatSquareGrid from "./FormatSquareGrid";
import QualityReport from "./QualityReport";
import { Select, TextArea, PrimaryButton } from "../components/form";
import { useProducts } from "../context/ProductsContext";
import { generateIdeas as fallbackIdeas } from "../lib/mockAgents";
import {
  apiGenerateIdeas,
  apiGenerateAssets,
  apiReviseAssets,
  apiQualityCheck,
  apiSaveCampaign,
  apiGetCampaign,
  runImageJob,
  imageUrl,
} from "../lib/api";

/** Map an object's values, keeping keys. */
const mapValues = (obj, fn) =>
  Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, fn(v)]));
import { AUDIENCE_IMAGES } from "../lib/audienceImages";
import { getBackgroundCss } from "../lib/backgroundPresets";
import {
  previewStyle,
  backgroundFit,
  containMaskCss,
  BACKDROP_BLUR_PCT,
  BACKDROP_DIM,
  BACKDROP_SCALE,
} from "../lib/bannerSpecs";
import { getCategoryIcon } from "../lib/categoryIcons";
import { CheckIcon } from "../components/icons";
import { productReferencePng } from "../lib/productReference";
import { downloadZip } from "../lib/zip";
import { renderBanner } from "../lib/exportImage";

const AUDIENCES = ["Students", "Families", "Seniors", "Young professionals", "Pet owners"];

const STEP_LABELS = [
  "Campaign Brief",
  "Product",
  "Background",
  "Formats",
  "Target Audience",
  "Ideas & Copy",
  "Asset Generation",
  "Edit",
  "Export",
];

// Where the exported headline and body copy is actually edited — the target
// for the "Revise copy" shortcut on the Export step.
const IDEAS_STEP = STEP_LABELS.indexOf("Ideas & Copy");

function ProductThumbnail({ name, category, imageUrl }) {
  const [failed, setFailed] = useState(false);
  const CategoryIcon = getCategoryIcon(category);
  return (
    <div className="mb-3 flex h-28 w-full items-center justify-center rounded-lg border border-neutral-800 bg-white/5 p-2">
      {failed ? (
        <CategoryIcon size={32} />
      ) : (
        <img src={imageUrl} alt={name} onError={() => setFailed(true)} className="h-full w-full object-contain" />
      )}
    </div>
  );
}

function StepButton({ onClick, disabled, busy, busyLabel, elapsed, children }) {
  return (
    <div className="mt-8">
      <PrimaryButton onClick={onClick} disabled={disabled || busy}>
        {busy ? `${busyLabel}${elapsed ? ` ${elapsed}s` : ""}` : children}
      </PrimaryButton>
    </div>
  );
}

/**
 * Reports how long generation took. `ms` is the model's own time; `waited` is
 * what the user actually sat through — much smaller when a prefetch finished
 * first, which is the whole point of prefetching.
 */
function TimingNote({ timing, label }) {
  if (!timing) return null;
  const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
  const prefetched = timing.waited < timing.ms - 500;
  return (
    <p className="mt-3 text-xs text-neutral-500">
      {label} generated in {secs(timing.ms)}
      {prefetched
        ? ` · started in the background, so you waited ${secs(timing.waited)}`
        : ""}
    </p>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="mb-6 rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
      {message}
    </div>
  );
}

function FormatTabs({ formats, active, onChange }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-neutral-800 pb-4">
      {formats.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
            active === f
              ? "border-white bg-white font-semibold text-black"
              : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

/** Read-only composed preview shown on the Asset Generation step. */
function BannerPreview({ bannerSize, image, backgroundCss, copy, generating }) {
  const fit = backgroundFit(bannerSize);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-neutral-700"
      style={{ ...previewStyle(bannerSize, 420), containerType: "size", background: backgroundCss }}
    >
      {image && (
        <>
          {fit === "contain" && (
            <img
              src={image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                filter: `blur(${BACKDROP_BLUR_PCT}cqw) brightness(${BACKDROP_DIM})`,
                transform: `scale(${BACKDROP_SCALE})`,
              }}
            />
          )}
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{
              objectFit: fit,
              objectPosition: fit === "contain" ? "right center" : "center",
              ...(fit === "contain"
                ? {
                    maskImage: containMaskCss(bannerSize),
                    WebkitMaskImage: containMaskCss(bannerSize),
                  }
                : {}),
            }}
          />
        </>
      )}
      <img
        src="/samsung-logo.png"
        alt="Samsung"
        className="absolute"
        style={{ left: "4%", top: "6%", width: "12cqmax", filter: "brightness(0) invert(1)" }}
      />
      <div className="absolute" style={{ left: "6%", top: "62%", width: "88%" }}>
        <p style={{ fontSize: "7.5cqmin", lineHeight: 1.2, fontWeight: 700, color: "#FFFFFF" }}>
          {copy?.headline}
        </p>
        <p style={{ fontSize: "3.2cqmin", lineHeight: 1.2, color: "#E5E5E5", marginTop: "1.5cqmin" }}>
          {copy?.body}
        </p>
      </div>
      {generating && !image && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-neutral-300">
          Generating image…
        </div>
      )}
    </div>
  );
}

function StepHeader({ title, subtitle }) {
  return (
    <>
      <h2 className="mb-1 text-xl font-bold">{title}</h2>
      <p className="mb-6 text-sm text-neutral-500">{subtitle}</p>
    </>
  );
}

export default function CampaignWizard({
  title,
  campaignType,
  formatLabel,
  formatOptions,
  formatAspects,
  secondaryLabel,
  secondaryOptions,
  secondaryPresets,
  fallbackAssets,
  renderAssetTab,
  renderEditor,
  buildExportFiles,
  exportZipName,
  ideaPlaceholder,
  resumeId,
}) {
  const { products } = useProducts();
  const productNames = Object.keys(products);
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Setup (steps 1-5)
  const [brief, setBrief] = useState("");
  // A campaign can cover several products at once. They share one set of
  // assets, weighted equally, rather than each getting its own campaign.
  const [product, setProduct] = useState([]);
  const [secondary, setSecondary] = useState(secondaryOptions[0]);
  const [formats, setFormats] = useState([]);
  const [audiences, setAudiences] = useState([]);

  // Generation (steps 6-9)
  const [ideas, setIdeas] = useState([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState(null);
  const [assets, setAssets] = useState({});
  const [images, setImages] = useState({});
  const [activeFormatTab, setActiveFormatTab] = useState(null);
  // Campaign-type-specific look settings (accent colour, product shot on/off).
  // Kept generic here so the wizard stays agnostic about what they mean.
  const [design, setDesign] = useState({});
  const [report, setReport] = useState(null);

  // Whether the plain-text copy deck goes in the ZIP alongside the deliverables.
  const [includeText, setIncludeText] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [imageJobId, setImageJobId] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  // How long generation actually took, and how long the user actually waited —
  // they differ whenever a prefetch got there first.
  const [timings, setTimings] = useState({});
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return undefined;
    }
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(id);
  }, [busy]);

  // Every selected product is an equal subject — none leads. Order is kept only
  // so the grounding references stay paired with their names, not to rank them.
  const selectedProducts = product.length ? product : productNames.slice(0, 1);
  // Used only where a single thumbnail or catalog lookup is unavoidable.
  const selectedProduct = selectedProducts[0];
  const productLabel = selectedProducts.join(" + ");
  const toggleProduct = (name) =>
    setProduct((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );

  const selectedIdea = ideas.find((i) => i.id === selectedIdeaId) || ideas[0];
  const effectiveAudiences = audiences.length ? audiences : AUDIENCES.slice(0, 1);

  const goNext = () => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // --- Persistence -------------------------------------------------------
  // The whole wizard is one document. It is written back after any change,
  // debounced, so closing the tab is never destructive. Images are referenced
  // by URL, so this document stays small even with a full set generated.
  const campaignIdRef = useRef(resumeId || null);
  const hydratedRef = useRef(!resumeId);

  const snapshot = {
    step,
    brief,
    product,
    secondary,
    formats,
    audiences,
    ideas,
    selectedIdeaId,
    assets,
    images,
    imageJobId,
    activeFormatTab,
    design,
    includeText,
  };

  // Restore a saved campaign before anything else runs.
  useEffect(() => {
    if (!resumeId || hydratedRef.current) return;
    let cancelled = false;
    apiGetCampaign(resumeId)
      .then(({ state }) => {
        if (cancelled || !state) return;
        setBrief(state.brief ?? "");
        // Campaigns saved before multi-select stored a single product name.
        setProduct(
          Array.isArray(state.product)
            ? state.product
            : state.product
              ? [state.product]
              : []
        );
        setSecondary(state.secondary ?? secondaryOptions[0]);
        setFormats(state.formats ?? []);
        setAudiences(state.audiences ?? []);
        setIdeas(state.ideas ?? []);
        setSelectedIdeaId(state.selectedIdeaId ?? null);
        setAssets(state.assets ?? {});
        setImages(state.images ?? {});
        setImageJobId(state.imageJobId ?? null);
        setActiveFormatTab(state.activeFormatTab ?? null);
        setDesign(state.design ?? {});
        setIncludeText(state.includeText ?? true);
        setStep(state.step ?? 0);
      })
      .catch(() => setError("Could not load that campaign — starting a new one."))
      .finally(() => {
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [resumeId, secondaryOptions]);

  const snapshotJson = JSON.stringify(snapshot);
  useEffect(() => {
    // Don't save an empty shell, and never save over a campaign still loading.
    if (!hydratedRef.current || !brief.trim()) return undefined;
    const timer = setTimeout(() => {
      apiSaveCampaign({
        id: campaignIdRef.current,
        name: brief.trim().slice(0, 60) || "Untitled campaign",
        campaignType,
        status: step >= STEP_LABELS.length - 1 ? "ready" : "draft",
        state: JSON.parse(snapshotJson),
      })
        .then((id) => {
          campaignIdRef.current = id;
          setSavedAt(Date.now());
          // Put the id in the URL the moment we have one. The work was already
          // being saved, but nothing pointed at it: on /image with no id, any
          // reload or remount restarted the wizard at step 1 with everything
          // apparently lost. Replace rather than push so Back still leaves the
          // wizard instead of walking through its own history.
          if (!resumeId && !location.pathname.endsWith(`/${id}`)) {
            navigate(`${location.pathname.replace(/\/+$/, "")}/${id}`, { replace: true });
          }
        })
        .catch(() => {
          /* autosave is best-effort; the wizard keeps working offline */
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [snapshotJson, brief, campaignType, step, resumeId, location.pathname, navigate]);

  // --- Ideas prefetch ---
  // Ideas depend only on the setup steps, so generation can start the moment
  // the audience is confirmed and run while the user walks to the Ideas step,
  // instead of them staring at a spinner once they arrive.
  const ideasJobRef = useRef(new Map());

  const ideasKey = JSON.stringify([
    brief,
    selectedProducts,
    secondary,
    formats,
    effectiveAudiences,
  ]);

  const runIdeasJob = (key) => {
    const cached = ideasJobRef.current.get(key);
    if (cached) return cached;
    const startedAt = Date.now();
    // Settles rather than rejects — an unawaited prefetch must not surface as
    // an unhandled rejection.
    const job = apiGenerateIdeas({
      brief,
      product: selectedProduct,
      products: selectedProducts,
      background: secondary,
      formats,
      audiences: effectiveAudiences,
    })
      .then((data) => ({ ok: true, data, ms: Date.now() - startedAt }))
      .catch((err) => ({ ok: false, err, ms: Date.now() - startedAt }));
    ideasJobRef.current.set(key, job);
    if (ideasJobRef.current.size > 3) {
      ideasJobRef.current.delete(ideasJobRef.current.keys().next().value);
    }
    return job;
  };

  // --- Step 6: Ideas & Copy ---
  const handleGenerateIdeas = async ({ force = false } = {}) => {
    setBusy(true);
    setError(null);
    const clickedAt = Date.now();
    if (force) ideasJobRef.current.delete(ideasKey);

    const result = await runIdeasJob(ideasKey);
    if (result.ok) {
      setIdeas(result.data);
      setSelectedIdeaId(result.data[0].id);
    } else {
      setError(`Gemini unavailable — ${result.err.message}. Showing example ideas instead.`);
      ideasJobRef.current.delete(ideasKey); // a failure must not be cached
      const generated = fallbackIdeas(brief);
      setIdeas(generated);
      setSelectedIdeaId(generated[0].id);
    }
    setTimings((t) => ({ ...t, ideas: { ms: result.ms, waited: Date.now() - clickedAt } }));
    setBusy(false);
  };

  const updateIdeaField = (id, field, value) =>
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  /**
   * Copy for image campaigns comes from the selected idea, applied to every
   * format. Video and email still need per-format copy from the model, since
   * their fields differ by format.
   */
  const assetsFromIdea = useCallback(
    (idea) =>
      Object.fromEntries(
        formats.map((f) => [
          f,
          {
            en: { headline: idea.headline_en || "", body: idea.body_en || idea.en },
            fr: { headline: idea.headline_fr || "", body: idea.body_fr || idea.fr },
          },
        ])
      ),
    [formats]
  );

  // --- Background prefetch ---
  // Image generation is by far the slowest step. Once a direction has been
  // chosen, start it in the background so the wait overlaps the time the user
  // spends reading and confirming the idea, instead of stacking after it.
  const bgJobsRef = useRef(new Map());

  // Everything the image prompt depends on. If any of it changes — including
  // an edit to the idea text — the prefetched image is no longer valid.
  // One catalog shot per selected product, in selection order, carried as
  // [name, url] pairs so a product whose image fails to convert takes its name
  // with it — the image prompt numbers the attachments to say which is which,
  // so a name without its image would shift every label after it. Kept as a
  // JSON string so the effect below re-runs on a changed selection rather than
  // on every render, which a fresh array literal would cause.
  const productRefPairsJson = JSON.stringify(
    selectedProducts
      .map((name) => [name, products[name]?.image_url])
      .filter(([, url]) => url)
  );

  // Brand assets as data URIs, converted once here and shared by the preview
  // and the exporter. Converting them separately in each is how the preview
  // ends up showing images the exported file does not contain.
  const [inlineAssets, setInlineAssets] = useState({
    productImages: [],
    productImage: "",
    logoImage: "",
  });
  useEffect(() => {
    let cancelled = false;
    const pairs = JSON.parse(productRefPairsJson);
    Promise.all([
      Promise.all(pairs.map(([, url]) => productReferencePng(url))),
      productReferencePng("/samsung-logo.png"),
    ]).then(([converted, logoImage]) => {
      if (cancelled) return;
      const usable = converted.filter(Boolean);
      // `productImage` keeps the first shot so anything that can only render a
      // single product keeps working untouched. It is a fallback, not a ranking.
      setInlineAssets({ productImages: usable, productImage: usable[0] || "", logoImage });
    });
    return () => {
      cancelled = true;
    };
  }, [productRefPairsJson]);

  const bgKey =
    campaignType === "image" && selectedIdea && formats.length
      ? JSON.stringify([
          selectedProducts,
          selectedIdea.id,
          selectedIdea.en,
          secondary,
          formats,
          effectiveAudiences,
        ])
      : null;

  const runBackgroundJob = (key) => {
    const cached = bgJobsRef.current.get(key);
    if (cached) return cached;
    // Settle instead of rejecting: a prefetch nobody awaits must not surface
    // as an unhandled promise rejection.
    const startedAt = Date.now();
    const pairs = JSON.parse(productRefPairsJson);
    const job = Promise.all(pairs.map(([, url]) => productReferencePng(url)))
      .then((refs) => {
        // Keep names and images aligned: a product whose shot failed to convert
        // is dropped from both lists, never from just one.
        const grounded = pairs
          .map(([name], i) => [name, refs[i]])
          .filter(([, ref]) => ref);
        return runImageJob(
          {
            product: selectedProduct,
            products: grounded.map(([name]) => name),
            ideaEn: selectedIdea.en,
            style: secondary,
            bannerSizes: formats,
            audiences: effectiveAudiences,
            productImages: grounded.map(([, ref]) => ref),
            campaignId: campaignIdRef.current,
          },
          // Remember the job so a reload can re-attach instead of paying for
          // the same generation twice.
          { onJobId: (id) => setImageJobId(id) }
        );
      })
      // The server returns image ids; the bytes are fetched by URL and cached
      // by the browser rather than shipped inline as base64.
      .then((data) => ({
        ok: true,
        data: { ...data, images: mapValues(data.images, imageUrl) },
        ms: Date.now() - startedAt,
      }))
      .catch((err) => ({ ok: false, err, ms: Date.now() - startedAt }));
    bgJobsRef.current.set(key, job);
    // Each entry holds several full-size data URIs, so keep only a few.
    if (bgJobsRef.current.size > 3) {
      bgJobsRef.current.delete(bgJobsRef.current.keys().next().value);
    }
    return job;
  };

  // Wait for the selection to settle before spending calls — without this,
  // clicking through the three ideas to compare them would fire a full image
  // batch for each one.
  useEffect(() => {
    if (!bgKey || step !== 5) return undefined;
    const timer = setTimeout(() => runBackgroundJob(bgKey), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgKey, step]);

  // Banner copy is derived from the selected idea, so keep it in sync after
  // generation. Without this, fixing a headline on the Ideas step never
  // reaches the export unless the whole image batch is regenerated — which is
  // the slow, costly part and has nothing to do with the words.
  useEffect(() => {
    if (campaignType !== "image" || !selectedIdea) return;
    setAssets((prev) => (Object.keys(prev).length ? assetsFromIdea(selectedIdea) : prev));
  }, [campaignType, selectedIdea, assetsFromIdea]);

  // A verdict only describes the copy it was run against. Once that copy
  // changes the report is stale, so drop it rather than show a stale pass.
  //
  // Compared rather than cleared blindly: the fix-and-recheck flow replaces the
  // copy and the report together, and that pairing is current, not stale — a
  // blanket clear would erase the result of the re-check that just ran.
  const reportAssetsRef = useRef(null);
  useEffect(() => {
    if (reportAssetsRef.current !== null && reportAssetsRef.current !== JSON.stringify(assets)) {
      reportAssetsRef.current = null;
      setReport(null);
    }
  }, [assets]);

  // --- Step 7: Asset Generation (images for image campaigns, copy otherwise) ---
  const handleGenerateAssets = async ({ force = false } = {}) => {
    setBusy(true);
    setError(null);
    setActiveFormatTab(formats[0]);

    const clickedAt = Date.now();

    if (campaignType === "image") {
      setAssets(assetsFromIdea(selectedIdea));
      if (force) bgJobsRef.current.delete(bgKey);
      // Resolves immediately if the prefetch above already finished.
      const result = await runBackgroundJob(bgKey);
      setTimings((t) => ({
        ...t,
        images: { ms: result.ms, waited: Date.now() - clickedAt },
      }));
      if (result.ok) {
        setImages(result.data.images);
        if (result.data.failed?.length) {
          setError(
            `Image generation failed for ${result.data.failed.join(", ")} — those use the preset background.`
          );
        } else if (result.data.degraded?.length) {
          setError(
            `${result.data.degraded.join(", ")} was rate-limited, so it reuses the closest generated image. ` +
              `Regenerate to try for a dedicated one.`
          );
        }
      } else {
        // Don't cache a failure — the next attempt should really retry.
        bgJobsRef.current.delete(bgKey);
        setError(`Image generation unavailable — ${result.err.message}. Using preset backgrounds.`);
      }
      setBusy(false);
      return;
    }

    try {
      setAssets(
        await apiGenerateAssets(
          campaignType,
          productLabel,
          { en: selectedIdea.en, fr: selectedIdea.fr },
          formats,
          effectiveAudiences,
          secondary,
          brief,
          selectedProducts
        )
      );
    } catch (err) {
      setError(`Gemini unavailable — ${err.message}. Showing example copy instead.`);
      setAssets(
        fallbackAssets({
          product: productLabel,
          idea: selectedIdea,
          formats,
          audiences: effectiveAudiences,
          secondary,
        })
      );
    } finally {
      setBusy(false);
    }
  };

  const updateAssetField = (format, lang, field, value) =>
    setAssets((prev) => ({
      ...prev,
      [format]: { ...prev[format], [lang]: { ...prev[format][lang], [field]: value } },
    }));

  // --- Steps 8-9: Edit, then Export behind an automatic quality gate ---
  const bannerConfigsRef = useRef({});
  const registerBannerConfig = useCallback((format, lang, cfg) => {
    bannerConfigsRef.current[`${format}__${lang}`] = cfg;
  }, []);

  const exportFiles = buildExportFiles({
    product: productLabel,
    products: selectedProducts,
    formats,
    assets,
    inline: inlineAssets,
    secondary,
    design,
  });

  // The .txt files are a plain-text copy deck that sits beside the real
  // deliverable, for review and translation. Some packages do not want them.
  const isTextFile = (f) => f.name.toLowerCase().endsWith(".txt");
  const textFileCount = exportFiles.filter(isTextFile).length;
  const packagedFiles = includeText ? exportFiles : exportFiles.filter((f) => !isTextFile(f));
  // Banners are rasterised at download time, so they are not in `exportFiles`
  // yet — but only image campaigns produce any.
  const willHaveBanners = campaignType === "image";
  // Video exports nothing but text, so dropping it would zip up an empty file.
  const zipWouldBeEmpty = packagedFiles.length === 0 && !willHaveBanners;
  // Built by parts so unticking the text files reads as "full-resolution PNGs"
  // rather than "0 files + full-resolution PNGs".
  const packageSummary = [
    packagedFiles.length &&
      `${packagedFiles.length} file${packagedFiles.length === 1 ? "" : "s"}`,
    willHaveBanners && "full-resolution PNGs",
  ]
    .filter(Boolean)
    .join(" + ");

  // Backend emits "pass" | "warn" | "fail"; the report component maps those to
  // display labels. Compare against the raw value, not the label.
  const verdict = String(report?.overall ?? "").toLowerCase();

  /** Run the guardrail review against a specific set of copy. */
  const runChecksOn = async (target) => {
    // Report the actual on-canvas logo positions so the layout rule is
    // checked against what will really be exported.
    const logoPlacements = Object.entries(bannerConfigsRef.current)
      .filter(([key]) => formats.includes(key.split("__")[0]))
      .map(([key, cfg]) => {
        const [fmt, lang] = key.split("__");
        return {
          format: fmt,
          lang,
          y_pct: cfg?.logo?.yPct ?? 0,
          show: cfg?.logo?.show ?? true,
        };
      });
    const result = await apiQualityCheck(
      productLabel,
      campaignType,
      formats,
      target,
      brief,
      logoPlacements,
      selectedProducts
    );
    reportAssetsRef.current = JSON.stringify(target);
    return result;
  };

  /** Export runs the LLM guardrail review first; download only unlocks after it passes. */
  const handleRunChecks = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await runChecksOn(assets));
    } catch (err) {
      setError(`Automatic review unavailable — ${err.message}. You can still export.`);
      setReport({
        overall: "warn",
        checks: [{ criterion: "Automatic review", status: "warn", note: "Could not reach the review model." }],
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Apply the report's own findings to the copy, then re-check.
   *
   * The reviewer already quotes the offending phrase and often names a better
   * one, so sending someone back to the Edit step to retype it by hand is busy
   * work. Only flagged wording is rewritten; everything else comes back as it
   * was.
   */
  const fixable = (report?.checks || []).filter(
    (c) => ["warn", "fail"].includes(String(c.status).toLowerCase()) && c.criterion !== "Logo placement"
  );

  const handleFixAndRecheck = async () => {
    setBusy(true);
    setError(null);
    try {
      const revised = await apiReviseAssets({
        campaignType,
        product: productLabel,
        products: selectedProducts,
        formats,
        assets,
        checks: report?.checks || [],
        brief,
      });
      // Claim the pairing before the state lands, so the staleness guard below
      // recognises this copy and report as belonging together.
      reportAssetsRef.current = JSON.stringify(revised);
      setAssets(revised);
      setReport(await runChecksOn(revised));
    } catch (err) {
      setError(`Could not apply the fixes — ${err.message}. Your copy is unchanged.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadZip = async () => {
    setExporting(true);
    try {
      const files = [...packagedFiles];
      const slug = productLabel.replace(/\s+/g, "_");
      for (const [key, cfg] of Object.entries(bannerConfigsRef.current)) {
        const [fmt, lang] = key.split("__");
        if (!formats.includes(fmt)) continue;
        try {
          const blob = await renderBanner(cfg);
          files.push({
            name: `${slug}_${fmt.replace(/\s+/g, "_")}_${lang.toUpperCase()}.png`,
            content: blob,
          });
        } catch {
          /* skip a banner that fails to rasterise rather than losing the whole ZIP */
        }
      }
      await downloadZip(exportZipName(productLabel), files);
    } finally {
      setExporting(false);
    }
  };

  const assetCtx = {
    // The label names every product in the campaign; the URL is the first one's,
    // for the few places that can only show a single thumbnail.
    product: productLabel,
    products: selectedProducts,
    productImage: products[selectedProduct]?.image_url,
    secondary,
    audiences: effectiveAudiences,
    ideaEn: selectedIdea?.en || "",
    // Lets an editor on the Edit step write copy back into the exported assets.
    onAssetChange: updateAssetField,
    inline: inlineAssets,
    design,
    onDesignChange: setDesign,
    onSecondaryChange: setSecondary,
    onBannerConfig: registerBannerConfig,
  };

  return (
    <WizardShell title={title} steps={STEP_LABELS} currentStep={step}>
      <ErrorBanner message={error} />
      {savedAt && (
        <p className="mb-4 text-xs text-neutral-600">
          Saved automatically · you can close this and pick it up from the home page.
        </p>
      )}

      {/* 1 — Campaign Brief */}
      {step === 0 && (
        <div>
          <StepHeader
            title="Campaign Brief"
            subtitle="Describe what this campaign needs to achieve. Everything after this builds on it."
          />
          <TextArea value={brief} onChange={setBrief} placeholder={ideaPlaceholder} rows={6} />
          <StepButton onClick={goNext} disabled={!brief.trim()}>
            Continue
          </StepButton>
        </div>
      )}

      {/* 2 — Product */}
      {step === 1 && (
        <div>
          <StepHeader
            title="Product"
            subtitle="Choose the product this campaign is built around. Pick more than one to run them as a bundle — they share one set of assets and are given equal billing."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {productNames.map((name) => {
              const p = products[name];
              const picked = selectedProducts.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => toggleProduct(name)}
                  className={`relative rounded-xl border p-4 text-left transition-colors ${
                    picked
                      ? "border-white bg-white/5"
                      : "border-neutral-800 hover:border-neutral-600"
                  }`}
                >
                  {picked && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                      <CheckIcon size={11} />
                    </span>
                  )}
                  <ProductThumbnail name={name} category={p.category} imageUrl={p.image_url} />
                  <p className="text-sm font-semibold text-white">{name}</p>
                  <p className="text-xs text-neutral-500">{p.category}</p>
                </button>
              );
            })}
          </div>
          {selectedProducts.length > 1 && (
            <p className="mt-4 text-xs text-neutral-500">
              Bundle campaign — {productLabel}. One set of assets covering all{" "}
              {selectedProducts.length} with equal billing, not one set each.
            </p>
          )}
          <StepButton onClick={goNext} disabled={!product.length}>
            {product.length > 1 ? `Confirm ${product.length} Products` : "Confirm Product"}
          </StepButton>
        </div>
      )}

      {/* 3 — Background */}
      {step === 2 && (
        <div>
          <StepHeader title="Background" subtitle={`Choose the ${secondaryLabel.toLowerCase()} for this campaign.`} />
          {secondaryPresets ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {secondaryPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setSecondary(preset.label)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    secondary === preset.label
                      ? "border-white bg-white/5"
                      : "border-neutral-800 hover:border-neutral-600"
                  }`}
                >
                  <span
                    className="h-12 w-12 shrink-0 rounded-lg border border-neutral-700"
                    style={{ background: preset.css }}
                  />
                  <span className={`text-sm ${secondary === preset.label ? "font-medium text-white" : "text-neutral-400"}`}>
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="max-w-sm">
              <Select value={secondary} onChange={setSecondary} options={secondaryOptions} />
            </div>
          )}
          <StepButton onClick={goNext}>Confirm Background</StepButton>
        </div>
      )}

      {/* 4 — Formats */}
      {step === 3 && (
        <div>
          <StepHeader title={formatLabel} subtitle="Select every format this campaign should produce." />
          <FormatSquareGrid
            options={formatOptions}
            selected={formats}
            onChange={setFormats}
            aspects={formatAspects}
          />
          <StepButton onClick={goNext} disabled={formats.length === 0}>
            Confirm Formats
          </StepButton>
        </div>
      )}

      {/* 5 — Target Audience */}
      {step === 4 && (
        <div>
          <StepHeader
            title="Target Audience"
            subtitle="Pick one or more segments — the copy will be written to speak to them."
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {AUDIENCES.map((a) => (
              <SquarePreviewCard
                key={a}
                audience={a}
                blurb={audiences.includes(a) ? "Selected" : "Tap to include this segment."}
                imageUrl={AUDIENCE_IMAGES[a]}
                selected={audiences.includes(a)}
                onToggle={() =>
                  setAudiences((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))
                }
              />
            ))}
          </div>
          {/* Everything the ideas call needs is known by now, so start it here
              and let it run while the user moves to the next step. */}
          <StepButton
            onClick={() => {
              runIdeasJob(ideasKey);
              goNext();
            }}
            disabled={audiences.length === 0}
          >
            Confirm Audience
          </StepButton>
        </div>
      )}

      {/* 6 — Ideas & Copy */}
      {step === 5 && (
        <div>
          <StepHeader
            title="Ideas & Copy"
            subtitle="Headlines and body copy in Samsung's brand voice, with guardrails applied, in English and French."
          />
          {ideas.length === 0 ? (
            <StepButton
              onClick={() => handleGenerateIdeas()}
              busy={busy}
              busyLabel="Generating ideas…"
              elapsed={elapsed}
            >
              Generate Ideas & Copy
            </StepButton>
          ) : (
            <>
              <div className="space-y-4">
                {ideas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    selected={idea.id === selectedIdeaId}
                    onSelect={() => setSelectedIdeaId(idea.id)}
                    onChange={(field, value) => updateIdeaField(idea.id, field, value)}
                  />
                ))}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => handleGenerateIdeas({ force: true })}
                  disabled={busy}
                  className="text-sm text-neutral-500 transition-colors hover:text-neutral-300 disabled:opacity-40"
                >
                  {busy ? `Regenerating… ${elapsed}s` : "↻ Regenerate ideas"}
                </button>
              </div>
              <TimingNote timing={timings.ideas} label="Ideas" />
              <StepButton onClick={goNext} disabled={!selectedIdeaId}>
                Confirm Direction
              </StepButton>
            </>
          )}
        </div>
      )}

      {/* 7 — Asset Generation */}
      {step === 6 && (
        <div>
          <StepHeader
            title="Asset Generation"
            subtitle={
              campaignType === "image"
                ? "Banner images generated for each selected format, using your chosen background style."
                : "Campaign copy generated per format, in both languages."
            }
          />
          {Object.keys(assets).length === 0 ? (
            <StepButton
              onClick={() => handleGenerateAssets()}
              busy={busy}
              busyLabel={campaignType === "image" ? "Generating images…" : "Generating assets…"}
              elapsed={elapsed}
            >
              Generate Assets
            </StepButton>
          ) : (
            <>
              <FormatTabs formats={formats} active={activeFormatTab} onChange={setActiveFormatTab} />

              {campaignType === "image" ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {["en", "fr"].map((lang) => (
                    <div key={lang}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                        {lang === "en" ? "English" : "Français"}
                      </p>
                      <BannerPreview
                        bannerSize={activeFormatTab}
                        image={images[activeFormatTab]}
                        backgroundCss={getBackgroundCss(secondary)}
                        copy={assets[activeFormatTab]?.[lang]}
                        generating={busy}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                activeFormatTab &&
                assets[activeFormatTab] && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {["en", "fr"].map((lang) => (
                      <div key={lang}>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                          {lang === "en" ? "English" : "Français"}
                        </p>
                        {renderAssetTab(
                          activeFormatTab,
                          lang,
                          assets[activeFormatTab][lang],
                          (field, value) => updateAssetField(activeFormatTab, lang, field, value),
                          assetCtx
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              <div className="mt-4">
                <button
                  onClick={() => handleGenerateAssets({ force: true })}
                  disabled={busy}
                  className="text-sm text-neutral-500 transition-colors hover:text-neutral-300 disabled:opacity-40"
                >
                  {busy ? `Regenerating… ${elapsed}s` : "↻ Regenerate assets"}
                </button>
              </div>
              <TimingNote timing={timings.images} label="Images" />
              <StepButton
                onClick={goNext}
                disabled={busy}
                busy={busy}
                busyLabel="Generating images…"
                elapsed={elapsed}
              >
                Continue to Edit
              </StepButton>
            </>
          )}
        </div>
      )}

      {/* 8 — Edit */}
      {step === 7 && (
        <div>
          <StepHeader
            title="Edit"
            subtitle="Drag text and the logo to reposition, and adjust size, weight and colour."
          />
          <FormatTabs formats={formats} active={activeFormatTab} onChange={setActiveFormatTab} />

          {activeFormatTab && assets[activeFormatTab] && renderEditor ? (
            <div className="space-y-8">
              {["en", "fr"].map((lang) => (
                <div key={lang}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {lang === "en" ? "English" : "Français"}
                  </p>
                  {renderEditor(activeFormatTab, lang, assets[activeFormatTab][lang], {
                    ...assetCtx,
                    image: images[activeFormatTab],
                  })}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              This campaign type has no visual editor — continue to export.
            </p>
          )}

          <StepButton onClick={goNext}>Continue to Export</StepButton>
        </div>
      )}

      {/* 9 — Export (gated on the automatic guardrail review) */}
      {step === 8 && (
        <div>
          <StepHeader
            title="Export"
            subtitle="Every asset is reviewed against the Samsung guardrails before the package unlocks."
          />

          {!report ? (
            <StepButton onClick={handleRunChecks} busy={busy} busyLabel="Running quality checks…">
              Run Quality Checks
            </StepButton>
          ) : (
            <>
              <QualityReport report={report} />

              {verdict === "fail" && (
                <div className="mt-4 rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  One or more checks failed. Fix them below or revise the copy yourself — the
                  download stays locked until they pass.
                </div>
              )}

              {verdict.startsWith("warn") && (
                <div className="mt-4 rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
                  Warnings are advisory — you can export as is, fix them below, or revise the
                  copy yourself.
                </div>
              )}

              {verdict !== "pass" && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {/* The review already quotes the offending phrase and usually
                      names a better one, so the common case is one click, not a
                      trip back to the Edit step. */}
                  {fixable.length > 0 && (
                    <button
                      onClick={handleFixAndRecheck}
                      disabled={busy}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {busy
                        ? `Applying fixes… ${elapsed}s`
                        : `Fix ${fixable.length} issue${fixable.length === 1 ? "" : "s"} & re-check`}
                    </button>
                  )}
                  <button
                    onClick={() => setStep(IDEAS_STEP)}
                    className="rounded-lg border border-neutral-600 px-4 py-2 text-sm text-neutral-200 transition-colors hover:border-white hover:text-white"
                  >
                    ← Revise copy myself
                  </button>
                </div>
              )}
              {verdict !== "pass" && (
                <p className="mt-2 text-xs text-neutral-500">
                  Fixing rewrites only the wording the review flagged and re-runs the checks.
                  Revising opens Ideas &amp; Copy, where edits update the banners without
                  regenerating the images.
                </p>
              )}

              <div className="mt-4">
                <button
                  onClick={handleRunChecks}
                  disabled={busy}
                  className="text-sm text-neutral-500 transition-colors hover:text-neutral-300 disabled:opacity-40"
                >
                  {busy ? `Re-checking… ${elapsed}s` : "↻ Re-run checks"}
                </button>
              </div>

              <div className="mt-6 rounded-xl border border-neutral-800 bg-[#111111] p-5">
                <p className="mb-2 text-sm font-semibold text-white">Export package</p>
                <p className="text-sm text-neutral-400">
                  {productLabel} · EN + FR · {formats.length} format{formats.length === 1 ? "" : "s"}
                  {packageSummary ? ` · ${packageSummary}` : ""}
                </p>

                {textFileCount > 0 && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      checked={includeText}
                      onChange={(e) => setIncludeText(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-white"
                    />
                    <span>
                      Include the plain-text copy deck ({textFileCount} .txt file
                      {textFileCount === 1 ? "" : "s"})
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {willHaveBanners || campaignType === "email"
                          ? "For review and translation. Turning it off does not change the artwork."
                          : "This campaign type exports nothing else, so the package would be empty without it."}
                      </span>
                    </span>
                  </label>
                )}

                {zipWouldBeEmpty && (
                  <p className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
                    Nothing left to package. Re-enable the text files to download.
                  </p>
                )}
              </div>

              <div className="mt-6">
                <PrimaryButton
                  onClick={handleDownloadZip}
                  disabled={exporting || verdict === "fail" || zipWouldBeEmpty}
                >
                  {exporting ? (willHaveBanners ? "Rendering banners…" : "Packaging…") : "Download ZIP"}
                </PrimaryButton>
              </div>
            </>
          )}
        </div>
      )}

      {step > 0 && (
        <button onClick={goBack} className="mt-4 text-sm text-neutral-500 transition-colors hover:text-neutral-300">
          ← Previous step
        </button>
      )}
    </WizardShell>
  );
}
