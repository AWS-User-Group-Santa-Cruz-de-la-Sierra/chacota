// Static image imports, resolved by Next.js (StaticImageData).
declare module '*.svg' {
  const image: { src: string; width: number; height: number };
  export default image;
}
