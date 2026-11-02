import { useMemo } from 'react';
import { isSafeMode } from '../game/safeMode';

const COULEURS = ['#f2c14e', '#ff7a59', '#5ad1ff', '#8be28b', '#ff8ad8', '#ffffff'];

/**
 * Pluie de confettis (victoire). Purement decorative : DOM + animation CSS,
 * ignoree en mode compatibilite ; `prefers-reduced-motion` la masque (index.css).
 */
export function Confetti({ count = 46 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.4 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 160,
        spin: 360 + Math.random() * 720,
        w: 6 + Math.random() * 6,
        color: COULEURS[i % COULEURS.length]
      })),
    [count]
  );
  if (isSafeMode()) return null;
  return (
    <div className="confetti" data-testid="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.w * 1.6,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
