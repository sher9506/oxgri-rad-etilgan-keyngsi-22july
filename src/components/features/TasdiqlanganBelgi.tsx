interface TasdiqlanganBelgiProps {
  size?: number;
  className?: string;
}

export default function TasdiqlanganBelgi({ size, className }: TasdiqlanganBelgiProps) {
  const dimension = size || 22;
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label="Tasdiqlangan profil"
      style={{
        display: 'inline-block',
        verticalAlign: 'text-top',
        animation: 'ff-verified-pop 500ms cubic-bezier(0.22,1,0.36,1) both',
        flexShrink: 0,
      }}
    >
      <title>Tasdiqlangan</title>
      {/* Scalloped rosette — Instagram-style 12-point wave */}
      <path
        d="M12 1.5L13.6 3.3L16 2.5L16.8 4.9L19.3 5.5L18.6 8L20.3 9.9L18.8 11.8L19.7 14.3L17.3 15.1L16.7 17.6L14.2 17.2L12.5 19L10.3 17.6L7.8 18.1L7 15.6L4.6 14.9L5.3 12.3L3.6 10.4L5.2 8.4L4.4 5.9L6.8 5.2L7.5 2.7L10 3.4L12 1.5Z"
        fill="#0095F6"
      />
      {/* Inner circle */}
      <circle cx="12" cy="10.5" r="6.8" fill="#0095F6" />
      {/* Checkmark */}
      <path
        d="M8.5 10.5L11 13L15.5 8.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <style>{`
        @keyframes ff-verified-pop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ff-verified-pop"] {
            animation: none !important;
          }
        }
      `}</style>
    </svg>
  );
}
