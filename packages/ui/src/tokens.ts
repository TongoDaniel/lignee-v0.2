// Fichier généré : ne pas modifier.
// Source : docs/charte/tokens.json, et packages/ui/scripts/charte-complements.ts pour le
// mouvement et le mode Aînés. Générateur : packages/ui/scripts/generate-tokens.ts.
// Pour changer une valeur, modifiez la charte, puis lancez `corepack pnpm --filter @lignee/ui tokens`.

/** Version de docs/charte/tokens.json. */
export const charteVersion = 1;

/** Palette de la charte. Un écran ne s’en sert pas directement : il passe par un thème. */
export const palette = {
  /** Bords des visuels de marque, vignettage. */
  nuit950: '#040A08',
  /** Fond de marque (film, stores, réseaux) et fond de l’app en thème Nuit. */
  nuit900: '#0A1713',
  /** Surfaces posées sur Nuit 900 (cartes du thème Nuit). */
  nuit800: '#10251D',
  /** Grands aplats de marque, couverture du livre de famille. */
  foret700: '#173A2D',
  /** Filets et séparateurs sur fond Nuit. */
  foret600: '#27463B',
  /** Filets appuyés sur fond Nuit (décoratif). */
  foret500: '#2E473D',
  /** Bordures de champs et liens de l’arbre sur fond Nuit (3:1). */
  foret400: '#4A7363',
  /** Texte désactivé sur Nuit. 5.0:1 sur Nuit 900, 4.4:1 sur Nuit 800 : jamais pour une information. */
  mousse500: '#6F8C7F',
  /** Texte secondaire sur Nuit (9.2:1). */
  brume300: '#A9BCB2',
  /** Texte et logotype sur Nuit (15.6:1). */
  creme50: '#F3ECE0',
  /** Mots en valeur sur Nuit (citations, signature). */
  or300: '#FFE3A6',
  /** Le doré de marque : symbole, action principale sur Nuit. Jamais sur fond clair (1.6:1). */
  or500: '#F2B84B',
  /** Ombre du doré dans les visuels de marque. Pas pour du texte. */
  or700: '#C98A22',
  /** Accent vert sur Nuit : succès, avatars verts du thème Nuit. */
  sauge300: '#A9D18E',
  /** Santé sur Nuit. */
  corail400: '#F2876B',
  /** Mémoire et voix sur Nuit. */
  lagon400: '#62C6B8',
  /** Parenté sur Nuit. */
  lilas300: '#B9ABEA',
  /** Documents sur Nuit. */
  ciel300: '#93BDEB',
  /** Avatars « terre » sur Nuit. */
  terre300: '#D9B48A',
  /** Erreurs sur Nuit. */
  rouge300: '#FFB4AB',
  /** Fond des écrans (thème Jour). */
  gris50: '#EEF2F0',
  /** Cartes, feuilles, barre d’onglets (thème Jour). */
  blanc: '#FFFFFF',
  /** Séparateurs (thème Jour), décoratif. */
  gris200: '#DCE3DF',
  /** Contours de cartes, piste d’interrupteur éteint (décoratif, 1.5:1). */
  gris300: '#C9D3CE',
  /** Bordures de champs et liens de l’arbre (3:1 sur blanc et Gris 50). */
  gris500: '#789185',
  /** Texte d’exemple dans un champ, éléments désactivés. 2.6:1 : jamais pour une information. */
  gris400: '#97A39D',
  /** Texte secondaire (5.0:1 sur Gris 50). */
  gris600: '#5C6A64',
  /** Texte principal (14.7:1 sur Gris 50). */
  encre900: '#15211D',
  /** Le vert Lignée : action principale (thème Jour), fond de l’icône d’app. */
  vert700: '#1E5A48',
  /** Fond teinté vert. */
  vert100: '#DCEBE4',
  /** Fond teinté vert (Nuit). */
  vert950: '#1C3A2C',
  /** Or sur fond clair pour icônes et grands textes (3.8:1). */
  or800: '#A86E0F',
  /** Or pour du texte sur fond clair (4.6:1). */
  or900: '#94610D',
  /** Fond teinté or (Jour). */
  or100: '#FBEFD2',
  /** Fond teinté or (Nuit). */
  or950: '#3A2D12',
  /** Santé : icônes, pastilles, grands textes (Jour). */
  corail600: '#C4513A',
  /** Santé : texte (Jour, 4.6:1). */
  corail700: '#AB4733',
  /** Fond teinté santé (Jour). */
  corail100: '#FBE2DA',
  /** Fond teinté santé (Nuit). */
  corail950: '#3D211A',
  /** Mémoire et voix : icônes (Jour). */
  lagon600: '#1F8274',
  /** Mémoire et voix : texte (Jour, 4.6:1). */
  lagon700: '#1C7468',
  /** Fond teinté mémoire (Jour). */
  lagon100: '#D6EFEA',
  /** Fond teinté mémoire (Nuit). */
  lagon950: '#123631',
  /** Parenté et propositions (Jour, 4.9:1 sur son fond). */
  lilas600: '#66579A',
  /** Fond teinté parenté (Jour). */
  lilas100: '#E8E3F4',
  /** Fond teinté parenté (Nuit). */
  lilas950: '#28233F',
  /** Documents et médias (Jour, 4.8:1 sur son fond). */
  ciel600: '#386796',
  /** Fond teinté documents (Jour). */
  ciel100: '#DDE9F6',
  /** Fond teinté documents (Nuit). */
  ciel950: '#162C42',
  /** Avatars « terre » (Jour, 5.2:1 sur son fond). */
  terre700: '#7A5A35',
  /** Fond d’avatar « terre » (Jour). */
  terre100: '#F3E9DC',
  /** Fond d’avatar « terre » (Nuit). */
  terre950: '#33281B',
  /** Erreurs (Jour, 6.5:1 sur Gris 50). */
  rouge700: '#A3261D',
  /** Fond d’erreur (Jour). */
  rouge100: '#FCE4E2',
  /** Fond d’erreur (Nuit). */
  rouge950: '#45160F',
  /** Papier d’archive : fiches recettes, lettres, actes scannés. */
  papier200: '#EADFC6',
  /** Ombre du papier d’archive. */
  papier300: '#DCCDAA',
  /** Encre sépia des archives. */
  sepia600: '#8A6A44',
  /** Encre bleue manuscrite des archives. */
  encreBleue700: '#34456A',
} as const;
export type PaletteColor = keyof typeof palette;

