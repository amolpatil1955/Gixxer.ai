"use client";

import { ArrowUp, Download, LoaderCircle, Mic, RefreshCw, Sparkles as SparklesIcon, SlidersHorizontal, Trash2, WandSparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useVoiceInput } from "@/components/chat/use-voice-input";
import { VoiceModal } from "@/components/chat/voice-modal";
import { Alert } from "@/components/ui/alert";
import { PillTabs } from "@/components/workspace/primitives";
import { deleteImageAction } from "@/lib/images/actions";
import { composePrompt, IMAGE_STYLES, styleFor, stylePreviewPath, type ImageStyle } from "@/lib/images/styles";
import { IMAGE_SIZES, type ImageSizeKey } from "@/lib/images/validation";
import { errorMessageFrom } from "@/lib/stream/ndjson-client";
import { cn } from "@/lib/utils/cn";
import { estimateProgress, ImageGenerating, readImageEta, writeImageEta } from "./image-generating";
import { Lightbox, type LightboxImage } from "./lightbox";
import { PhotoSearch } from "./photo-search";
import { SparkleBurst } from "./sparkles";

export interface ImageDto {
  id: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model: string;
  createdAt: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

type Stage = { kind: "idle" } | { kind: "working"; width: number; height: number; startedAt: number; eta: number } | { kind: "finishing"; width: number; height: number };

/**
 * Prompt in, picture out. While the model works the placeholder holds the
 * final aspect ratio, twinkles, and counts up; when the bytes land the ring
 * completes to 100%, fades, and the image pops in.
 */
export function ImageStudio({ initialImages }: { initialImages: ImageDto[] }) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSizeKey>("landscape");
  const [seed, setSeed] = useState<number | null>(null);
  const [styleKey, setStyleKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"images" | "styles" | "photos">("images");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [landed, setLanded] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ImageDto | null>(null);
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const style = styleFor(styleKey);

  const voice = useVoiceInput((text) => {
    setPrompt((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text).slice(0, 1000));
    textarea.current?.focus();
  });

  // The progress estimate and the phase captions, while the model works.
  useEffect(() => {
    if (stage.kind !== "working") return;
    let frame = 0;
    const tick = () => {
      setProgress(estimateProgress(performance.now() - stage.startedAt, stage.eta));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  async function generate(overrides: { prompt?: string; seed?: number | null; size?: ImageSizeKey; style?: ImageStyle | null } = {}) {
    const own = (overrides.prompt ?? prompt).trim();
    const useStyle = overrides.style === undefined ? style : overrides.style;
    const usePrompt = composePrompt(useStyle, own);
    const useSize = overrides.size ?? size;
    const useSeed = overrides.seed === undefined ? seed : overrides.seed;
    if (own.length < 3 || stage.kind !== "idle") return;
    setError(null);
    setShowOptions(false);
    setTab("images");
    const dimensions = IMAGE_SIZES.find((item) => item.key === useSize) ?? IMAGE_SIZES[0];
    const startedAt = performance.now();
    setProgress(0);
    setStage({ kind: "working", width: dimensions.width, height: dimensions.height, startedAt, eta: readImageEta() });
    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: usePrompt, size: useSize, ...(useSeed !== null ? { seed: useSeed } : {}) }),
      });
      if (!response.ok) {
        setError(await errorMessageFrom(response, "The image could not be generated."));
        setStage({ kind: "idle" });
        return;
      }
      const json = (await response.json()) as { image: ImageDto };
      writeImageEta(performance.now() - startedAt);
      // Complete the ring, let it be seen, then swap in the picture.
      setStage({ kind: "finishing", width: dimensions.width, height: dimensions.height });
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 650));
      setImages((current) => [json.image, ...current]);
      setLanded(json.image.id);
      setStage({ kind: "idle" });
      window.setTimeout(() => setLanded(null), 1200);
      router.refresh();
    } catch {
      setError("The connection dropped. Please try again.");
      setStage({ kind: "idle" });
    }
  }

  function remove(image: ImageDto) {
    if (!window.confirm("Delete this image?")) return;
    startTransition(async () => {
      const result = await deleteImageAction({ imageId: image.id });
      if (result.ok) setImages((current) => current.filter((item) => item.id !== image.id));
      else setError(result.message);
    });
  }

  function chooseStyle(next: ImageStyle) {
    setStyleKey(next.key);
    setTab("images");
    textarea.current?.focus();
  }

  const busy = stage.kind !== "idle";
  const canGenerate = prompt.trim().length >= 3 && !busy;
  const sizeLabel = IMAGE_SIZES.find((item) => item.key === size) ?? IMAGE_SIZES[0];

  return (
    <div className="space-y-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
        className="raised relative mx-auto max-w-3xl rounded-[28px] px-2.5 pb-2 pt-2.5"
        aria-label="Describe a new image"
      >
        {style ? (
          <div className="mb-1 flex flex-wrap items-center gap-1.5 px-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-2.5 pr-1 text-[12px] font-medium text-accent">
              <SparklesIcon className="size-3.5" aria-hidden="true" />
              {style.label}
              <button type="button" onClick={() => setStyleKey(null)} aria-label={`Remove the ${style.label} style`} className="rounded-full p-0.5 hover:bg-accent/20">
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          </div>
        ) : null}
        <textarea
          ref={textarea}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value.slice(0, 1000))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void generate();
            }
          }}
          rows={1}
          placeholder="Describe a new image"
          aria-label="Image prompt"
          className="block max-h-40 min-h-[44px] w-full resize-none bg-transparent px-2.5 py-2 text-[15.5px] leading-relaxed text-ink-50 outline-none placeholder:text-ink-400"
        />
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowOptions((value) => !value)}
            aria-expanded={showOptions}
            aria-controls="image-options"
            aria-label="Image options"
            title="Size and seed"
            className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-ink-200 transition-colors hover:bg-ink-700 hover:text-ink-50", showOptions && "bg-ink-700 text-ink-50")}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            <span className="font-mono text-[11px]">{sizeLabel.label}</span>
            {seed !== null ? <span className="font-mono text-[11px] text-ink-400">· seed {seed}</span> : null}
          </button>
          <div className="ml-auto flex items-center gap-1">
            {voice.supported ? (
              <button type="button" disabled={busy} onClick={() => void voice.start()} aria-label="Dictate" title="Dictate" className="flex size-9 items-center justify-center rounded-full text-ink-200 transition-colors hover:bg-ink-700 hover:text-ink-50 disabled:opacity-40">
                <Mic className="size-4.5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!canGenerate}
              aria-label="Generate"
              aria-busy={busy || undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-[background-color,transform] active:scale-95",
                canGenerate ? "bg-accent text-on-accent hover:bg-accent-hover" : "bg-ink-600 text-ink-300",
              )}
            >
              {busy ? <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
        {showOptions ? (
          <div id="image-options" className="mt-2 flex flex-wrap items-center gap-3 border-t border-line px-2 pb-1 pt-3">
            <div role="radiogroup" aria-label="Size" className="flex gap-1">
              {IMAGE_SIZES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={size === option.key}
                  aria-label={`${option.key === "landscape" ? "Landscape" : option.key === "portrait" ? "Portrait" : "Square"}, ${option.label}`}
                  onClick={() => setSize(option.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
                    size === option.key ? "border-transparent bg-ink-50 text-ink-950" : "border-line text-ink-300 hover:border-ink-400",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 font-mono text-[11px] text-ink-400">
              Seed
              <input
                type="number"
                min={0}
                max={2147483647}
                value={seed ?? ""}
                placeholder="random"
                onChange={(event) => setSeed(event.target.value === "" ? null : Number(event.target.value))}
                className="w-28 rounded-full border border-line bg-ink-950/60 px-3 py-1 text-[12px] text-ink-100 outline-none focus:border-ink-300"
              />
            </label>
          </div>
        ) : null}
        <VoiceModal state={voice.state} error={voice.error} seconds={voice.seconds} maxSeconds={voice.maxSeconds} onStop={voice.stop} onRetry={() => void voice.start()} onCancel={voice.cancel} />
      </form>

      {error ? <Alert className="mx-auto max-w-3xl">{error}</Alert> : null}

      <div className="flex items-center justify-between gap-3">
        <PillTabs
          value={tab}
          onChange={setTab}
          label="Image views"
          options={[
            { value: "images", label: "Your images", count: images.length },
            { value: "styles", label: "Styles" },
            { value: "photos", label: "Photos" },
          ]}
        />
      </div>

      {tab === "photos" ? (
        <PhotoSearch />
      ) : tab === "styles" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Styles">
          {IMAGE_STYLES.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => chooseStyle(item)}
                aria-pressed={styleKey === item.key}
                className={cn(
                  "group relative block aspect-square w-full overflow-hidden rounded-2xl border bg-ink-900 text-left transition-[transform,border-color] hover:-translate-y-0.5",
                  styleKey === item.key ? "border-accent" : "border-line hover:border-ink-400",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static example images in public/, sized by the grid */}
                <img src={stylePreviewPath(item)} alt={`${item.label} style example: ${item.example}`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3 text-[13.5px] font-semibold text-white">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Generated images" aria-busy={busy}>
            <AnimatePresence initial={false}>
              {stage.kind !== "idle" ? (
                <motion.li
                  key="placeholder"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="list-none"
                  data-generating={stage.kind}
                >
                  <ImageGenerating width={stage.width} height={stage.height} progress={progress} />
                </motion.li>
              ) : null}
              {images.map((image) => (
                <motion.li
                  key={image.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className={cn("group relative overflow-hidden rounded-2xl border border-line bg-ink-900", pending && "opacity-70")}
                  style={{ aspectRatio: `${image.width} / ${image.height}` }}
                >
                  <button type="button" onClick={() => setViewing(image)} className="absolute inset-0 block h-full w-full" aria-label={`Open image: ${image.prompt}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- bytes come from our own authenticated route */}
                    <img src={`/api/images/${image.id}`} alt={image.prompt} className={cn("absolute inset-0 h-full w-full object-cover", landed === image.id && "animate-pop-in")} loading="lazy" />
                  </button>
                  {landed === image.id ? <SparkleBurst seed={image.seed} /> : null}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent p-3 pt-10">
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug text-white">{image.prompt}</p>
                  </div>
                  <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <a href={`/api/images/${image.id}?download=1`} aria-label="Download" title="Download" className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80">
                      <Download className="size-3.5" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(image.prompt);
                        void generate({ prompt: image.prompt, seed: null, style: null });
                      }}
                      aria-label="Regenerate"
                      title="Regenerate with a new seed"
                      className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(image.prompt);
                        setSeed(image.seed);
                        setStyleKey(null);
                        setShowOptions(true);
                        textarea.current?.focus();
                      }}
                      aria-label="Vary"
                      title="Keeps the composition: edit the prompt, then generate"
                      className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                    >
                      <WandSparkles className="size-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => remove(image)} aria-label="Delete image" title="Delete" className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80">
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <span className="absolute left-3 top-3 rounded-md border border-white/15 bg-black/50 px-1.5 py-0.5 font-mono text-[9.5px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100">seed {image.seed}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <Lightbox
            image={viewing ? ({ src: `/api/images/${viewing.id}`, downloadHref: `/api/images/${viewing.id}?download=1`, alt: viewing.prompt, caption: viewing.prompt } satisfies LightboxImage) : null}
            onClose={() => setViewing(null)}
            onRegenerate={
              viewing
                ? () => {
                    const image = viewing;
                    setViewing(null);
                    setPrompt(image.prompt);
                    void generate({ prompt: image.prompt, seed: null, style: null });
                  }
                : undefined
            }
          />
          {images.length === 0 && !busy ? (
            <div className="rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
              <p className="text-[15px] font-medium text-ink-50">Nothing generated yet</p>
              <p className="mt-1.5 text-[13.5px] text-ink-400">Describe a picture above, or pick a style to start from.</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
