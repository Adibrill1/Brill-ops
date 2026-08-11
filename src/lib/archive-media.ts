import curationSource from '../../data/archive-imports/the-big-bang-2020/media-curation.json';
import type { MediaItem } from '@/types/database';

export type ArchiveMediaCategory = 'highlights' | 'community' | 'videos' | 'records';

interface MediaDecision {
  source_path: string;
  publish: boolean;
  category?: 'community_archive' | 'videos' | 'source_records';
  featured?: boolean;
  featured_order?: number | null;
  caption?: string | null;
}

interface MediaCuration {
  hero_source_path: string;
  summary: {
    catalogued_source_rows: number;
    published_unique_assets: number;
    excluded_unrelated_assets: number;
    excluded_exact_duplicates: number;
    featured_assets: number;
    published_bytes: number;
  };
  decisions: MediaDecision[];
}

const curation = curationSource as MediaCuration;
const decisionsByPath = new Map(curation.decisions.map((decision) => [decision.source_path, decision]));

export const archiveMediaSummary = curation.summary;

export const archiveMediaCategories: Array<{
  value: ArchiveMediaCategory;
  label: string;
  description: string;
}> = [
  {
    value: 'highlights',
    label: 'Highlights',
    description: 'A reviewed selection that tells the operation’s story.',
  },
  {
    value: 'community',
    label: 'Stars & photos',
    description: 'The public community archive of link stars, maps and participant photos.',
  },
  {
    value: 'videos',
    label: 'Videos',
    description: 'Finished campaign edits and original participant footage.',
  },
  {
    value: 'records',
    label: 'Source records',
    description: 'Original statistics screenshots and the row-level CSV.',
  },
];

export interface CuratedMediaItem extends MediaItem {
  publicUrl: string;
  displayCaption: string | null;
  featured: boolean;
  featuredOrder: number | null;
  publicCategory: NonNullable<MediaDecision['category']>;
}

export function normalizeArchiveMediaCategory(value: string | undefined): ArchiveMediaCategory {
  return archiveMediaCategories.some((category) => category.value === value)
    ? value as ArchiveMediaCategory
    : 'highlights';
}

export function publicMediaUrl(item: MediaItem): string | null {
  if (item.external_url) return item.external_url;
  if (!item.is_uploaded || !item.storage_bucket || !item.storage_path) return null;
  if (/^https?:\/\//.test(item.storage_path)) return item.storage_path;

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!projectUrl) return null;
  const bucket = encodeURIComponent(item.storage_bucket);
  const objectPath = item.storage_path.split('/').map(encodeURIComponent).join('/');
  return `${projectUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export function curatedArchiveMedia(items: MediaItem[]): CuratedMediaItem[] {
  return items.flatMap((item) => {
    if (!item.source_path) return [];
    const decision = decisionsByPath.get(item.source_path);
    const publicUrl = publicMediaUrl(item);
    if (!decision?.publish || !decision.category || !publicUrl) return [];
    return [{
      ...item,
      publicUrl,
      displayCaption: decision.caption ?? item.caption,
      featured: decision.featured === true,
      featuredOrder: decision.featured_order ?? null,
      publicCategory: decision.category,
    }];
  });
}

export function mediaForCategory(
  items: CuratedMediaItem[],
  category: ArchiveMediaCategory,
): CuratedMediaItem[] {
  const filtered = category === 'highlights'
    ? items.filter((item) => item.featured)
    : items.filter((item) => item.publicCategory === (
      category === 'community' ? 'community_archive'
      : category === 'records' ? 'source_records'
      : 'videos'
    ));

  return filtered.sort((left, right) => {
    if (category === 'highlights') {
      return (left.featuredOrder ?? Number.MAX_SAFE_INTEGER)
        - (right.featuredOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return (left.captured_at ?? '').localeCompare(right.captured_at ?? '')
      || (left.source_path ?? '').localeCompare(right.source_path ?? '');
  });
}

export function archiveMediaFilename(item: MediaItem): string {
  return item.source_path?.split('/').pop() ?? 'Archive media';
}
