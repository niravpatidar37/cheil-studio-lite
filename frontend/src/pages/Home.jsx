import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import CampaignCard from "../components/CampaignCard";
import { apiSaveCampaign } from "../lib/api";
import CampaignList from "../components/CampaignList";
import { ImageIcon, VideoIcon, EmailIcon } from "../components/icons";

const CARDS = [
  {
    icon: <ImageIcon />,
    title: "Image Campaign",
    description: "Static banners and social posts across sizes and backgrounds.",
    to: "/image",
  },
  {
    icon: <VideoIcon />,
    title: "Video Campaign",
    description: "Short-form video scripts and storyboard concepts.",
    to: "/video",
  },
  {
    icon: <EmailIcon />,
    title: "Email Campaign",
    description: "Subject lines, email copy, and A/B variants.",
    to: "/email",
  },
];

export default function Home() {
  const navigate = useNavigate();

  const loadDemoCampaign = async () => {
    localStorage.setItem("studio_demo_mode", "true");

    const demoState = {
      version: 1,
      step: 6, // Lands directly on Export
      brief: "Launch the new Galaxy S26 Ultra in Canada, highlighting its AI camera features.",
      product: ["Galaxy S26"],
      secondary: "Abstract neon energy",
      formats: ["Mobile", "Desktop"],
      audiences: ["Young professionals"],
      ideas: [{
        id: 1,
        en: "Highlight how this fits perfectly into daily life.",
        fr: "Montrez comment cela s'intègre parfaitement au quotidien.",
        headline_en: "Made for the way you live",
        headline_fr: "Conçu pour votre quotidien",
        body_en: "Technology that keeps up with your day, from the first alarm to the last message.",
        body_fr: "Une technologie qui suit le rythme de vos journées, du premier réveil au dernier message."
      }],
      selectedIdeaId: 1,
      assets: {
        "Mobile": {
          "en": { "headline": "Experience the new Galaxy S26.", "body": "Designed for young professionals expects the best." },
          "fr": { "headline": "Découvrez le nouveau Galaxy S26.", "body": "Conçu pour les jeunes professionnels." }
        },
        "Desktop": {
          "en": { "headline": "Experience the new Galaxy S26.", "body": "Designed for young professionals expects the best." },
          "fr": { "headline": "Découvrez le nouveau Galaxy S26.", "body": "Conçu pour les jeunes professionnels." }
        }
      },
      includeText: true
    };

    try {
      const id = await apiSaveCampaign({
        name: "Samsung Demo Campaign",
        campaignType: "image",
        status: "ready",
        state: demoState
      });
      window.location.href = `/image/${id}`;
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <Header />

      <div className="mt-10">
        <h1 className="text-2xl font-bold tracking-tight">What are you creating today?</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Choose a campaign format to launch the multi-agent pipeline.
        </p>
      </div>

      <hr className="my-8 border-neutral-800" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {CARDS.map((c) => (
          <CampaignCard key={c.to} {...c} />
        ))}
      </div>

      <hr className="my-10 border-neutral-800" />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Your campaigns</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Work is saved as you go. Pick one up where you left off.
          </p>
        </div>
        <button
          onClick={loadDemoCampaign}
          className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-sm font-semibold text-white transition-colors border border-neutral-600"
        >
          Load Samsung demo campaign
        </button>
      </div>
      <CampaignList />
    </div>
  );
}
