
export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function estimateReadingTime(text: string): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function truncateText(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || '';
  return text.slice(0, maxChars).trimEnd() + '...';
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface AuthorInfo {
  id?: string;
  muallif_slug: string;
  full_name: string;
  face_photo_url: string | null;
  note: string | null;
  telegram_username?: string | null;
  phone?: string | null;
  telegram_public?: boolean;
  phone_public?: boolean;
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

export function isValidNote(note: string | null | undefined): boolean {
  return !!note && note !== 'null' && note.trim() !== '';
}

const GRADIENTS = [
  'from-blue-500 to-blue-700',
  'from-blue-600 to-cyan-500',
  'from-sky-500 to-blue-600',
  'from-blue-400 to-indigo-500',
  'from-cyan-500 to-blue-600',
  'from-blue-500 to-teal-500',
];

export function gradientForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash) + slug.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function gradientForTitle(title: string): string {
  return gradientForSlug(title.toLowerCase().replace(/\s+/g, '-'));
}
