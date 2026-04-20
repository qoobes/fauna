export function FaunaWordmark({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <span className={`fauna-wordmark ${className ?? ''}`} aria-label="FAUNA" style={{ fontSize: size }}>
      <span className="br" aria-hidden>[</span>
      <span>FAUNA</span>
      <span className="br" aria-hidden>]</span>
    </span>
  );
}