/** Thèmes de couleurs : Jour (interface par défaut) et Nuit. */
export type SchemeName = 'jour' | 'nuit';
export const schemeNames: readonly SchemeName[] = ['jour', 'nuit'];

/** Couleurs sémantiques, communes aux deux thèmes. */
export type ColorRole =
  | 'fond'
  | 'fondCarte'
  | 'texte'
  | 'texteSecondaire'
  | 'texteDiscret'
  | 'filet'
  | 'filetFort'
  | 'bordureChamp'
  | 'lienArbre'
  | 'action'
  | 'surAction'
  | 'actionDouce'
  | 'focus'
  | 'succes'
  | 'fete'
  | 'feteTexte'
  | 'feteDouce'
  | 'feteForte'
  | 'surFete'
  | 'chemin'
  | 'sante'
  | 'santeTexte'
  | 'santeDouce'
  | 'memoire'
  | 'memoireTexte'
  | 'memoireDouce'
  | 'parente'
  | 'parenteDouce'
  | 'documents'
  | 'documentsDouce'
  | 'erreur'
  | 'erreurDouce'
  | 'notification'
  | 'surNotification'
  | 'personneVert'
  | 'personneVertFond'
  | 'personneOr'
  | 'personneOrFond'
  | 'personneLagon'
  | 'personneLagonFond'
  | 'personneLilas'
  | 'personneLilasFond'
  | 'personneCiel'
  | 'personneCielFond'
  | 'personneTerre'
  | 'personneTerreFond'
  | 'voile';
