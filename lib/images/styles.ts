/**
 * Style presets for the image studio. Client-safe. A preset is a prompt
 * prefix; the reader's own words follow it. Each has an example image in
 * public/styles, generated with the same model the studio uses.
 */
export interface ImageStyle {
  key: string;
  label: string;
  /** Prepended to the reader's prompt. */
  prompt: string;
  /** The subject its example image was made with. */
  example: string;
}

export const IMAGE_STYLES: readonly ImageStyle[] = [
  { key: "sketch", label: "Sketch", prompt: "loose pencil sketch on white paper, confident line work, light hatching, unfinished edges", example: "a single daisy in a glass" },
  { key: "stickers", label: "Stickers", prompt: "die-cut sticker sheet, bold black outlines, flat cheerful colours, thick white borders, playful", example: "a black cat, a potted plant and a smiling bearded man" },
  { key: "flashback", label: "'80s flashback", prompt: "1980s mall studio portrait, laser gradient backdrop, film grain, feathered hair, retro windbreaker", example: "a confident young man with sunglasses" },
  { key: "caricature", label: "Caricature", prompt: "hand-drawn caricature illustration, exaggerated expressive features, warm humour, ink and wash", example: "a cheerful hiker holding a map" },
  { key: "anime", label: "Anime", prompt: "anime illustration, clean cel shading, expressive eyes, dynamic pose, soft evening sky", example: "a young man in a white shirt pointing at the viewer" },
  { key: "underwater", label: "Underwater", prompt: "underwater photograph, shafts of sunlight, floating particles, deep blue-green water", example: "a woman's face lit from above" },
  { key: "pins", label: "Pin collection", prompt: "flat lay of glossy enamel pins on a pastel lavender board, metal edges catching light", example: "pins of a coffee cup, a tennis racket, a bowl of noodles and a cactus" },
  { key: "morning", label: "Good morning", prompt: "golden sunrise over a quiet valley, soft warm haze, gentle lens flare", example: "a cup of coffee on a wooden windowsill" },
  { key: "cinematic", label: "Cinematic", prompt: "cinematic film still, anamorphic lens flare, dramatic rim light, shallow depth of field, moody grade", example: "a lone figure on a rainy platform" },
  { key: "watercolor", label: "Watercolor", prompt: "loose watercolour painting, soft bleeding pigments, visible paper texture, white space", example: "a small harbour town at dusk" },
  { key: "isometric", label: "Isometric", prompt: "isometric 3D illustration, clean geometry, soft studio lighting, pastel palette, tiny details", example: "a cosy corner cafe" },
  { key: "neon", label: "Neon noir", prompt: "neon-lit night street, rain-slick reflections, cyberpunk palette, cinematic haze", example: "a ramen stall under signs" },
];

export function styleFor(key: string | null): ImageStyle | null {
  return key ? (IMAGE_STYLES.find((style) => style.key === key) ?? null) : null;
}

/** The prompt the model receives: the style's prefix, then the reader's words. */
export function composePrompt(style: ImageStyle | null, prompt: string): string {
  const own = prompt.trim();
  return style ? `${style.prompt}, ${own}` : own;
}

export function stylePreviewPath(style: ImageStyle): string {
  return `/styles/${style.key}.webp`;
}
