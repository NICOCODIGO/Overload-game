"use client";

export function Lives({ lives, max = 3 }: { lives: number; max?: number }) {
  return (
    <div
      className="flex gap-1.5 text-2xl"
      aria-label={`${lives} of ${max} lives remaining`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={i < lives ? "text-coral" : "text-line opacity-50"}
        >
          {i < lives ? "♥" : "♡"}
        </span>
      ))}
    </div>
  );
}
