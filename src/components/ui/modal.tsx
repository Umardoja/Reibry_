"use client";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({ open, onClose, title, children, labelledBy, alert = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; labelledBy?: string; alert?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", close); };
  }, [open, onClose]);
  if (typeof document === "undefined" || !open) return null;
  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="modal-sheet" role={alert ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={labelledBy} onMouseDown={(event) => event.stopPropagation()}>
      <h2 id={labelledBy}>{title}</h2>{children}
    </section>
  </div>, document.body);
}

export function ChoiceRows({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <fieldset className="choice-group"><legend>{label}</legend><div className="choice-rows" role="radiogroup" aria-label={label}>{options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={`choice-row${value === option.value ? " selected" : ""}`} onClick={() => onChange(option.value)}><span>{option.label}</span>{value === option.value && <span aria-hidden="true">✓</span>}</button>)}</div></fieldset>;
}
