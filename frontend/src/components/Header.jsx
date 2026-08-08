import { Link } from "react-router-dom";
import { useState } from "react";

export default function Header() {
  const [isDemo, setIsDemo] = useState(
    localStorage.getItem("studio_demo_mode") === "true"
  );

  const toggleDemo = () => {
    const val = !isDemo;
    setIsDemo(val);
    localStorage.setItem("studio_demo_mode", val ? "true" : "false");
    window.location.reload();
  };
  return (
    <header className="flex items-center justify-between">
      <Link to="/" className="flex items-center gap-4 group w-fit">
        <img src="/logo_cheil.svg" alt="Cheil" className="h-6 w-auto" />
        <span className="text-2xl font-extrabold tracking-tight text-white group-hover:text-neutral-300 transition-colors">
          Studio Lite
        </span>
      </Link>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-300 hover:text-white">
        <input
          type="checkbox"
          checked={isDemo}
          onChange={toggleDemo}
          className="rounded border-neutral-700 bg-neutral-800 text-white focus:ring-1 focus:ring-white"
        />
        Demo mode (no AI key)
      </label>
    </header>
  );
}