export const colorRoles: readonly ColorRole[] = [
  'fond',
  'fondCarte',
  'texte',
  'texteSecondaire',
  'texteDiscret',
  'filet',
  'filetFort',
  'bordureChamp',
  'lienArbre',
  'action',
  'surAction',
  'actionDouce',
  'focus',
  'succes',
  'fete',
  'feteTexte',
  'feteDouce',
  'feteForte',
  'surFete',
  'chemin',
  'sante',
  'santeTexte',
  'santeDouce',
  'memoire',
  'memoireTexte',
  'memoireDouce',
  'parente',
  'parenteDouce',
  'documents',
  'documentsDouce',
  'erreur',
  'erreurDouce',
  'notification',
  'surNotification',
  'personneVert',
  'personneVertFond',
  'personneOr',
  'personneOrFond',
  'personneLagon',
  'personneLagonFond',
  'personneLilas',
  'personneLilasFond',
  'personneCiel',
  'personneCielFond',
  'personneTerre',
  'personneTerreFond',
  'voile',
];
export type ThemeColors = { readonly [K in ColorRole]: string };

export const themes: { readonly [S in SchemeName]: ThemeColors } = {
  jour: {
    /** Fond des écrans. */
    fond: '#EEF2F0',
    /** Cartes, feuilles, barre d’onglets, champs. */
    fondCarte: '#FFFFFF',
    /** Texte principal, sur `fond` et `fond-carte`. */
    texte: '#15211D',
    /** Sous-titres, métadonnées, onglets inactifs, sur `fond` et `fond-carte`. */
    texteSecondaire: '#5C6A64',
    /** Texte d’exemple dans un champ, état désactivé. Contraste insuffisant pour une information (2.6:1 en Jour). */
    texteDiscret: '#97A39D',
    /** Séparateurs de listes (décoratif). */
    filet: '#DCE3DF',
    /** Contours de cartes, piste d’interrupteur éteint (décoratif). */
    filetFort: '#C9D3CE',
    /** Contour des champs et des cases (3:1 sur `fond` et `fond-carte`). */
    bordureChamp: '#789185',
    /** Traits qui relient les personnes dans l’arbre (3:1 sur `fond`). */
    lienArbre: '#789185',
    /** Bouton principal, onglet actif, liens. Une seule action principale par écran. */
    action: '#1E5A48',
    /** Texte et icônes posés sur `action` (8.0:1 en Jour, 10.3:1 en Nuit). */
    surAction: '#FFFFFF',
    /** Fond teinté d’un élément sélectionné. */
    actionDouce: '#DCEBE4',
    /** Anneau de focus clavier : 2 px de `fond`, puis 2 px de `focus` (7:1 au moins). */
    focus: '#1E5A48',
    /** Confirmation, étape faite, toujours avec l’icône valider. */
    succes: '#1E5A48',
    /** Lien et célébration (anniversaires, « vous », chemin de parenté) : icônes et grands textes. */
    fete: '#A86E0F',
    /** Texte doré sur `fond`, `fond-carte` et `fete-douce`. */
    feteTexte: '#94610D',
    /** Fond teinté or. */
    feteDouce: '#FBEFD2',
    /** Fond du bouton de célébration ; son texte est `sur-fete`. */
    feteForte: '#F2B84B',
    /** Texte sur `fete-forte` (9.3:1 en Jour, 13:1 en Nuit). */
    surFete: '#0A1713',
    /** Trait du chemin de parenté dans l’arbre (3.8:1 en Jour). */
    chemin: '#A86E0F',
    /** Santé uniquement : icône cœur, pastilles, calque santé. */
    sante: '#C4513A',
    /** Texte santé sur `fond`, `fond-carte` et `sante-douce`. */
    santeTexte: '#AB4733',
    /** Fond teinté santé. */
    santeDouce: '#FBE2DA',
    /** Mémoire et voix : récits, transcriptions, capsule. */
    memoire: '#1F8274',
    /** Texte mémoire sur `fond`, `fond-carte` et `memoire-douce`. */
    memoireTexte: '#1C7468',
    /** Fond teinté mémoire. */
    memoireDouce: '#D6EFEA',
    /** Liens de parenté (« Sœur d’Odette ») et propositions à valider ; texte et icônes. */
    parente: '#66579A',
    /** Fond teinté parenté. */
    parenteDouce: '#E8E3F4',
    /** Actes, photos, fichiers ; texte et icônes. */
    documents: '#386796',
    /** Fond teinté documents. */
    documentsDouce: '#DDE9F6',
    /** Erreurs et actions destructrices, toujours avec l’icône alerte et un texte. */
    erreur: '#A3261D',
    /** Fond d’un message d’erreur. */
    erreurDouce: '#FCE4E2',
    /** Fond des toasts (pilule sombre en Jour, claire en Nuit). */
    notification: '#15211D',
    /** Texte des toasts. */
    surNotification: '#FFFFFF',
    /** Initiales d’un avatar vert. */
    personneVert: '#1E5A48',
    /** Fond d’un avatar vert. */
    personneVertFond: '#DCEBE4',
    /** Initiales d’un avatar or. */
    personneOr: '#94610D',
    /** Fond d’un avatar or. */
    personneOrFond: '#FBEFD2',
    /** Initiales d’un avatar lagon. */
    personneLagon: '#1C7468',
    /** Fond d’un avatar lagon. */
    personneLagonFond: '#D6EFEA',
    /** Initiales d’un avatar lilas. */
    personneLilas: '#66579A',
    /** Fond d’un avatar lilas. */
    personneLilasFond: '#E8E3F4',
    /** Initiales d’un avatar ciel. */
    personneCiel: '#386796',
    /** Fond d’un avatar ciel. */
    personneCielFond: '#DDE9F6',
    /** Initiales d’un avatar terre. */
    personneTerre: '#7A5A35',
    /** Fond d’un avatar terre. */
    personneTerreFond: '#F3E9DC',
    /** Voile posé sous une feuille ou une fenêtre. */
    voile: '#0A171352',
  },
  nuit: {
    /** Fond des écrans. */
    fond: '#0A1713',
    /** Cartes, feuilles, barre d’onglets, champs. */
    fondCarte: '#10251D',
    /** Texte principal, sur `fond` et `fond-carte`. */
    texte: '#F3ECE0',
    /** Sous-titres, métadonnées, onglets inactifs, sur `fond` et `fond-carte`. */
    texteSecondaire: '#A9BCB2',
    /** Texte d’exemple dans un champ, état désactivé. Contraste insuffisant pour une information (2.6:1 en Jour). */
    texteDiscret: '#6F8C7F',
    /** Séparateurs de listes (décoratif). */
    filet: '#27463B',
    /** Contours de cartes, piste d’interrupteur éteint (décoratif). */
    filetFort: '#2E473D',
    /** Contour des champs et des cases (3:1 sur `fond` et `fond-carte`). */
    bordureChamp: '#4A7363',
    /** Traits qui relient les personnes dans l’arbre (3:1 sur `fond`). */
    lienArbre: '#4A7363',
    /** Bouton principal, onglet actif, liens. Une seule action principale par écran. */
    action: '#F2B84B',
    /** Texte et icônes posés sur `action` (8.0:1 en Jour, 10.3:1 en Nuit). */
    surAction: '#0A1713',
    /** Fond teinté d’un élément sélectionné. */
    actionDouce: '#3A2D12',
    /** Anneau de focus clavier : 2 px de `fond`, puis 2 px de `focus` (7:1 au moins). */
    focus: '#F2B84B',
    /** Confirmation, étape faite, toujours avec l’icône valider. */
    succes: '#A9D18E',
    /** Lien et célébration (anniversaires, « vous », chemin de parenté) : icônes et grands textes. */
    fete: '#F2B84B',
    /** Texte doré sur `fond`, `fond-carte` et `fete-douce`. */
    feteTexte: '#F2B84B',
    /** Fond teinté or. */
    feteDouce: '#3A2D12',
    /** Fond du bouton de célébration ; son texte est `sur-fete`. */
    feteForte: '#FFE3A6',
    /** Texte sur `fete-forte` (9.3:1 en Jour, 13:1 en Nuit). */
    surFete: '#0A1713',
    /** Trait du chemin de parenté dans l’arbre (3.8:1 en Jour). */
    chemin: '#F2B84B',
    /** Santé uniquement : icône cœur, pastilles, calque santé. */
    sante: '#F2876B',
    /** Texte santé sur `fond`, `fond-carte` et `sante-douce`. */
    santeTexte: '#F2876B',
    /** Fond teinté santé. */
    santeDouce: '#3D211A',
    /** Mémoire et voix : récits, transcriptions, capsule. */
    memoire: '#62C6B8',
    /** Texte mémoire sur `fond`, `fond-carte` et `memoire-douce`. */
    memoireTexte: '#62C6B8',
    /** Fond teinté mémoire. */
    memoireDouce: '#123631',
    /** Liens de parenté (« Sœur d’Odette ») et propositions à valider ; texte et icônes. */
    parente: '#B9ABEA',
    /** Fond teinté parenté. */
    parenteDouce: '#28233F',
    /** Actes, photos, fichiers ; texte et icônes. */
    documents: '#93BDEB',
    /** Fond teinté documents. */
    documentsDouce: '#162C42',
    /** Erreurs et actions destructrices, toujours avec l’icône alerte et un texte. */
    erreur: '#FFB4AB',
    /** Fond d’un message d’erreur. */
    erreurDouce: '#45160F',
    /** Fond des toasts (pilule sombre en Jour, claire en Nuit). */
    notification: '#F3ECE0',
    /** Texte des toasts. */
    surNotification: '#0A1713',
    /** Initiales d’un avatar vert. */
    personneVert: '#A9D18E',
    /** Fond d’un avatar vert. */
    personneVertFond: '#1C3A2C',
    /** Initiales d’un avatar or. */
    personneOr: '#F2B84B',
    /** Fond d’un avatar or. */
    personneOrFond: '#3A2D12',
    /** Initiales d’un avatar lagon. */
    personneLagon: '#62C6B8',
    /** Fond d’un avatar lagon. */
    personneLagonFond: '#123631',
    /** Initiales d’un avatar lilas. */
    personneLilas: '#B9ABEA',
    /** Fond d’un avatar lilas. */
    personneLilasFond: '#28233F',
    /** Initiales d’un avatar ciel. */
    personneCiel: '#93BDEB',
    /** Fond d’un avatar ciel. */
    personneCielFond: '#162C42',
    /** Initiales d’un avatar terre. */
    personneTerre: '#D9B48A',
    /** Fond d’un avatar terre. */
    personneTerreFond: '#33281B',
    /** Voile posé sous une feuille ou une fenêtre. */
    voile: '#000000A3',
  },
};

