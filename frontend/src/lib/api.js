function getOwnerId() {
  let id = localStorage.getItem("studio_owner_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("studio_owner_id", id);
  }
  return id;
}

const COMMON_HEADERS = () => ({
  "Content-Type": "application/json",
  "X-Owner-Id": getOwnerId(),
  "X-Demo-Mode": localStorage.getItem("studio_demo_mode") === "true" ? "true" : "false",
});

async function postJSON(path, body) {
  // Backward compatible static timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    console.log(`[HTTP POST] >> ${path}`, body);
    const res = await fetch(path, {
      method: "POST",
      headers: COMMON_HEADERS(),
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail || `Request to ${path} failed: ${res.status}`);
    }

    const result = await res.json();
    console.log(`[HTTP SUCCESS] << ${path}`, result);
    return result;
  } catch (err) {
    console.error(`[HTTP CATCH] !! ${path}`, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getProducts() {
  return fetch("/api/products").then((res) => res.json());
}

export async function apiExtractText(file) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = COMMON_HEADERS();
  delete headers["Content-Type"]; // browser handles multipart boundary

  const res = await fetch("/api/extract-text", {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error("Could not parse document");
  const data = await res.json();
  return data.text;
}

// `products` is the full set — a campaign can cover several at once, weighted
// equally, sharing one set of assets. `product` is a single-name fallback for
// display and file naming, not a ranking.
export async function apiGenerateIdeas({
  brief,
  product,
  products = [],
  background,
  formats,
  audiences,
}) {
  const data = await postJSON("/api/ideas", {
    brief,
    product,
    products,
    background,
    formats,
    audiences,
  });
  return data.ideas;
}

export async function apiTranslateIdeas(ideas) {
  const data = await postJSON("/api/ideas/translate", { ideas });
  return data.ideas;
}

export async function apiQualityCheck(
  product,
  campaignType,
  formats,
  assets,
  brief,
  logoPlacements = [],
  products = []
) {
  return postJSON("/api/quality-check", {
    product,
    products,
    campaign_type: campaignType,
    formats,
    assets,
    brief,
    logo_placements: logoPlacements,
  });
}


// Hand a report's findings back to the model and get the corrected copy, so a
// flagged nit can be cleared from the Export step instead of by walking back to
// Edit and retyping it.
export async function apiReviseAssets({
  campaignType,
  product,
  products = [],
  formats,
  assets,
  checks,
  brief = "",
}) {
  const data = await postJSON("/api/assets/revise", {
    campaign_type: campaignType,
    product,
    products,
    formats,
    assets,
    checks,
    brief,
  });
  return data.assets;
}

export async function apiGenerateAssets(
  campaignType,
  product,
  idea,
  formats,
  audiences,
  secondary = "",
  brief = ""
) {
  const data = await postJSON("/api/assets", {
    campaign_type: campaignType,
    product,
    idea,
    formats,
    audiences,
    secondary,
    brief,
  });
  return data.assets;
}

// --- Image generation, as a job -------------------------------------------
// Generation runs 8-80s depending on Vertex capacity, so the server starts the
// work and returns a job id rather than holding the request open. The job keeps
// running if this tab navigates away or reloads.

const POLL_MS = 1200;

export function imageUrl(imageId) {
  return `/api/images/${imageId}`;
}

export async function apiStartImageJob({
  product,
  products = [],
  ideaEn,
  style,
  bannerSizes,
  audiences = [],
  productImage = "",
  productImages = [],
  campaignId = null,
  brief = "",
}) {
  const data = await postJSON("/api/jobs/images", {
    product,
    products,
    idea_en: ideaEn,
    style,
    banner_sizes: bannerSizes,
    audiences,
    product_image: productImage,
    // One reference per product, in the same order as `products`.
    product_images: productImages,
    campaign_id: campaignId,
    brief,
  });
  return data.job_id;
}

export async function apiGetJob(jobId) {
  const res = await fetch(`/api/jobs/${jobId}`, { headers: COMMON_HEADERS(), cache: "no-store" });
  if (!res.ok) throw new Error(`Job ${jobId} not found`);
  return res.json();
}

/** Poll an existing job to completion. Resolves to its result. */
export async function awaitJob(jobId) {
  for (; ;) {
    const job = await apiGetJob(jobId);
    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.error || "Image generation failed");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/**
 * Start image generation and wait for it. `onJobId` receives the id as soon as
 * the job exists, so callers can persist it and re-attach after a reload
 * instead of paying for the same generation twice.
 */
export async function runImageJob(params, { onJobId } = {}) {
  const jobId = await apiStartImageJob(params);
  onJobId?.(jobId);
  return awaitJob(jobId);
}

// --- Campaign persistence --------------------------------------------------
export async function apiSaveCampaign({ id, name, campaignType, status = "draft", state }) {
  const data = await postJSON("/api/campaigns", {
    id,
    name,
    campaign_type: campaignType,
    status,
    state,
  });
  return data.id;
}

export async function apiListCampaigns() {
  const res = await fetch("/api/campaigns", { headers: COMMON_HEADERS() });
  if (!res.ok) throw new Error("Could not load campaigns");
  return (await res.json()).campaigns;
}

export async function apiGetCampaign(id) {
  const res = await fetch(`/api/campaigns/${id}`, { headers: COMMON_HEADERS() });
  if (!res.ok) throw new Error("Campaign not found");
  return res.json();
}

export async function apiDeleteCampaign(id) {
  const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE", headers: COMMON_HEADERS() });
  if (!res.ok) throw new Error("Could not delete campaign");
}
