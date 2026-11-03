import type { ReactNode } from "react";

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <a href="/" className="mb-8 font-serif text-2xl font-bold">
        Рецепты<span className="text-accent">.</span>
      </a>
      <h1 className="mb-5 text-3xl">{title}</h1>
      {children}
    </main>
  );
}

export function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <input className="input" {...input} />
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{children}</p>
  ) : null;
}

/** Follow a better-auth `{ redirect, url }` response (OAuth flows), else go to `fallback`. */
export function followRedirect(data: unknown, fallback: string) {
  const d = data as { redirect?: boolean; url?: string } | null;
  window.location.assign(d?.redirect && d.url ? d.url : fallback);
}
