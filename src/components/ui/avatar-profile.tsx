import { useState, useEffect } from 'react';

interface AvatarProps {
  src?: string | null;
  alt: string;
  initials: string;
  /** "square" = rounded-2xl, "circle" = rounded-full */
  shape?: 'square' | 'circle';
  /** pixel size */
  size?: number;
  /** extra classes for the container */
  className?: string;
  /** gradient classes for fallback initials, e.g. "from-emerald-500 to-teal-600" */
  fallbackGradient?: string;
  /** border classes, e.g. "border-[3px] border-white shadow-lg" */
  borderClasses?: string;
}

export default function Avatar({
  src,
  alt,
  initials,
  shape = 'square',
  size = 64,
  className = '',
  fallbackGradient = 'from-emerald-500 to-teal-600',
  borderClasses = '',
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Reset when src changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [src]);

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const style = { width: size, height: size };

  return (
    <div
      className={`relative flex-shrink-0 ${shapeClass} ${borderClasses} ${className}`}
      style={style}
    >
      {src && !imgError ? (
        <>
          {!imgLoaded && (
            <div
              className={`absolute inset-0 ${shapeClass} bg-gradient-to-br ${fallbackGradient}`}
            />
          )}
          <img
            src={src}
            alt={alt}
            className={`absolute inset-0 w-full h-full ${shapeClass} object-cover transition-opacity duration-300 ${borderClasses}`}
            style={{ opacity: imgLoaded ? 1 : 0 }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        </>
      ) : (
        <div
          className={`w-full h-full ${shapeClass} bg-gradient-to-br ${fallbackGradient} flex items-center justify-center text-white font-black`}
          style={{ fontSize: size * 0.33 }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
