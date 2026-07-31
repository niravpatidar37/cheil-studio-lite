const STATUS_STYLES = {
  pass: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Pass" },
  warn: { dot: "bg-amber-400", text: "text-amber-300", label: "Warning" },
  fail: { dot: "bg-red-400", text: "text-red-300", label: "Fail" },
};

function style(status) {
  return STATUS_STYLES[String(status).toLowerCase()] || STATUS_STYLES.warn;
}

export default function QualityReport({ report }) {
  if (!report) return null;
  const overall = style(report.overall);

  return (
    <div className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-neutral-800 pb-3">
        <span className={`h-2.5 w-2.5 rounded-full ${overall.dot}`} />
        <span className="text-sm font-semibold text-white">Overall — {overall.label}</span>
      </div>
      <ul className="space-y-3">
        {report.checks.map((c, i) => {
          const s = style(c.status);
          return (
            <li key={i} className="flex gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  {c.criterion} <span className={`text-xs font-normal ${s.text}`}>· {s.label}</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">{c.note}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
