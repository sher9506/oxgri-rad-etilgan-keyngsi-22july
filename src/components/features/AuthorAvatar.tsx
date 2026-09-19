import { useState } from 'react';
import { getInitials } from '@/lib/blogUtils';
import type { AuthorInfo } from '@/lib/blogUtils';

interface AuthorAvatarProps {
  author: AuthorInfo | null | undefined;
  size?: string;
  rounded?: string;
  className?: string;
}

function toDisplayUrl(url: string): string {
  if (/\.(heic|heif)$/i.test(url)) {
    const renderUrl = url.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    );
    const sep = renderUrl.includes('?') ? '&' : '?';
    return `${renderUrl}${sep}format=webp&quality=90`;
  }
  return url;
}

export function AuthorAvatar({
  author,
  size = 'h-24 w-24 text-3xl',
  rounded = 'rounded-full',
  className = '',
}: AuthorAvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (author?.face_photo_url && !imgError) {
    return (
      <img
        src={toDisplayUrl(author.face_photo_url)}
        alt={author.full_name || ''}
        className={`${size} ${rounded} shrink-0 object-cover ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${size} ${rounded} flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 font-bold text-white ${className}`}
    >
      {getInitials(author?.full_name || '?')}
    </div>
  );
}