/** Une couche d’ombre, en dp, au format de `boxShadow` de React Native. */
export interface ShadowLayer {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly spreadDistance: number;
  readonly color: string;
}
/** Une ombre de la charte : la chaîne CSS d’origine et ses couches. */
export interface Shadow {
  readonly boxShadow: string;
  readonly layers: readonly ShadowLayer[];
}
export type ShadowName = 'carte' | 'flottante' | 'feuille';
export type ThemeShadows = { readonly [K in ShadowName]: Shadow };
export const shadows: { readonly [S in SchemeName]: ThemeShadows } = {
  jour: {
    /** Cartes posées sur `fond`. */
    carte: {
      boxShadow: '0 1px 2px rgba(21,33,29,0.06), 0 8px 24px rgba(21,33,29,0.08)',
      layers: [
        { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(21,33,29,0.06)' },
        { offsetX: 0, offsetY: 8, blurRadius: 24, spreadDistance: 0, color: 'rgba(21,33,29,0.08)' },
      ],
    },
    /** Toasts, notifications, bulles qui flottent au-dessus du contenu. */
    flottante: {
      boxShadow: '0 12px 32px rgba(10,23,19,0.22)',
      layers: [
        {
          offsetX: 0,
          offsetY: 12,
          blurRadius: 32,
          spreadDistance: 0,
          color: 'rgba(10,23,19,0.22)',
        },
      ],
    },
    /** Feuilles qui montent du bas. */
    feuille: {
      boxShadow: '0 -8px 32px rgba(10,23,19,0.16)',
      layers: [
        {
          offsetX: 0,
          offsetY: -8,
          blurRadius: 32,
          spreadDistance: 0,
          color: 'rgba(10,23,19,0.16)',
        },
      ],
    },
  },
  nuit: {
    /** Cartes posées sur `fond`. */
    carte: {
      boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.32)',
      layers: [
        { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.4)' },
        { offsetX: 0, offsetY: 8, blurRadius: 24, spreadDistance: 0, color: 'rgba(0,0,0,0.32)' },
      ],
    },
    /** Toasts, notifications, bulles qui flottent au-dessus du contenu. */
    flottante: {
      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      layers: [
        { offsetX: 0, offsetY: 12, blurRadius: 32, spreadDistance: 0, color: 'rgba(0,0,0,0.5)' },
      ],
    },
    /** Feuilles qui montent du bas. */
    feuille: {
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      layers: [
        { offsetX: 0, offsetY: -8, blurRadius: 32, spreadDistance: 0, color: 'rgba(0,0,0,0.5)' },
      ],
    },
  },
};

