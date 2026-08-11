import Image from 'next/image';
import Link from 'next/link';
import { FileDown, Film, Images } from 'lucide-react';
import {
  archiveMediaCategories,
  archiveMediaFilename,
  archiveMediaSummary,
  curatedArchiveMedia,
  mediaForCategory,
  normalizeArchiveMediaCategory,
  type ArchiveMediaCategory,
  type CuratedMediaItem,
} from '@/lib/archive-media';
import { formatCount } from '@/lib/format';
import type { MediaItem } from '@/types/database';

const PAGE_SIZE = 24;

export function CampaignMediaArchive({
  campaignSlug,
  items,
  selectedCategory,
  requestedPage,
  faction,
}: {
  campaignSlug: string;
  items: MediaItem[];
  selectedCategory: string | undefined;
  requestedPage: string | undefined;
  faction: string | undefined;
}) {
  const allItems = curatedArchiveMedia(items);
  if (allItems.length === 0) return null;

  const category = normalizeArchiveMediaCategory(selectedCategory);
  const categoryItems = mediaForCategory(allItems, category);
  const totalPages = Math.max(1, Math.ceil(categoryItems.length / PAGE_SIZE));
  const parsedPage = Number(requestedPage);
  const page = Number.isInteger(parsedPage) && parsedPage > 0
    ? Math.min(parsedPage, totalPages)
    : 1;
  const visibleItems = category === 'highlights'
    ? categoryItems
    : categoryItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = archiveMediaCategories.find((item) => item.value === category)!;

  const countFor = (value: ArchiveMediaCategory) => mediaForCategory(allItems, value).length;
  const hrefFor = (value: ArchiveMediaCategory, nextPage = 1) => {
    const params = new URLSearchParams();
    if (faction) params.set('faction', faction);
    if (value !== 'highlights') params.set('media', value);
    if (nextPage > 1) params.set('mediaPage', String(nextPage));
    const query = params.toString();
    return `/archive/${campaignSlug}${query ? `?${query}` : ''}#campaign-media`;
  };

  return (
    <section id="campaign-media" className="scroll-mt-24" aria-labelledby="campaign-media-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="campaign-media-title" className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Images className="h-5 w-5 text-ink-faint" aria-hidden /> Campaign media
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            {formatCount(archiveMediaSummary.published_unique_assets)} reviewed assets from{' '}
            {formatCount(archiveMediaSummary.catalogued_source_rows)} preserved source files.
            Unrelated camera-roll material and exact duplicates remain in the audit catalogue but
            are not published here.
          </p>
        </div>
        <p className="text-xs text-ink-faint">
          Originals preserved · images load on demand
        </p>
      </div>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Campaign media categories">
        {archiveMediaCategories.map((item) => {
          const active = item.value === category;
          return (
            <Link
              key={item.value}
              href={hrefFor(item.value)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue focus-visible:ring-offset-2 active:translate-y-px ${
                active
                  ? 'border-ink bg-ink text-white shadow-sm'
                  : 'border-slate-300 bg-white text-ink hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {item.label}
              <span className={`ml-2 text-xs ${active ? 'text-white/70' : 'text-ink-faint'}`}>
                {formatCount(countFor(item.value))}
              </span>
            </Link>
          );
        })}
      </nav>

      <p className="mt-3 text-sm text-ink-muted">{current.description}</p>

      {visibleItems.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => <MediaCard key={item.id} item={item} />)}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-muted">
          No uploaded media in this category yet.
        </p>
      )}

      {category !== 'highlights' && totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Campaign media pages">
          {page > 1 ? (
            <Link className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue" href={hrefFor(category, page - 1)}>
              Previous
            </Link>
          ) : <span />}
          <span className="text-sm text-ink-muted">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue" href={hrefFor(category, page + 1)}>
              Next
            </Link>
          ) : <span />}
        </nav>
      )}
    </section>
  );
}

function MediaCard({ item }: { item: CuratedMediaItem }) {
  const filename = archiveMediaFilename(item);
  const caption = item.displayCaption ?? (item.attributed_to ? `Contributed by ${item.attributed_to}` : null);
  const isVideo = item.mime_type?.startsWith('video/') === true;
  const isImage = item.mime_type?.startsWith('image/') === true;
  const isDataset = item.mime_type?.startsWith('text/csv') === true;

  return (
    <figure className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md focus-within:ring-2 focus-within:ring-faction-blue focus-within:ring-offset-2">
      {isImage ? (
        <a
          href={item.publicUrl}
          target="_blank"
          rel="noreferrer"
          className="relative block aspect-square cursor-zoom-in overflow-hidden bg-slate-950 focus-visible:outline-none"
          aria-label={`Open original image: ${caption ?? filename}`}
        >
          <Image
            src={item.publicUrl}
            alt={caption ?? filename}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain transition duration-300 group-hover:scale-[1.02]"
          />
        </a>
      ) : isVideo ? (
        <div className="aspect-square bg-slate-950">
          <video
            controls
            preload="metadata"
            playsInline
            className="h-full w-full object-contain"
            aria-label={caption ?? filename}
          >
            <source src={item.publicUrl} type={item.mime_type ?? undefined} />
          </video>
        </div>
      ) : (
        <a
          href={item.publicUrl}
          target="_blank"
          rel="noreferrer"
          download={isDataset ? filename : undefined}
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 bg-slate-50 p-5 text-center text-ink transition hover:bg-slate-100 focus-visible:outline-none"
        >
          {isDataset
            ? <FileDown className="h-9 w-9 text-ink-faint" aria-hidden />
            : <Film className="h-9 w-9 text-ink-faint" aria-hidden />}
          <span className="text-sm font-medium">{isDataset ? 'Download source CSV' : 'Open archive file'}</span>
        </a>
      )}
      <figcaption className="min-h-16 px-3 py-2.5">
        <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{caption ?? filename}</p>
      </figcaption>
    </figure>
  );
}
