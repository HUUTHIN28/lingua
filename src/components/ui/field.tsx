import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
};

export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const descriptionId = error || hint ? `${id}-description` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-bold text-slate-800">{label}</label>
      {children({ id, "aria-describedby": descriptionId, "aria-invalid": error ? true : undefined })}
      {(error || hint) && <p id={descriptionId} className={`text-sm ${error ? "font-medium text-rose-700" : "text-slate-500"}`}>{error || hint}</p>}
    </div>
  );
}

const controlClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)] aria-invalid:border-rose-500 aria-invalid:ring-rose-100";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClass} ${className}`} {...props} />;
}
export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} min-h-28 py-3 ${className}`} {...props} />;
}
