// Textes de l'arbre dessiné et de sa liste (T-017) : les libellés lus par TalkBack et VoiceOver
// suivent les mêmes règles que le dessin (ADR 0024). Ils ne se construisent que depuis le graphe
// déjà filtré : jamais une clé de famille, un écart de rangées ni un nombre de croisements.
// Tous les textes viennent de `packages/i18n`.
import type { MissingParent } from '@lignee/layout';
import type { Translator } from '@lignee/i18n';

import type { PersonCard } from './personCards';

type Translate = Translator['t'];

/** Prénom affiché sous l'avatar, ou la mention d'une place à compléter. */
export function shortName(card: PersonCard | undefined, t: Translate): string {
  if (card === undefined || card.placeholder) return t('common:treeScreen.unknownPerson');
  const name = card.firstName === '' ? card.fullName : card.firstName;
  return name === '' ? t('common:treeScreen.noName') : name;
}

/** Nom entier pour le détail et pour les lecteurs d'écran. */
export function fullName(card: PersonCard | undefined, t: Translate): string {
  if (card === undefined || card.placeholder) return t('common:treeScreen.unknownPerson');
  const name = card.fullName === '' ? card.firstName : card.fullName;
  return name === '' ? t('common:treeScreen.noName') : name;
}

/**
 * Années de vie d'une personne décédée (« 1931 – 2019 »), rien d'autre : ni croix ni grisé
 * (06-arbre.md). Aucune ligne pour une personne vivante.
 */
export function lifespan(card: PersonCard | undefined, t: Translate): string | undefined {
  if (card === undefined || card.placeholder || !card.deceased) return undefined;
  if (card.birthYear !== undefined && card.deathYear !== undefined) {
    return t('common:treeScreen.lifespan', {
      from: String(card.birthYear),
      to: String(card.deathYear),
    });
  }
  if (card.deathYear !== undefined) {
    return t('common:treeScreen.lifespanUnknownStart', { to: String(card.deathYear) });
  }
  return card.birthYear === undefined ? undefined : String(card.birthYear);
}

/** Libellé complet d'une fiche : « Claire Martin, 1931 – 2019 » ; pour « Vous », sa mention. */
export function personLabel(
  card: PersonCard | undefined,
  options: { readonly you: boolean },
  t: Translate,
): string {
  const name = fullName(card, t);
  if (options.you) return t('common:treeScreen.youLabel', { name });
  if (card === undefined || card.placeholder) return name;
  const years = lifespan(card, t);
  if (years !== undefined) return t('common:treeScreen.deceasedLabel', { name, years });
  if (!card.deceased && card.birthYear !== undefined) {
    return t('common:treeScreen.livingLabel', {
      name,
      born: t('common:treeScreen.bornIn', { year: String(card.birthYear) }),
    });
  }
  return name;
}

/** « Mère non précisée », « Père non précisé », « Parent non précisé ». */
export function missingParentText(missing: MissingParent, t: Translate): string {
  switch (missing) {
    case 'mother':
      return t('common:treeScreen.missingMother');
    case 'father':
      return t('common:treeScreen.missingFather');
    case 'parent':
      return t('common:treeScreen.missingParent');
  }
}
