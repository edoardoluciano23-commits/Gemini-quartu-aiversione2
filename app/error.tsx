"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold">Si è verificato un errore</h2>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground font-medium hover:opacity-90"
      >
        Riprova
      </button>
    </div>
  );
}
