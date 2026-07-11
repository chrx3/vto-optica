import { useState } from 'react';
import type { Lens } from '../types/lens';

interface LensSelectorProps {
  catalog: Lens[];
  selectedId: string;
  onSelect: (lens: Lens) => void;
}

/**
 * Selector horizontal de lentes en la parte inferior.
 *
 * Cada opción muestra un thumbnail del lente con su nombre y precio.
 * El lente activo se resalta con un borde.
 */
export function LensSelector({ catalog, selectedId, onSelect }: LensSelectorProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-6 pb-4 px-2">
      <div className="flex gap-2 justify-center overflow-x-auto">
        {catalog.map((lens) => {
          const isActive = lens.id === selectedId;
          const hasError = failedImages.has(lens.id);

          return (
            <button
              key={lens.id}
              onClick={() => onSelect(lens)}
              className={`
                flex flex-col items-center gap-1 p-2 rounded-lg
                transition-all duration-150 min-w-[88px]
                ${isActive
                  ? 'bg-white/15 ring-2 ring-white/80 scale-105'
                  : 'bg-white/5 hover:bg-white/10'
                }
              `}
            >
              <div className="w-20 h-12 flex items-center justify-center">
                {hasError ? (
                  <div className="text-white/40 text-xs">Sin imagen</div>
                ) : (
                  <img
                    src={lens.imagePath}
                    alt={lens.name}
                    className="max-w-full max-h-full object-contain"
                    onError={() => {
                      setFailedImages((prev) => new Set(prev).add(lens.id));
                    }}
                  />
                )}
              </div>
              <div className="text-xs text-white/90 text-center leading-tight">
                {lens.name}
              </div>
              <div className="text-[10px] text-white/60">
                {formatPrice(lens.price)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}