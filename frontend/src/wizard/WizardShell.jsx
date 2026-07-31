import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { ArrowLeftIcon, CheckIcon } from "../components/icons";

export default function WizardShell({ title, steps, currentStep, children }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <Header />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
        <aside>
          <button
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white"
          >
            <ArrowLeftIcon size={14} />
            Back to Home
          </button>
          <h1 className="mb-5 text-lg font-bold tracking-tight">{title}</h1>
          <nav className="space-y-1">
            {steps.map((step, i) => {
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <div
                  key={step}
                  className={`flex items-start gap-3 rounded-lg border-l-2 px-3 py-2.5 transition-colors ${
                    isActive ? "border-white bg-white/5" : "border-transparent"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      isDone
                        ? "border-white bg-white text-black"
                        : isActive
                          ? "border-white text-white"
                          : "border-neutral-700 text-neutral-600"
                    }`}
                  >
                    {isDone ? <CheckIcon size={11} /> : String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`text-sm leading-5 ${
                      isActive ? "font-semibold text-white" : isDone ? "text-neutral-300" : "text-neutral-600"
                    }`}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
