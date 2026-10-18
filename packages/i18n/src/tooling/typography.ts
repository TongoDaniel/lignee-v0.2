// Contrôles de ton et de typographie sur le texte littéral d'un message (hors syntaxe ICU),
// d'après docs/charte/08-ton.md. Chaque fonction renvoie la liste des problèmes, vide si tout va bien.

// Espace insécable : fine (U+202F) ou normale (U+00A0).
const NBSP = String.fromCodePoint(0x202f, 0x00a0);

const URL = /(?:https?:\/\/|mailto:|www\.)\S+/giu;
const TIME = /(\d):(\d)/gu;
const MISSING_BEFORE = new RegExp(`(^|[^${NBSP}])([;:!?»])`, 'gu');
const MISSING_AFTER = new RegExp(`«(?=[^${NBSP}]|$)`, 'u');

/**
 * Typographie française : espace insécable avant ; : ! ? » et après «, pour qu'aucun signe ne
 * passe seul à la ligne quand le texte est agrandi à 200 %. Règle plus stricte que les exemples
 * de la charte, voulue. Les adresses web et les heures (« 14:05 ») ne sont pas concernées.
 */
export function frenchSpacingIssues(literal: string): string[] {
  const text = literal.replace(URL, ' ').replace(TIME, '$1$2');
  const issues: string[] = [];
  for (const match of text.matchAll(MISSING_BEFORE)) {
    issues.push(`espace insécable (U+202F ou U+00A0) attendue avant « ${match[2] ?? ''} »`);
  }
  if (MISSING_AFTER.test(text)) {
    issues.push('espace insécable (U+202F ou U+00A0) attendue après « « »');
  }
  return issues;
}

const TUTOIEMENT = /(?<!\p{L})(?:tu|te|toi|ton|ta|tes)(?!\p{L})|(?<!\p{L})t[’'](?=\p{L})/giu;

/**
 * Mots du tutoiement (« tu », « te », « toi », « ton », « ta », « tes », « t’ ») : Lignée vouvoie
 * tout le monde. Contrôle volontairement large : un faux positif se reformule.
 */
export function tutoiementIssues(literal: string): string[] {
  return [...literal.matchAll(TUTOIEMENT)].map(
    ([word]) => `tutoiement « ${word} » : vouvoyez (« vous », « votre », « vos »)`,
  );
}

/** Contrôles communs aux deux langues : emoji, apostrophe et guillemets droits, « ... », « !! ». */
export function commonTypographyIssues(literal: string): string[] {
  const issues: string[] = [];
  if (/\p{Extended_Pictographic}/u.test(literal)) issues.push('emoji interdit');
  if (literal.includes("'")) issues.push('apostrophe droite : utilisez ’');
  if (literal.includes('"')) issues.push('guillemets droits : utilisez « » ou “ ”');
  if (literal.includes('...')) issues.push('trois points : utilisez …');
  if (/!{2,}/u.test(literal)) issues.push("points d'exclamation en série");
  return issues;
}
