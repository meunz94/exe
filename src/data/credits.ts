/** 3D-asset and font attributions shown in FLOPPY → CREDITS.MD. */
export interface Credit {
  title: string;
  author: string;
  /** source page */
  url?: string;
  license: string;
}

export const MODEL_CREDITS: Credit[] = [
  {
    title: "Nintendo DS Lite",
    author: "Cianon",
    url: "https://sketchfab.com/3d-models/nintendo-ds-lite-ca529eb7208746e89b7a28fd2246659d",
    license: "CC-BY-4.0",
  },
  {
    title: "Nintendo DS",
    author: "solal.sblt",
    url: "https://sketchfab.com/3d-models/nintendo-ds-934fdde060874d5c99b40cdf1dbb37f2",
    license: "CC-BY-4.0",
  },
  {
    title: "Nintendo DS Cartridge",
    author: "Pcwer",
    url: "https://sketchfab.com/3d-models/nintendo-ds-cartridge-364e487e31fd4135b6c6941a0ffaba82",
    license: "CC-BY-4.0",
  },
  {
    title: "Commodore 64 — Computer (Full Pack)",
    author: "dark_igorek",
    url: "https://sketchfab.com/3d-models/commodore-64-computer-full-pack-1f43612fa2d54041bbe2bdff8164c2cd",
    license: "CC-BY-4.0",
  },
  {
    title: "Walkman",
    author: "Tom Seddon",
    url: "https://sketchfab.com/3d-models/walkman-1e8296b489084d6ba76b485d1c2fd37c",
    license: "CC-BY-4.0",
  },
  {
    title: "Floppy Disk",
    author: "drumdorf",
    url: "https://sketchfab.com/3d-models/floppy-disk-15444a8efd38476f9457acce300edf0c",
    license: "CC-BY-SA-4.0",
  },
  {
    title: "Papers & Envelopes",
    author: "Michael V (@bossdeff)",
    url: "https://sketchfab.com/3d-models/papers-envelopes-303f54d7a6e84aad9af3f341c2fa4ad7",
    license: "CC-BY-4.0",
  },
  {
    title: "Game Case (chip box)",
    author: "LJuan",
    url: "https://www.fab.com/listings/1d58e941-0c43-4b7b-bd26-0707b7530a0c",
    license: "Fab Standard License",
  },
];

export const FONT_CREDITS: Credit[] = [
  {
    title: "Galmuri (pixel font)",
    author: "quiple",
    url: "https://galmuri.quiple.dev",
    license: "SIL OFL 1.1",
  },
];
