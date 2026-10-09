// LexionLabel — "Lexion AI" yozuvi pill ichida

interface LexionLabelProps {
  onClick: () => void;
  pulseRef: React.RefObject<HTMLDivElement>;
}

export function LexionLabel({ onClick, pulseRef }: LexionLabelProps) {
  return (
    <div className="lex-label-wrap">
      <div ref={pulseRef} className="lex-pill" onClick={onClick} role="button" tabIndex={-1} aria-hidden="true">
        <span className="lex-pill-dot" />
        <span className="lex-pill-text">Lexion AI</span>
      </div>
    </div>
  );
}
