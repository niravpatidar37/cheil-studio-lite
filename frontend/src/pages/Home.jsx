import Header from "../components/Header";
import CampaignCard from "../components/CampaignCard";
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

      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-tight">Your campaigns</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Work is saved as you go. Pick one up where you left off.
        </p>
      </div>
      <CampaignList />
    </div>
  );
}
