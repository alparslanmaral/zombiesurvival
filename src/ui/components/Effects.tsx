import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

/** Drifting embers and ash behind everything. Pure CSS; disabled by prefers-reduced-motion. */
export function Embers({ count = 26 }: { count?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // deterministic pseudo-random spread so renders are stable
        const r = (k: number) => {
          const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
          return v - Math.floor(v);
        };
        return {
          left: `${(r(1) * 100).toFixed(1)}%`,
          size: 1.5 + r(2) * 3,
          dur: 9 + r(3) * 14,
          delay: -r(4) * 20,
          drift: (r(5) - 0.5) * 120,
          ash: r(6) > 0.65,
        };
      }),
    [count],
  );
  return (
    <div className="embers" aria-hidden>
      {sparks.map((s, i) => (
        <span
          key={i}
          className={s.ash ? 'ash' : 'ember'}
          style={
            {
              left: s.left,
              width: s.size,
              height: s.size,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
              '--drift': `${s.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Red flash + shake when your HP drops, a soft glow when it rises. */
export function HitFlash({ hp }: { hp: number }) {
  const prev = useRef(hp);
  const [fx, setFx] = useState<{ kind: 'hit' | 'heal'; n: number } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = hp;
    if (hp === before) return;
    const kind = hp < before ? 'hit' : 'heal';
    setFx((f) => ({ kind, n: (f?.n ?? 0) + 1 }));
    if (kind === 'hit') {
      document.body.classList.remove('shake');
      void document.body.offsetWidth; // restart the animation
      document.body.classList.add('shake');
      navigator.vibrate?.(120);
    }
    const t = setTimeout(() => setFx(null), 900);
    return () => clearTimeout(t);
  }, [hp]);
  if (!fx) return null;
  return <div key={fx.n} className={`screen-flash ${fx.kind}`} aria-hidden />;
}
