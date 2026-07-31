const inputClass =
  "w-full rounded-md border border-neutral-700 bg-[#151515] px-3 py-2 text-sm text-white " +
  "placeholder-neutral-600 outline-none focus:border-white transition-colors";

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3, readOnly = false }) {
  return (
    <textarea
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      rows={rows}
      readOnly={readOnly}
      className={inputClass}
    />
  );
}

export function TextInput({ value, onChange, readOnly = false }) {
  return (
    <input
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={readOnly}
      className={inputClass}
    />
  );
}

export function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-neutral-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-600 bg-[#151515] accent-white"
      />
      {label}
    </label>
  );
}

export function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg border border-white bg-white py-2.5 text-sm font-semibold text-black
                 transition-colors duration-150 hover:bg-[#0b0b0b] hover:text-white
                 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black"
    >
      {children}
    </button>
  );
}
