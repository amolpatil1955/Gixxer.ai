"use client";

import { ArrowUp, Download, LoaderCircle, Mic, RefreshCw, SlidersHorizontal, Trash2, WandSparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useVoiceInput } from "@/components/chat/use-voice-input";
import { VoiceModal } from "@/components/chat/voice-modal";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PillTabs } from "@/components/workspace/primitives";
import { deleteImageAction } from "@/lib/images/actions";
import { composePrompt, IMAGE_STYLES, styleFor, stylePreviewPath, type ImageStyle } from "@/lib/images/styles";
import { IMAGE_SIZES, type ImageSizeKey } from "@/lib/images/validation";
import { errorMessageFrom } from "@/lib/stream/ndjson-client";
import { cn } from "@/lib/utils/cn";
import { cardAction, ImageCard } from "./image-card";
import { estimateProgress, ImageGenerating, readImageEta, writeImageEta } from "./image-generating";
import { Lightbox } from "./lightbox";
import { PhotoSearch } from "./photo-search";

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
const GRID = "grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3";

type Stage = { kind: "idle" } | { kind: "working"; startedAt: number; eta: number } | { kind: "finishing" };

/**
 * Prompt in, picture out. The gallery scrolls; the prompt box stays pinned to
 * the bottom of the page. Styles holds the style presets and the reference
 * photo search, which is separate from generation.
 */
