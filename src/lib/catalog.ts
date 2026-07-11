import type { Lens } from '../types/lens';

/**
 * Catálogo hardcodeado para MVP.
 * Las dimensiones reales se miden al cargar la imagen (ver useLensImage hook).
 * Por defecto usamos las dimensiones del PNG original hasta que se cargue.
 */
export const CATALOG: Lens[] = [
  {
    id: 'round',
    name: 'Redondos Clásicos',
    imagePath: '/lenses/lente-01-round.png',
    price: 45990,
    width: 1024,
    height: 600,
  },
  {
    id: 'square',
    name: 'Rectangulares Modernos',
    imagePath: '/lenses/lente-02-square.png',
    price: 52990,
    width: 1024,
    height: 480,
  },
  {
    id: 'aviator',
    name: 'Aviador',
    imagePath: '/lenses/lente-03-aviator.png',
    price: 38990,
    width: 1024,
    height: 540,
  },
];

export const DEFAULT_LENS_ID = 'round';