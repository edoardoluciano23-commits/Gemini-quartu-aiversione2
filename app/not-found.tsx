import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-bold text-foreground">404 - Pagina non trovata</h1>
      <p className="mt-2 text-muted-foreground">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 inline-block"
      >
        Torna alla Home
      </Link>
    </div>
  );
}
