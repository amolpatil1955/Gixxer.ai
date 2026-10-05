"use client";

import { Download, RefreshCw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { GMark } from "@/components/brand/g-mark";

export interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
  /** A direct download link. Omitted when the download needs a step first (see `actions`). */
  downloadHref?: string;
  /** Shown under the picture, e.g. a photographer's credit. */
  attribution?: ReactNode;
  /** Made by Gixxer: shows the mark in the bar. */
  branded?: boolean;
}

interface LightboxProps {
  image: LightboxImage | null;
  onClose: () => void;
  /** Offered when the picture can be made again from its prompt. */
  onRegenerate?: () => void;
  /** Extra controls for the bar. */
  actions?: ReactNode;
}

/** The full-screen viewer for every picture: the studio, reference photos and pictures made in a chat. */
export function Lightbox({ image, onClose, onRegenerate, actions }: LightboxProps) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!image) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [image]);

  return (
    <AnimatePresence>
      {image ? (
        <motion.div
          key="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex flex-col bg-[#05040c]/95 backdrop-blur-md"
          onClick={onClose}
        >
          <div className="flex items-center gap-2 px-3 py-3 sm:px-5" onClick={(event) => event.stopPropagation()}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white" aria-hidden="true">
              <GMark className="size-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-white/80">{image.caption ?? image.alt}</p>
            {onRegenerate ? (
              <button type="button" onClick={onRegenerate} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 px-3.5 text-[13px] text-white hover:bg-white/10">
                <RefreshCw className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Regenerate</span>
              </button>
            ) : null}
            {actions}
            {image.downloadHref ? (
              <a href={image.downloadHref} download className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-white/90">
                <Download className="size-4" aria-hidden="true" />
                Download
              </a>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Close viewer" className="flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-3 pt-0 sm:p-6 sm:pt-0">
            <motion.img
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              src={image.src}
              alt={image.alt}
              className="max-h-full min-h-0 max-w-full rounded-2xl object-contain shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
              onClick={(event) => event.stopPropagation()}
            />
            {image.attribution ? (
              <div className="rounded-full border border-white/15 bg-black/60 px-4 py-1.5 text-[12px] text-white/85" onClick={(event) => event.stopPropagation()}>
                {image.attribution}
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