/**
 * Fichiers de police, par nom de police dans l’app. Sur Android, une graisse est une famille à
 * part : un style de texte nomme la police, jamais `fontWeight`. Les TTF sont dans
 * packages/ui/assets/fonts/ (scripts/generate-fonts.ts).
 */
export const fontFaces = {
  'FrauncesLignee-Display': {
    family: 'Fraunces Lignee',
    weight: 540,
    style: 'normal',
    file: 'FrauncesLignee-Display.ttf',
  },
  'FrauncesLignee-Italic': {
    family: 'Fraunces Lignee',
    weight: 460,
    style: 'italic',
    file: 'FrauncesLignee-Italic.ttf',
  },
  'InstrumentSans-Regular': {
    family: 'Instrument Sans',
    weight: 400,
    style: 'normal',
    file: 'InstrumentSans-Regular.ttf',
  },
  'InstrumentSans-Medium': {
    family: 'Instrument Sans',
    weight: 500,
    style: 'normal',
    file: 'InstrumentSans-Medium.ttf',
  },
  'InstrumentSans-SemiBold': {
    family: 'Instrument Sans',
    weight: 600,
    style: 'normal',
    file: 'InstrumentSans-SemiBold.ttf',
  },
  'InstrumentSans-Bold': {
    family: 'Instrument Sans',
    weight: 700,
    style: 'normal',
    file: 'InstrumentSans-Bold.ttf',
  },
  'LaBelleAurore-Regular': {
    family: 'La Belle Aurore',
    weight: 400,
    style: 'normal',
    file: 'LaBelleAurore-Regular.ttf',
  },
} as const;
export type FontName = keyof typeof fontFaces;

