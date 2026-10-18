// Fichier généré : ne pas modifier.
// Source : docs/charte/assets/Icones/*.svg. Générateur : packages/ui/scripts/generate-assets.ts.
// Pour changer une icône, modifiez la charte, puis lancez `corepack pnpm --filter @lignee/ui assets`.

/** Une forme d’icône : au trait (`stroke.icone`), pleine, ou pleine et percée (pair-impair). */
export interface IconShape {
  readonly d: string;
  readonly mode: 'stroke' | 'fill';
  readonly evenOdd?: true;
  /** Trait plus fin que `stroke.icone` pour un détail du dessin ; absent : `stroke.icone`. */
  readonly strokeWidth?: number;
}

/** Jeu d’icônes Lignée : grille de 24, trait de 2, extrémités arrondies (05-iconographie.md). */
export const iconShapes = {
  ajouter: [{ d: 'M4.5 12L19.5 12M12 4.5L12 19.5', mode: 'stroke' }],
  alerte: [
    { d: 'M12 3.18L21.66 19.98L2.34 19.98Z', mode: 'stroke' },
    { d: 'M12 9.9L12 14.1', mode: 'stroke' },
    { d: 'M13.05 17.04A1.05 1.05 0 0 1 10.95 17.04A1.05 1.05 0 0 1 13.05 17.04', mode: 'fill' },
  ],
  anniversaire: [
    {
      d: 'M4.52 11.56L19.48 11.56A1.76 1.76 0 0 1 21.24 13.32L21.24 19.92A1.76 1.76 0 0 1 19.48 21.68L4.52 21.68A1.76 1.76 0 0 1 2.76 19.92L2.76 13.32A1.76 1.76 0 0 1 4.52 11.56Z',
      mode: 'stroke',
    },
    {
      d: 'M2.76 15.96Q7.38 18.6 12 15.96Q16.62 18.6 21.24 15.96',
      mode: 'stroke',
      strokeWidth: 1.8,
    },
    { d: 'M12 11.56L12 6.72', mode: 'stroke' },
    { d: 'M13.54 4.08A1.54 2.42 0 0 1 10.46 4.08A1.54 2.42 0 0 1 13.54 4.08', mode: 'fill' },
  ],
  appareilPhoto: [
    {
      d: 'M4.52 6.72L19.48 6.72A2.64 2.64 0 0 1 22.12 9.36L22.12 17.72A2.64 2.64 0 0 1 19.48 20.36L4.52 20.36A2.64 2.64 0 0 1 1.88 17.72L1.88 9.36A2.64 2.64 0 0 1 4.52 6.72Z',
      mode: 'stroke',
    },
    { d: 'M15.52 13.54A3.52 3.52 0 0 1 8.48 13.54A3.52 3.52 0 0 1 15.52 13.54', mode: 'stroke' },
    { d: 'M8.04 6.72L9.8 3.64L14.2 3.64L15.96 6.72', mode: 'stroke' },
  ],
  apresMoi: [
    {
      d: 'M5.7 3.18L18.3 3.18M5.7 20.82L18.3 20.82M6.96 3.18L17.04 20.82M17.04 3.18L6.96 20.82',
      mode: 'stroke',
    },
  ],
  calendrier: [
    {
      d: 'M5.7 5.28L18.3 5.28A2.52 2.52 0 0 1 20.82 7.8L20.82 18.72A2.52 2.52 0 0 1 18.3 21.24L5.7 21.24A2.52 2.52 0 0 1 3.18 18.72L3.18 7.8A2.52 2.52 0 0 1 5.7 5.28Z',
      mode: 'stroke',
    },
    { d: 'M3.18 10.32L20.82 10.32M7.8 2.34L7.8 7.38M16.2 2.34L16.2 7.38', mode: 'stroke' },
  ],
  carte: [
    {
      d: 'M3.18 5.7L9.06 3.6L14.94 5.7L20.82 3.6L20.82 18.3L14.94 20.4L9.06 18.3L3.18 20.4Z',
      mode: 'stroke',
    },
    { d: 'M9.06 3.6L9.06 18.3M14.94 5.7L14.94 20.4', mode: 'stroke' },
  ],
  document: [
    { d: 'M4.08 1.88L14.64 1.88L19.92 7.16L19.92 22.12L4.08 22.12Z', mode: 'stroke' },
    { d: 'M8.04 12L15.96 12M8.04 16.05L14.85 16.05', mode: 'stroke', strokeWidth: 1.8 },
  ],
  envoyer: [{ d: 'M3.6 11L21 4L14 21L11 13Z', mode: 'stroke' }],
  exporter: [
    { d: 'M3.6 14.94L3.6 20.4L20.4 20.4L20.4 14.94', mode: 'stroke' },
    { d: 'M12 2.76L12 15.36M8.43 11.79L12 15.36L15.57 11.79', mode: 'stroke' },
  ],
  famille: [
    { d: 'M11.93 8.22A3.57 3.57 0 0 1 4.79 8.22A3.57 3.57 0 0 1 11.93 8.22', mode: 'stroke' },
    { d: 'M1.85 19.15A6.72 6.72 0 0 1 14.87 19.15', mode: 'stroke' },
    { d: 'M19.07 9.48A2.73 2.73 0 0 1 13.61 9.48A2.73 2.73 0 0 1 19.07 9.48', mode: 'stroke' },
    { d: 'M12.27 18.11A5.04 5.04 0 0 1 21.55 18.84', mode: 'stroke' },
  ],
  fermer: [{ d: 'M6.24 6.24L17.76 17.76M17.76 6.24L6.24 17.76', mode: 'stroke' }],
  info: [
    { d: 'M20.82 12A8.82 8.82 0 0 1 3.18 12A8.82 8.82 0 0 1 20.82 12', mode: 'stroke' },
    { d: 'M12 11.58L12 16.2', mode: 'stroke' },
    { d: 'M13.05 8.01A1.05 1.05 0 0 1 10.95 8.01A1.05 1.05 0 0 1 13.05 8.01', mode: 'fill' },
  ],
  inviter: [
    { d: 'M13.76 8.48A3.96 3.96 0 0 1 5.84 8.48A3.96 3.96 0 0 1 13.76 8.48', mode: 'stroke' },
    { d: 'M2.69 19.37A7.48 7.48 0 0 1 16.91 19.37', mode: 'stroke' },
    { d: 'M16.18 11.56L22.78 11.56M19.48 8.26L19.48 14.86', mode: 'stroke' },
  ],
  langues: [
    { d: 'M21.66 12A9.66 9.66 0 0 1 2.34 12A9.66 9.66 0 0 1 21.66 12', mode: 'stroke' },
    { d: 'M16.14 12A4.14 9.66 0 0 1 7.86 12A4.14 9.66 0 0 1 16.14 12', mode: 'stroke' },
    { d: 'M2.34 12L21.66 12', mode: 'stroke' },
  ],
  lecture: [{ d: 'M6.6 4.8L19.56 12L6.6 19.2Z', mode: 'fill' }],
  lieu: [
    {
      d: 'M6.8 11.78A6.16 6.16 0 1 1 17.2 11.78L12 22.12Z M14.2 8.48A2.2 2.2 0 0 1 9.8 8.48A2.2 2.2 0 0 1 14.2 8.48',
      mode: 'fill',
      evenOdd: true,
    },
  ],
  memoire: [
    {
      d: 'M12 5.6Q7.6 3.6 2 4.8L2 19.2Q7.6 18 12 20Q16.4 18 22 19.2L22 4.8Q16.4 3.6 12 5.6L12 20',
      mode: 'stroke',
    },
  ],
  message: [
    {
      d: 'M6.12 4.02L17.88 4.02A4.2 4.2 0 0 1 22.08 8.22L22.08 13.68A4.2 4.2 0 0 1 17.88 17.88L6.12 17.88A4.2 4.2 0 0 1 1.92 13.68L1.92 8.22A4.2 4.2 0 0 1 6.12 4.02Z',
      mode: 'stroke',
    },
    { d: 'M7.8 17.88L5.7 22.5L12 17.88', mode: 'stroke' },
  ],
  micro: [
    {
      d: 'M12 1L12 1A4.4 4.4 0 0 1 16.4 5.4L16.4 10.24A4.4 4.4 0 0 1 12 14.64L12 14.64A4.4 4.4 0 0 1 7.6 10.24L7.6 5.4A4.4 4.4 0 0 1 12 1Z',
      mode: 'fill',
    },
    { d: 'M19.44 10.99A7.48 7.48 0 0 1 4.56 10.99', mode: 'stroke' },
    { d: 'M12 17.72L12 22.12', mode: 'stroke' },
  ],
  modifier: [
    { d: 'M4 20L5.2 14.8L16 4L20 8L9.2 18.8Z', mode: 'stroke' },
    { d: 'M13.2 6.8L17.2 10.8', mode: 'stroke' },
  ],
  notifications: [
    {
      d: 'M2.64 17.72Q4.2 14.08 4.2 9.92C4.2 1.6 19.8 1.6 19.8 9.92Q19.8 14.08 21.36 17.72Z',
      mode: 'stroke',
    },
    { d: 'M9.4 20.84Q12 23.44 14.6 20.84', mode: 'stroke' },
  ],
  partager: [
    { d: 'M8.22 10.32L4.44 10.32L4.44 20.82L19.56 20.82L19.56 10.32L15.78 10.32', mode: 'stroke' },
    { d: 'M12 15.36L12 2.76M8.64 6.12L12 2.76L15.36 6.12', mode: 'stroke' },
  ],
  pause: [
    {
      d: 'M8.22 5.16L8.22 5.16A1.98 1.98 0 0 1 10.2 7.14L10.2 16.86A1.98 1.98 0 0 1 8.22 18.84L8.22 18.84A1.98 1.98 0 0 1 6.24 16.86L6.24 7.14A1.98 1.98 0 0 1 8.22 5.16Z',
      mode: 'fill',
    },
    {
      d: 'M15.78 5.16L15.78 5.16A1.98 1.98 0 0 1 17.76 7.14L17.76 16.86A1.98 1.98 0 0 1 15.78 18.84L15.78 18.84A1.98 1.98 0 0 1 13.8 16.86L13.8 7.14A1.98 1.98 0 0 1 15.78 5.16Z',
      mode: 'fill',
    },
  ],
  personne: [
    { d: 'M15.99 8.64A3.99 3.99 0 0 1 8.01 8.64A3.99 3.99 0 0 1 15.99 8.64', mode: 'stroke' },
    { d: 'M4.81 19.32A7.56 7.56 0 0 1 19.19 19.32', mode: 'stroke' },
  ],
  photo: [
    {
      d: 'M4.52 4.08L19.48 4.08A2.64 2.64 0 0 1 22.12 6.72L22.12 17.28A2.64 2.64 0 0 1 19.48 19.92L4.52 19.92A2.64 2.64 0 0 1 1.88 17.28L1.88 6.72A2.64 2.64 0 0 1 4.52 4.08Z',
      mode: 'stroke',
    },
    {
      d: 'M4.08 16.84L10.24 10.68L14.64 14.64L16.84 12.44L20.36 16.84',
      mode: 'stroke',
      strokeWidth: 1.8,
    },
    { d: 'M17.94 8.48A1.54 1.54 0 0 1 14.86 8.48A1.54 1.54 0 0 1 17.94 8.48', mode: 'fill' },
  ],
  plus: [
    { d: 'M6.86 12A1.58 1.58 0 0 1 3.71 12A1.58 1.58 0 0 1 6.86 12', mode: 'fill' },
    { d: 'M13.58 12A1.58 1.58 0 0 1 10.43 12A1.58 1.58 0 0 1 13.58 12', mode: 'fill' },
    { d: 'M20.29 12A1.58 1.58 0 0 1 17.15 12A1.58 1.58 0 0 1 20.29 12', mode: 'fill' },
  ],
  prive: [
    {
      d: 'M6 11.4L18 11.4A2.4 2.4 0 0 1 20.4 13.8L20.4 21.4A2.4 2.4 0 0 1 18 23.8L6 23.8A2.4 2.4 0 0 1 3.6 21.4L3.6 13.8A2.4 2.4 0 0 1 6 11.4Z',
      mode: 'fill',
    },
    { d: 'M6.8 11.4L6.8 7.2L6.8 7.2A5.2 5.2 0 0 1 17.2 7.2L17.2 11.4', mode: 'stroke' },
  ],
  rechercher: [
    { d: 'M16.84 10.24A6.6 6.6 0 0 1 3.64 10.24A6.6 6.6 0 0 1 16.84 10.24', mode: 'stroke' },
    { d: 'M15.08 15.08L20.8 20.8', mode: 'stroke' },
  ],
  reglages: [
    { d: 'M3.18 6.12L20.82 6.12M3.18 12L20.82 12M3.18 17.88L20.82 17.88', mode: 'stroke' },
    { d: 'M17.46 6.12A2.1 2.1 0 0 1 13.26 6.12A2.1 2.1 0 0 1 17.46 6.12', mode: 'fill' },
    { d: 'M10.32 12A2.1 2.1 0 0 1 6.12 12A2.1 2.1 0 0 1 10.32 12', mode: 'fill' },
    { d: 'M15.36 17.88A2.1 2.1 0 0 1 11.16 17.88A2.1 2.1 0 0 1 15.36 17.88', mode: 'fill' },
  ],
  retour: [{ d: 'M15.6 4.8L8.4 12L15.6 19.2', mode: 'stroke' }],
  santePlein: [
    { d: 'M12 21.24C-1.64 12.44 1 0.56 12 7.6C23 0.56 25.64 12.44 12 21.24Z', mode: 'fill' },
  ],
  sante: [
    { d: 'M12 21.24C-1.64 12.44 1 0.56 12 7.6C23 0.56 25.64 12.44 12 21.24Z', mode: 'stroke' },
  ],
  scanner: [
    {
      d: 'M2.5 6.68L2.5 2.5L6.68 2.5M17.32 2.5L21.5 2.5L21.5 6.68M21.5 17.32L21.5 21.5L17.32 21.5M6.68 21.5L2.5 21.5L2.5 17.32M6.78 12L17.23 12',
      mode: 'stroke',
    },
  ],
  securite: [{ d: 'M12 1.44L20.8 4.96Q20.8 18.6 12 23Q3.2 18.6 3.2 4.96Z', mode: 'stroke' }],
  suivant: [{ d: 'M8.4 4.8L15.6 12L8.4 19.2', mode: 'stroke' }],
  valider: [{ d: 'M3.9 12.36L9.84 18.12L20.64 6.24', mode: 'stroke' }],
} as const satisfies Record<string, readonly IconShape[]>;

export type IconName = keyof typeof iconShapes;
