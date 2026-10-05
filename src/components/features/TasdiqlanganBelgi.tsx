interface TasdiqlanganBelgiProps {
  size?: number;
  className?: string;
}

export default function TasdiqlanganBelgi({ size, className }: TasdiqlanganBelgiProps) {
  const dimension = size || 16;
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label="Tasdiqlangan profil"
      style={{ display: 'inline-block', verticalAlign: 'text-top' }}
    >
      <title>Google va Telegram ulangan profil</title>
      {/* Scalloped rosette */}
      <path
        d="M12 2L13.8 3.8L16.3 3.2L16.9 5.7L19.2 6.8L18.4 9.2L19.9 11.3L18.2 13.3L18.7 15.9L16.2 16.3L14.8 18.5L12.5 17.4L10 18.2L8.8 15.9L6.3 15.7L6.9 13.2L5.2 11.3L6.7 9.2L5.9 6.8L8.2 5.7L8.8 3.2L11.2 3.8L12 2Z"
        fill="#C99A3B"
        stroke="#A67E2A"
        strokeWidth="0.5"
      />
      {/* Inner circle */}
      <circle cx="12" cy="11" r="6.5" fill="#FBF1D9" />
      {/* Checkmark */}
      <path
        d="M9 11L11.2 13.2L15 9.5"
        stroke="#8A5F0A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