/** Piles de polices CSS (site web, documents), par rôle. */
export const fontStacks = {
  titre: '"Fraunces Lignee", Georgia, serif',
  texte: '"Instrument Sans", -apple-system, "Segoe UI", Roboto, sans-serif',
  manuscrit: '"La Belle Aurore", cursive',
} as const;

/**
 * Un style de texte, en dp. `letterSpacing` est converti des em de la charte. Ni `fontWeight`
 * ni `fontStyle` : la police nommée porte déjà sa graisse et son italique (11-react-native.md),
 * et Android ajouterait un faux gras ou un faux italique.
 */
export interface TextStyle {
  readonly fontFamily: FontName;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing?: number;
}
export type TypographyName =
  | 'displayXl'
  | 'display'
  | 'titre1'
  | 'titre2'
  | 'citation'
  | 'titreEcran'
  | 'titreSection'
  | 'titreCarte'
  | 'corps'
  | 'bouton'
  | 'secondaire'
  | 'etiquette'
  | 'legende'
  | 'surtitre'
  | 'manuscrit';
export const typography: { readonly [K in TypographyName]: TextStyle } = {
  /** Éditorial. Affiches, stores, site, réseaux. Jamais dans l’interface de l’app. */
  displayXl: {
    fontFamily: 'FrauncesLignee-Display',
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -0.64,
  },
  /** Éditorial. Écrans d’accueil et d’introduction de l’app ; une fois par écran. */
  display: { fontFamily: 'FrauncesLignee-Display', fontSize: 40, lineHeight: 46 },
  /** Éditorial. Nom sur la fiche d’une personne, titres de la Mémoire et du livre de famille. */
  titre1: { fontFamily: 'FrauncesLignee-Display', fontSize: 30, lineHeight: 36 },
  /** Éditorial. Titres de rubrique dans la Mémoire et le livre. */
  titre2: { fontFamily: 'FrauncesLignee-Display', fontSize: 24, lineHeight: 30 },
  /** Éditorial. Citations d’aînés, dédicaces, mots mis en valeur dans un titre. */
  citation: { fontFamily: 'FrauncesLignee-Italic', fontSize: 20, lineHeight: 28 },
  /** Interface. Titre en haut de chaque écran. */
  titreEcran: { fontFamily: 'InstrumentSans-Bold', fontSize: 30, lineHeight: 36 },
  /** Interface. Titre d’une feuille, d’une section ou d’une fenêtre. */
  titreSection: { fontFamily: 'InstrumentSans-Bold', fontSize: 22, lineHeight: 28 },
  /** Interface. Titre d’une carte ou d’une ligne de liste. */
  titreCarte: { fontFamily: 'InstrumentSans-SemiBold', fontSize: 17, lineHeight: 22 },
  /** Interface. Texte courant. Jamais en dessous de 17. */
  corps: { fontFamily: 'InstrumentSans-Regular', fontSize: 17, lineHeight: 24 },
  /** Interface. Libellés de boutons et d’onglets de fiche. */
  bouton: { fontFamily: 'InstrumentSans-SemiBold', fontSize: 17, lineHeight: 20 },
  /** Interface. Sous-titres, dates, lieux, métadonnées. */
  secondaire: { fontFamily: 'InstrumentSans-Regular', fontSize: 15, lineHeight: 20 },
  /** Interface. Libellés de champs, étiquettes, puces. */
  etiquette: { fontFamily: 'InstrumentSans-Medium', fontSize: 14, lineHeight: 18 },
  /** Interface. Libellés de la barre d’onglets, horodatages. Taille minimale de l’app. */
  legende: { fontFamily: 'InstrumentSans-Medium', fontSize: 13, lineHeight: 16 },
  /** Interface. Surtitres en capitales espacées (notifications, chapitres). */
  surtitre: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.44,
  },
  /** Manuscrit. Fiches recettes, dédicaces, capsule. Jamais pour un nom propre (pas de ŋ ni de vietnamien). */
  manuscrit: { fontFamily: 'LaBelleAurore-Regular', fontSize: 26, lineHeight: 34 },
};

