import { useNavigate } from "react-router-dom";

export default function CampaignCard({ icon, title, description, to }) {
  const navigate = useNavigate();
  return (
    <div
      className="group relative rounded-2xl border border-neutral-800 bg-gradient-to-b from-[#161616] to-[#0f0f0f] p-7
                 transition-all duration-200 hover:border-neutral-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
    >
      <div className="mx-auto mb-5 flex h-15 w-15 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900">
        {icon}
      </div>
      <h3 className="mb-2.5 text-center text-xl font-bold tracking-tight text-white">{title}</h3>
      <p className="mb-5 min-h-11 text-center text-sm leading-relaxed text-neutral-400">{description}</p>
      <button
        onClick={() => navigate(to)}
        className="w-full rounded-lg border border-white bg-white py-2.5 text-sm font-semibold text-black
                   transition-colors duration-150 hover:bg-[#0b0b0b] hover:text-white"
      >
        Get started →
      </button>
    </div>
  );
}
