import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonClassName } from "@/components/ui/button";
import { routes } from "@/lib/auth/routes";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Wordmark size="md" />
      <p className="mt-10 font-mono text-xs uppercase tracking-[0.3em] text-ink-400">Error 404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">This page does not exist.</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-300">The link may be outdated, or the page may have moved.</p>
      <Link href={routes.home} className={buttonClassName({ variant: "primary", size: "md", className: "mt-8" })}>
        Back to Gixxer.ai
      </Link>
    </main>
  );
}
