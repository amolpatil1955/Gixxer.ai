"use client";

import { Download, RefreshCw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

export interface LightboxImage {
  src: string;
  downloadHref: string;
  alt: string;
  caption?: string;
}

interface LightboxProps {
  image: LightboxImage | null;
  onClose: () => void;
  /** Offered when the picture can be made again from its prompt. */
  onRegenerate?: () => void;
}

/** The full-screen image viewer used by the studio and by pictures made in a chat. */
export function Lightbox({ image, onClose, onRegenerate }: LightboxProps) {
  useEffect(() => {
    if (!image) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [image, onClose]);

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
          className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        >
          <div className="flex items-center gap-2 px-4 py-3" onClick={(event) => event.stopPropagation()}>
            <p className="min-w-0 flex-1 truncate text-[13px] text-white/80">{image.caption ?? image.alt}</p>
            {onRegenerate ? (
              <button type="button" onClick={onRegenerate} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 px-3.5 text-[13px] text-white hover:bg-white/10">
                <RefreshCw className="size-4" aria-hidden="true" />
                Regenerate
              </button>
            ) : null}
            <a href={image.downloadHref} download className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-white/90">
              <Download className="size-4" aria-hidden="true" />
              Download
            </a>
            <button type="button" onClick={onClose} aria-label="Close viewer" className="flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
            <motion.img
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              src={image.src}
              alt={image.alt}
              className="max-h-full max-w-full rounded-2xl object-contain shadow-float"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
