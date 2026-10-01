/** Client-safe shapes for Unsplash photo search. No keys, no raw API objects. */

export interface UnsplashPhotoDto {
  id: string;
  /** Alt text, or the description, or a generic line. */
  alt: string;
  description: string | null;
  width: number;
  height: number;
  /** Dominant colour, for the placeholder while the picture loads. */
  color: string;
  urls: { thumb: string; small: string; regular: string };
  /** The photo's page on Unsplash, with the required referral parameters. */
  pageUrl: string;
  photographer: { name: string; username: string; profileUrl: string };
}

export interface UnsplashSearchDto {
  query: string;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  results: UnsplashPhotoDto[];
}

export const UNSPLASH_UTM = "utm_source=gixxer_ai&utm_medium=referral";
export const UNSPLASH_HOME = `https://unsplash.com/?${UNSPLASH_UTM}`;
