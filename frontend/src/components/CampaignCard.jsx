import { useNavigate } from "react-router-dom";

export default function CampaignCard({ icon, title, description, to }) {
  const navigate = useNavigate();
  return (
    <div
      className="group relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#0a0a0a]/60 p-8
                 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-white/10 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]"
    >
      {/* Subtle glowing ambient orb inside the card */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-[#1C92D2]/20 to-[#6441a5]/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-0 pointer-events-none" />

      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-neutral-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-110 group-hover:text-white group-hover:border-white/20">
        {icon}
      </div>
      <h3 className="mb-3 text-center text-xl font-bold tracking-tight text-white/90 transition-colors group-hover:text-white">{title}</h3>
      <p className="mb-8 min-h-11 text-center text-sm leading-relaxed text-neutral-400 group-hover:text-neutral-300 transition-colors">{description}</p>

      <button
        onClick={() => navigate(to)}
        className="w-full relative overflow-hidden rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 border border-white/5
                   transition-all duration-300 hover:text-white hover:shadow-[0_4px_20px_rgba(255,255,255,0.1)] hover:border-white/20"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          Get started <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1C92D2]/80 to-[#6441a5]/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </button>
    </div>
  );
}
