// Small set of form primitives in the Stroka look (dark, hairlines, champagne).

const inputCls =
  "w-full border border-bone/15 bg-transparent px-3 py-2.5 text-sm text-bone placeholder:text-ash/60 focus:border-champagne focus:outline-none";

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[0.62rem] uppercase tracking-wider2 text-ash">{label}</span>
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
    <select {...props} className={`${inputCls} bg-ink ${props.className || ""}`}>
      {children}
    </select>
  );
}

export function Button({ variant = "line", className = "", ...props }) {
  const v = {
    solid: "bg-bone text-ink hover:bg-champagne",
    line: "border border-bone/25 text-bone hover:border-champagne hover:text-champagne",
    ghost: "text-ash hover:text-bone",
    danger: "border border-red-400/40 text-red-300 hover:bg-red-400/10",
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
    <section className="border-t hairline pt-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[0.72rem] font-medium uppercase tracking-wider3 text-champagne">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
