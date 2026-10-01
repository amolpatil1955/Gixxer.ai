"use client";

import { useEffect } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Details stay in the console / server logs. The UI never shows internals.
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Wordmark size="md" />
      <p className="mt-10 font-mono text-xs uppercase tracking-[0.3em] text-ink-400">Something went wrong</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">We hit an unexpected error.</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-300">
        Nothing you did caused this. Try again, and if it keeps happening, come back in a few minutes.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-[11px] text-ink-500">Reference: {error.digest}</p> : null}
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
