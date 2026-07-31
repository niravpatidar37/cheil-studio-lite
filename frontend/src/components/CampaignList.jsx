import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiListCampaigns, apiDeleteCampaign } from "../lib/api";

const ROUTE_FOR = { image: "/image", video: "/video", email: "/email" };

const STATUS_STYLE = {
  ready: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
  draft: "border-neutral-700 bg-neutral-900 text-neutral-400",
};

function when(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Saved campaigns, resumable. This is the "managing" half of the product —
 * without it every refresh threw the work away.
 */
export default function CampaignList() {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    apiListCampaigns()
      .then(setCampaigns)
      .catch(() => setError("Could not reach the API — saved campaigns are unavailable."));

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    try {
      await apiDeleteCampaign(id);
    } catch {
      load(); // put it back if the delete did not stick
    }
  };

  if (error) return <p className="text-sm text-neutral-500">{error}</p>;
  if (!campaigns) return <p className="text-sm text-neutral-500">Loading saved campaigns…</p>;
  if (!campaigns.length) {
    return (
      <p className="text-sm text-neutral-500">
        No saved campaigns yet. Anything you start is saved automatically as you go.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800">
      {campaigns.map((c) => (
        <li key={c.id} className="flex items-center gap-4 bg-[#111111] px-4 py-3">
          <Link
            to={`${ROUTE_FOR[c.campaign_type] || "/image"}/${c.id}`}
            className="min-w-0 flex-1 group"
          >
            <p className="truncate text-sm font-medium text-white group-hover:underline">{c.name}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {c.campaign_type} · edited {when(c.updated_at)}
            </p>
          </Link>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
              STATUS_STYLE[c.status] || STATUS_STYLE.draft
            }`}
          >
            {c.status}
          </span>
          <button
            onClick={() => remove(c.id)}
            aria-label={`Delete ${c.name}`}
            className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-red-700 hover:text-red-300"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
