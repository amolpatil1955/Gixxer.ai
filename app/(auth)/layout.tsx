import Link from "next/link";
import { BrandPanel } from "@/components/brand/brand-panel";
import { Wordmark } from "@/components/brand/wordmark";
import { routes } from "@/lib/auth/routes";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <BrandPanel />

      <main className="flex flex-col">
        <header className="flex items-center justify-between px-5 pt-6 sm:px-8 lg:hidden">
          <Link href={routes.home} aria-label="Gixxer.ai home">
            <Wordmark size="sm" />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:py-16">{children}</div>

        <footer className="px-5 pb-6 text-center text-xs text-ink-500 sm:px-8">
          © {new Date().getFullYear()} Gixxer.ai · Multi-model AI workspace
        </footer>
      </main>
    </div>
  );
}
