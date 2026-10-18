// Teinte d'un avatar (03-couleurs.md, « Couleurs des personnes »). La règle est isolée ici, dans
// une seule fonction, parce qu'elle fait l'objet d'un choix de produit encore ouvert : la charte
// calcule la teinte à partir du nom de naissance, l'exigence ARB-12 parle d'une couleur « par
// branche » (docs/adr/0022-couleur-des-avatars.md). Changer de règle, c'est remplacer
// `defaultAvatarTintRule` ; ni l'avatar ni les écrans ne bougent. La teinte ne porte aucun sens :
// jamais le genre, jamais le corail (réservé à la santé).
import type { ThemeColors } from '../tokens';

/** Les six teintes, dans l'ordre de la charte : vert, or, lagon, lilas, ciel, terre. */
export const AVATAR_TINTS = ['green', 'gold', 'lagoon', 'lilac', 'sky', 'earth'] as const;
export type AvatarTint = (typeof AVATAR_TINTS)[number];

/** Ce que la règle sait d'une personne. `branchId` sert aux règles par branche, s'il en faut une. */
export interface AvatarTintInput {
  readonly birthName: string;
  readonly branchId?: string;
}

/** Une règle de teinte : la même entrée donne toujours la même teinte, sur tous les écrans. */
export type AvatarTintRule = (input: AvatarTintInput) => AvatarTint;

/**
 * Somme des codes de caractères du nom de naissance, modulo 6 (charte). Le nom est d'abord
 * normalisé (accents composés, minuscules, espaces autour) pour que « Diallo », « DIALLO » et
 * « diallo » tombent sur la même teinte : la charte promet que toutes les personnes nées Diallo
 * partagent une teinte, quelle que soit la façon dont le nom a été saisi.
 */
export function avatarTintFromBirthName(birthName: string): AvatarTint {
  const normalized = birthName.trim().normalize('NFC').toLowerCase();
  let sum = 0;
  for (const character of normalized) sum += character.codePointAt(0) ?? 0;
  return AVATAR_TINTS[sum % AVATAR_TINTS.length] ?? 'green';
}

/** Règle de la charte : la teinte suit le nom de naissance. */
export const defaultAvatarTintRule: AvatarTintRule = ({ birthName }) =>
  avatarTintFromBirthName(birthName);

/** Couleurs d'un avatar sans photo : initiale et fond, dans le thème courant. */
export function avatarTintColors(
  tint: AvatarTint,
  colors: ThemeColors,
): { readonly text: string; readonly background: string } {
  switch (tint) {
    case 'green':
      return { text: colors.personneVert, background: colors.personneVertFond };
    case 'gold':
      return { text: colors.personneOr, background: colors.personneOrFond };
    case 'lagoon':
      return { text: colors.personneLagon, background: colors.personneLagonFond };
    case 'lilac':
      return { text: colors.personneLilas, background: colors.personneLilasFond };
    case 'sky':
      return { text: colors.personneCiel, background: colors.personneCielFond };
    case 'earth':
      return { text: colors.personneTerre, background: colors.personneTerreFond };
  }
}
