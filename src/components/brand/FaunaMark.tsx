export function FaunaMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path d="M8 5 L4 5 L4 19 L8 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M16 5 L20 5 L20 19 L16 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}