/** Espacements (grille de 4), par numéro : `space[5]` vaut 20. */
export const space = {
  /** Écart entre une icône et son libellé serré. */
  1: 4,
  /** Écart entre deux puces, entre un libellé et son champ. */
  2: 8,
  /** Écart entre éléments d’une carte. */
  3: 12,
  /** Marge latérale des écrans, écart entre cartes. */
  4: 16,
  /** Marge intérieure des cartes. */
  5: 20,
  /** Écart entre sections. */
  6: 24,
  /** Respiration avant un titre de section. */
  8: 32,
  /** Haut des écrans d’accueil. */
  10: 40,
  /** Grands écarts des écrans d’introduction. */
  12: 48,
  /** Marges des visuels de marque. */
  16: 64,
  /** Marge gauche et droite de chaque écran (= espace-4). */
  margeEcran: 16,
} as const;

/** Rayons. Tout ce qui se touche est en pilule. */
export const radius = {
  /** Petits éléments : vignette de document, pastille carrée. */
  s: 8,
  /** Champs de saisie, lignes surlignées. */
  champ: 16,
  /** Cartes, notifications, aperçus d’écran. */
  carte: 22,
  /** Haut des feuilles qui montent du bas. */
  feuille: 32,
  /** Boutons, puces, toasts, interrupteurs : toujours en pilule. */
  pilule: 999,
} as const;

