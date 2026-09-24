import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import { cn, getStatusLabel, getStatusTone } from "../../lib/format";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("button", `button--${variant}`, `button--${size}`, className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn("card", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card-header">
      <div>
        <h2 className="card-title">{title}</h2>
        {description ? <p className="card-description">{description}</p> : null}
      </div>
      {action ? <div className="card-action">{action}</div> : null}
    </div>
  );
}

export function Badge({ status, children, tone }: { status?: string; children?: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  const resolvedTone = tone ?? getStatusTone(status);
  return <span className={cn("badge", `badge--${resolvedTone}`)}>{children ?? getStatusLabel(status)}</span>;
}

export function Input({ label, error, hint, className, leftIcon, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string; leftIcon?: ReactNode }) {
  return (
    <label className={cn("field", className)}>
      {label ? <span className="field-label">{label}</span> : null}
      {leftIcon ? <span className="input-with-icon">{leftIcon}<input className={cn("control", error && "control--error")} {...props} /></span> : <input className={cn("control", error && "control--error")} {...props} />}
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, error, hint, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <label className={cn("field", className)}>
      {label ? <span className="field-label">{label}</span> : null}
      <span className="select-wrap">
        <select className={cn("control", error && "control--error")} {...props}>
          {children}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Textarea({ label, error, hint, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <label className={cn("field", className)}>
      {label ? <span className="field-label">{label}</span> : null}
      <textarea className={cn("control", "control--textarea", error && "control--error")} {...props} />
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Modal({ open, title, description, onClose, children, size = "md" }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; size?: "sm" | "md" | "lg" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={cn("modal", `modal--${size}`)} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div>
            <h2 id="modal-title" className="modal-title">{title}</h2>
            {description ? <p className="modal-description">{description}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer la fenêtre">
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}

export function LoadingState({ label = "Chargement des données…" }: { label?: string }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="state-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title = "Aucune donnée", description, action, icon }: { title?: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="state state--empty">
      <div className="state-icon">{icon ?? <Check size={20} aria-hidden="true" />}</div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message = "Impossible de charger les données.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <div className="state-icon state-icon--danger"><AlertCircle size={20} aria-hidden="true" /></div>
      <h3>Un problème est survenu</h3>
      <p>{message}</p>
      {onRetry ? <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button> : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}

export function InlineNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  return <div className={cn("inline-notice", `inline-notice--${tone}`)} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>{children}</div>;
}

export function StatDelta({ value, suffix = "vs période précédente" }: { value?: number; suffix?: string }) {
  if (value === undefined || Number.isNaN(value)) return null;
  const positive = value >= 0;
  return (
    <span className={cn("stat-delta", positive ? "stat-delta--positive" : "stat-delta--negative")}>
      {positive ? "↗" : "↘"} {Math.abs(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}% <small>{suffix}</small>
    </span>
  );
}
