export interface Lens {
  id: string;
  name: string;
  imagePath: string;
  price: number; // CLP
  width: number; // px (ancho real de la imagen PNG, para escalado)
  height: number; // px
}