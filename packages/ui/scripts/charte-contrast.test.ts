// ACC-01 : texte à 4,5:1, éléments graphiques à 3:1, dans les thèmes Jour et Nuit.
// Les paires sont celles que déclare la charte (03-couleurs.md, « Contrastes mesurés ») ; les
// couleurs viennent de src/tokens.ts, donc de tokens.json. Le test vérifie aussi que le rapport
// annoncé par la charte est juste, pour que le tableau ne mente pas après un changement de teinte.
import { describe, expect, it } from 'vitest';

import { CONTRAST_GRAPHIC, CONTRAST_TEXT, contrastRatio } from '../src/contrast.ts';
import { schemeNames, themes, type ColorRole, type SchemeName } from '../src/tokens.ts';
import { readCharte, section, tableRows } from './charte-markdown.ts';
import { camelCase } from './tokens-source.ts';

interface Announced {
  readonly ratio: number;
  readonly failsByDesign: boolean;
}

interface DeclaredPair {
  readonly foreground: ColorRole;
  readonly background: ColorRole;
  readonly announced: Readonly<Record<SchemeName, Announced>>;
  readonly threshold: number;
}

function role(cell: string | undefined): ColorRole {
  const name = /^`([a-z-]+)`$/.exec(cell ?? '')?.[1];
  const key = camelCase(name ?? '');
  if (!(key in themes.jour)) throw new Error(`Couleur « ${String(cell)} » inconnue de tokens.ts`);
  return key as ColorRole;
}

/** « 14.7:1 » → 14.7 ; « 2.3:1 ✗ » → 2.3, échec voulu par la charte. */
function announced(cell: string | undefined): Announced {
  const match = /^(\d+(?:\.\d+)?):1( ✗)?$/.exec(cell ?? '');
  if (!match?.[1]) throw new Error(`Rapport « ${String(cell)} » illisible`);
  return { ratio: Number(match[1]), failsByDesign: match[2] !== undefined };
}

const declared: DeclaredPair[] = tableRows(
  section(readCharte('03-couleurs.md'), '## Contrastes mesurés'),
).map(([fg, bg, jour, nuit, threshold]) => ({
  foreground: role(fg),
  background: role(bg),
  announced: { jour: announced(jour), nuit: announced(nuit) },
  threshold: announced(threshold).ratio,
}));

/** Rôles qui portent du texte : 4,5:1 exigé, jamais 3:1. */
const TEXT_ROLES = new Set<ColorRole>([
  'texte',
  'texteSecondaire',
  'texteDiscret',
  'feteTexte',
  'santeTexte',
  'memoireTexte',
  'parente',
  'documents',
  'erreur',
  'surAction',
  'surFete',
  'surNotification',
  'personneVert',
  'personneOr',
  'personneLagon',
  'personneLilas',
  'personneCiel',
  'personneTerre',
]);

function ratioOf(scheme: SchemeName, fg: ColorRole, bg: ColorRole): number {
  return contrastRatio(themes[scheme][fg], themes[scheme][bg]);
}

describe('contrastes déclarés par la charte (ACC-01)', () => {
  it('la charte déclare les paires de texte principales', () => {
    expect(declared.length).toBeGreaterThanOrEqual(40);
    const pairs = declared.map((p) => `${p.foreground}/${p.background}`);
    expect(pairs).toEqual(
      expect.arrayContaining(['texte/fond', 'texte/fondCarte', 'surAction/action']),
    );
  });

  it('chaque seuil est celui de la charte : 4,5:1 pour un texte, 3:1 pour un élément graphique', () => {
    for (const pair of declared) {
      expect(pair.threshold, `${pair.foreground} sur ${pair.background}`).toBe(
        TEXT_ROLES.has(pair.foreground) ? CONTRAST_TEXT : CONTRAST_GRAPHIC,
      );
    }
  });

  for (const scheme of schemeNames) {
    describe(`thème ${scheme}`, () => {
      for (const pair of declared) {
        const { foreground, background, threshold } = pair;
        const { ratio: stated, failsByDesign } = pair.announced[scheme];
        const label = `${foreground} sur ${background} atteint ${String(threshold)}:1`;
        const meetsThreshold = (): void => {
          expect(ratioOf(scheme, foreground, background)).toBeGreaterThanOrEqual(threshold);
        };
        if (failsByDesign) {
          // Échec voulu et documenté par la charte (03-couleurs.md, « ✗ ») : `texte-discret` ne
          // sert qu'au texte d'exemple d'un champ et aux états désactivés, jamais à une
          // information. Si la charte le corrige, ce test devient rouge : retirez alors le ✗.
          it.fails(`${label} (échec voulu par la charte)`, meetsThreshold);
        } else {
          it(label, meetsThreshold);
        }
        it(`${foreground} sur ${background} : le rapport annoncé (${String(stated)}:1) est juste`, () => {
          // La charte arrondit au dixième.
          expect(Math.abs(ratioOf(scheme, foreground, background) - stated)).toBeLessThanOrEqual(
            0.06,
          );
        });
      }
    });
  }
});

// Paires que les règles de la charte imposent sans les chiffrer dans le tableau.
describe('contrastes d’usage (README de la charte)', () => {
  const usage: readonly [ColorRole, ColorRole, number, string][] = [
    ['action', 'fond', CONTRAST_TEXT, '`action` sert aux liens'],
    ['action', 'fondCarte', CONTRAST_TEXT, '`action` sert aux liens'],
    ['texte', 'actionDouce', CONTRAST_TEXT, 'élément sélectionné sur `action-douce`'],
    ['texteSecondaire', 'actionDouce', CONTRAST_TEXT, 'élément sélectionné sur `action-douce`'],
    ['succes', 'fond', CONTRAST_GRAPHIC, 'icône valider'],
    ['succes', 'fondCarte', CONTRAST_GRAPHIC, 'icône valider'],
  ];
  for (const scheme of schemeNames) {
    for (const [fg, bg, threshold, why] of usage) {
      it(`${scheme} : ${fg} sur ${bg} atteint ${String(threshold)}:1 (${why})`, () => {
        expect(ratioOf(scheme, fg, bg)).toBeGreaterThanOrEqual(threshold);
      });
    }
  }
});