/** Tailles minimales et tailles d’éléments récurrents. */
export const size = {
  /** Taille minimale d’une zone touchable. */
  cibleTactile: 48,
  /** Zone touchable en mode Aînés. */
  cibleTactileAines: 56,
  /** Hauteur des boutons principaux et des champs. */
  hauteurBouton: 56,
  /** Boutons dans une carte ou une ligne. */
  hauteurBoutonCompact: 44,
  /** Avatar dans une ligne de texte. */
  avatarXs: 24,
  /** Avatar dans une liste, une notification. */
  avatarS: 40,
  /** Nœud de l’arbre au zoom par défaut. */
  avatarM: 58,
  /** Nœud mis en avant, résultat de recherche. */
  avatarL: 88,
  /** En-tête de fiche. */
  avatarXl: 108,
  /** Icône dans un texte ou une puce. */
  iconeS: 20,
  /** Icône standard. */
  iconeM: 24,
  /** Icônes de la barre d’onglets. */
  iconeL: 28,
} as const;

/** Épaisseurs de trait. */
export const stroke = {
  /** Trait des icônes à 24 px. */
  icone: 2,
  /** Liens de l’arbre. */
  lien: 2.5,
  /** Chemin de parenté surligné. */
  chemin: 6,
  /** Anneau de focus. */
  focus: 2,
  /** Contour des champs (2.5 px au focus). */
  champ: 1.5,
} as const;

/** Opacités réservées. */
export const opacity = {
  /** Personnes hors du chemin de parenté ou du calque actif. */
  attenue: 0.38,
  /** Contrôle désactivé. */
  desactive: 0.4,
  /** Voile sous une feuille (Jour). */
  voile: 0.32,
} as const;

/**
 * Mouvement (07-mouvement.md) : durées en ms, courbes au format cubic-bezier(x1, y1, x2, y2).
 * Rien ne rebondit dans la santé ni la confidentialité : `rebondLeger` est réservé à une
 * personne qui apparaît dans l’arbre. Avec « Réduire les animations », tout déplacement devient
 * un fondu de `duration.fonduReduit`.
 */
export const motion = {
  duration: {
    toucher: 120,
    transition: 240,
    changementEtat: 240,
    feuille: 360,
    arbre: 600,
    toastApparition: 300,
    toastPresence: 2500,
    toastDisparition: 300,
    decalageGeneration: 60,
    fonduReduit: 150,
  },
  easing: {
    sortie: [0.33, 1, 0.68, 1],
    entreeSortie: [0.65, 0, 0.35, 1],
    rebondLeger: [0.34, 1.3, 0.64, 1],
  },
  echelleAppui: 0.97,
} as const;

/** Mode Aînés : textes et interlignes multipliés, zones touchables agrandies (09-accessibilite.md). */
export const aines = {
  facteurTexte: 1.3,
  cibleTactile: 56,
} as const;
