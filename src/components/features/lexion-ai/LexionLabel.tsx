import type { RefObject } from 'react';
interface LexionLabelProps {
  onClick: () => void;
  pulseRef: RefObject<HTMLDivElement>;
}
export function LexionLabel({ onClick, pulseRef }: LexionLabelProps) {
  return (
    <div className="lex-label-wrap">
      <div ref={pulseRef} className="lex-pill" onClick={onClick} role="button" tabIndex={0}>
        <span className="lex-pill-dot" aria-hidden="true" />
        <span className="lex-pill-text">Lexion AI</span>
      </div>
    </div>
  );
}
