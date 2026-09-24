import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** En-tête de page : titre + actions, séparé par une bordure fine. */
export function EnteteePage({
  titre,
  sousTitre,
  actions,
  className,
}: {
  titre: string;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-h-14 items-center gap-3 border-b bg-card px-6 py-2.5", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold">{titre}</h1>
        {sousTitre ? <p className="truncate text-sm text-muted-foreground">{sousTitre}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** État vide qui invite à agir. */
export function EtatVide({
  titre,
  children,
  action,
  className,
}: {
  titre: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2 rounded-lg border border-dashed px-5 py-6", className)}>
      <p className="font-medium">{titre}</p>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
      {action}
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Section({
  titre,
  compteur,
  actions,
  children,
  className,
}: {
  titre: string;
  compteur?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {titre}
          {compteur != null ? <span className="ml-1.5 tabular font-normal">{compteur}</span> : null}
        </h2>
        <div className="flex-1" />
        {actions}
      </div>
      {children}
    </section>
  );
}

export function PastilleDomaine({ nom, couleur, className }: { nom: string; couleur: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground", className)}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: couleur }} />
      <span className="truncate">{nom}</span>
    </span>
  );
}

export function EcranChargement({ message = "Chargement…" }: { message?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground" role="status">
      {message}
    </div>
  );
}

export function MessageErreur({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-urgent/30 bg-urgent/5 px-3 py-2 text-sm">
      <div className="flex-1 text-foreground">{children}</div>
      {action}
    </div>
  );
}
