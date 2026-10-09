// Small set of form primitives in the Stroka look (dark, hairlines, champagne).

const inputCls =
  "w-full border border-edge bg-panel px-3 py-2.5 text-sm font-light text-bone placeholder:text-ash/50 focus:border-champagne focus:outline-none";

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[0.6rem] font-medium uppercase tracking-wider2 text-ash">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ash/70">{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return <input {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function Textarea({ rows = 3, ...props }) {
  return <textarea rows={rows} {...props} className={`${inputCls} resize-y ${props.className || ""}`} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`${inputCls} bg-panel ${props.className || ""}`}>
      {children}
    </select>
  );
}

export function Button({ variant = "line", className = "", ...props }) {
  const v = {
    solid: "bg-champagne font-semibold text-ink hover:bg-bone",
    line: "border border-[#55524d] text-bone hover:border-champagne hover:text-champagne",
    ghost: "text-ash hover:text-bone",
    danger: "border border-[#a0615a] text-[#d49a92] hover:bg-[#a0615a]/15",
  }[variant];
  return (
    <button
      {...props}
      className={`px-4 py-2.5 text-[0.68rem] uppercase tracking-wider2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    />
  );
}

export function Section({ title, children, aside }) {
  return (
    <section className="pt-2">
      <div className="mb-5 flex items-center gap-4">
        <h2 className="text-[0.66rem] font-semibold uppercase tracking-[0.3em] text-champagne">{title}</h2>
        <span className="h-px flex-1 bg-edge" />
        {aside}
      </div>
      {children}
    </section>
  );
}