export function ImageStudio({ initialImages }: { initialImages: ImageDto[] }) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSizeKey>("landscape");
  const [seed, setSeed] = useState<number | null>(null);
  const [styleKey, setStyleKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"images" | "styles">("images");
  const [searching, setSearching] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [landed, setLanded] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ImageDto | null>(null);
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<number[]>([]);
  const { confirm, dialog } = useConfirm();
  const style = styleFor(styleKey);

  const voice = useVoiceInput((text) => {
    setPrompt((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text).slice(0, 1000));
    textarea.current?.focus();
  });

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(160, Math.max(44, element.scrollHeight))}px`;
  }, [prompt]);

  // The progress estimate while the model works: a few updates a second, stopped as soon as it lands.
  useEffect(() => {
    if (stage.kind !== "working") return;
    const timer = window.setInterval(() => setProgress(estimateProgress(performance.now() - stage.startedAt, stage.eta)), 200);
    return () => window.clearInterval(timer);
  }, [stage]);

  // A callback, not a function re-created each render: the gallery's cards hold on to it.
  const generate = useCallback(
    async (overrides: { prompt?: string; seed?: number | null; size?: ImageSizeKey; style?: ImageStyle | null } = {}) => {
      const own = (overrides.prompt ?? prompt).trim();
      const useStyle = overrides.style === undefined ? style : overrides.style;
      const usePrompt = composePrompt(useStyle, own);
      const useSize = overrides.size ?? size;
      const useSeed = overrides.seed === undefined ? seed : overrides.seed;
      if (own.length < 3 || stage.kind !== "idle") return;
      setError(null);
      setShowOptions(false);
      setTab("images");
      const startedAt = performance.now();
      setProgress(0);
      setStage({ kind: "working", startedAt, eta: readImageEta() });
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
        setStage({ kind: "finishing" });
        setProgress(100);
        await new Promise((resolve) => timers.current.push(window.setTimeout(resolve, 600)));
        setImages((current) => [json.image, ...current]);
        setLanded(json.image.id);
        setStage({ kind: "idle" });
        timers.current.push(window.setTimeout(() => setLanded(null), 1200));
        router.refresh();
      } catch {
        setError("The connection dropped. Please try again.");
        setStage({ kind: "idle" });
      }
    },
    [prompt, style, size, seed, stage.kind, router],
  );

  async function remove(image: ImageDto) {
    if (!(await confirm({ title: "Delete this image?", body: "It is removed from your images for good." }))) return;
    startTransition(async () => {
      const result = await deleteImageAction({ imageId: image.id });
      if (result.ok) setImages((current) => current.filter((item) => item.id !== image.id));
      else setError(result.message);
    });
  }

  function chooseStyle(next: ImageStyle) {
    setStyleKey((current) => (current === next.key ? null : next.key));
    textarea.current?.focus();
  }

  const busy = stage.kind !== "idle";
  const canGenerate = prompt.trim().length >= 3 && !busy;
  const sizeLabel = IMAGE_SIZES.find((item) => item.key === size) ?? IMAGE_SIZES[0];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-5 pb-6">
        <PillTabs
          value={tab}
          onChange={setTab}
          label="Image views"
          options={[
            { value: "images", label: "Your images", count: images.length },
            { value: "styles", label: "Styles" },
          ]}
        />

        {error ? <Alert>{error}</Alert> : null}

        {tab === "styles" ? (
          <div className="space-y-5">
            <PhotoSearch onActiveChange={setSearching} />
            {searching ? null : (
              <ul className={GRID} aria-label="Styles">
                {IMAGE_STYLES.map((item) => (
                  <li key={item.key}>
                    <ImageCard
                      src={stylePreviewPath(item)}
                      alt={`${item.label} style example: ${item.example}`}
                      openLabel={`Use the ${item.label} style`}
                      onOpen={() => chooseStyle(item)}
                      selected={styleKey === item.key}
                      branded
                      caption={<span className="text-[13.5px] font-semibold">{item.label}</span>}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <ul className={GRID} aria-label="Generated images" aria-busy={busy}>
              <AnimatePresence initial={false}>
                {stage.kind !== "idle" ? (
                  <motion.li key="placeholder" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3, ease: EASE }} data-generating={stage.kind}>
                    <ImageGenerating width={4} height={3} progress={progress} />
                  </motion.li>
                ) : null}
                {images.map((image) => (
                  <motion.li key={image.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className={cn(pending && "opacity-70")}>
                    <ImageCard
                      src={`/api/images/${image.id}`}
                      alt={image.prompt}
                      openLabel={`Open image: ${image.prompt}`}
                      onOpen={() => setViewing(image)}
                      branded
                      imageClassName={landed === image.id ? "animate-pop-in" : undefined}
                      caption={<span className="line-clamp-2 font-medium">{image.prompt}</span>}
                      actions={
                        <>
                          <a href={`/api/images/${image.id}?download=1`} aria-label="Download" title="Download" className={cardAction}>
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
                            className={cardAction}
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
                            className={cardAction}
                          >
                            <WandSparkles className="size-3.5" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => void remove(image)} aria-label="Delete image" title="Delete" className={cardAction}>
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </>
                      }
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {images.length === 0 && !busy ? (
              <div className="rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
                <p className="text-[15px] font-medium text-ink-50">Nothing generated yet</p>
                <p className="mt-1.5 text-[13.5px] text-ink-400">Describe a picture below, or pick a style to start from.</p>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* The prompt box stays at the bottom of the page while the gallery scrolls. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-auto bg-linear-to-t from-ink-950 from-70% to-transparent px-4 pb-4 pt-6 sm:-mx-8 sm:px-8">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void generate();
          }}
          className="raised relative mx-auto max-w-3xl rounded-[28px] px-2.5 pb-2 pt-2.5"
          aria-label="Describe a new image"
        >
          {showOptions ? (
            <div id="image-options" className="mb-2 flex flex-wrap items-center gap-3 border-b border-line px-2 pb-3 pt-1">
              <div role="radiogroup" aria-label="Size" className="flex gap-1">
                {IMAGE_SIZES.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={size === option.key}
                    aria-label={`${option.key === "landscape" ? "Landscape" : option.key === "portrait" ? "Portrait" : "Square"}, ${option.label}`}
                    onClick={() => setSize(option.key)}
                    className={cn("rounded-full border px-3 py-1 font-mono text-[11px] transition-colors", size === option.key ? "border-transparent bg-ink-50 text-ink-950" : "border-line text-ink-300 hover:border-ink-400")}
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
          {style ? (
            <div className="mb-1 flex flex-wrap items-center gap-1.5 px-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-2.5 pr-1 text-[12px] font-medium text-accent">
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
            className="block max-h-40 min-h-11 w-full resize-none bg-transparent px-2.5 py-2 text-[15.5px] leading-relaxed text-ink-50 outline-none placeholder:text-ink-400"
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
              <button type="button" disabled={busy} onClick={() => void voice.start()} aria-label="Dictate" title="Dictate" className="flex size-9 items-center justify-center rounded-full text-ink-200 transition-colors hover:bg-ink-700 hover:text-ink-50 disabled:opacity-40">
                <Mic className="size-4.5" aria-hidden="true" />
              </button>
              <button
                type="submit"
                disabled={!canGenerate}
                aria-label="Generate"
                aria-busy={busy || undefined}
                className={cn("flex size-9 items-center justify-center rounded-full transition-[background-color,transform] active:scale-95", canGenerate ? "bg-accent text-on-accent hover:bg-accent-hover" : "bg-ink-600 text-ink-300")}
              >
                {busy ? <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4.5" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <VoiceModal state={voice.state} error={voice.error} seconds={voice.seconds} maxSeconds={voice.maxSeconds} onStop={voice.stop} onRetry={() => void voice.start()} onCancel={voice.cancel} />
        </form>
      </div>

      <Lightbox
        image={viewing ? { src: `/api/images/${viewing.id}`, downloadHref: `/api/images/${viewing.id}?download=1`, alt: viewing.prompt, caption: viewing.prompt, branded: true } : null}
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
      {dialog}
    </div>
  );
}
