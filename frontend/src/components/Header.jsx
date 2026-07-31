import { Link } from "react-router-dom";

export default function Header() {
  return (
    <Link to="/" className="flex items-center gap-4 group w-fit">
      <img src="/logo_cheil.svg" alt="Cheil" className="h-6 w-auto" />
      <span className="text-2xl font-extrabold tracking-tight text-white group-hover:text-neutral-300 transition-colors">
        Studio Lite
      </span>
    </Link>
  );
}
