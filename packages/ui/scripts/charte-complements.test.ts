// Les valeurs recopiées dans charte-complements.ts doivent rester celles de la charte : ce test
// relit 07-mouvement.md, 04-typographie.md, 09-accessibilite.md et le README.
import { describe, expect, it } from 'vitest';

import { charteComplements } from './charte-complements.ts';
import { readCharte, section, tableRows } from './charte-markdown.ts';

const { motion, aines } = charteComplements;

/** « 120 ms » → 120, « 2,5 s » → 2500. */
function toMs(text: string): number {
  const match = /^(\d+(?:,\d+)?) (ms|s)$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`Durée illisible : « ${text} »`);
  const value = Number(match[1].replace(',', '.'));
  return match[2] === 's' ? value * 1000 : value;
}

describe('mouvement (07-mouvement.md)', () => {
  const markdown = readCharte('07-mouvement.md');
  const [durations, curves] = section(markdown, '## Durées et courbes')
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('|'))
    .map(tableRows);

  const durationOf = (usageStart: string): string[] => {
    const row = durations?.find((cells) => cells[0]?.startsWith(usageStart));
    if (!row) throw new Error(`Ligne « ${usageStart} » absente du tableau des durées`);
    return row;
  };

  it.each([
    ['Retour au toucher', 'toucher', 'sortie'],
    ['Transition d’écran', 'transition', 'sortie'],
    ['Changement d’état', 'changementEtat', 'entrée-sortie'],
    ['Feuille qui monte du bas', 'feuille', 'sortie'],
    ['Arbre qui pousse', 'arbre', 'entrée-sortie'],
  ])('« %s » dure motion.duration.%s', (usage, key, curve) => {
    const [, duration, easing] = durationOf(usage);
    expect(motion.duration[key]).toBe(toMs(duration ?? ''));
    expect(easing).toBe(curve);
  });

  it('le toast apparaît, reste et disparaît selon la charte', () => {
    const [, duration] = durationOf('Toast');
    const [appear, stay, leave] = (duration ?? '').split(' / ').map(toMs);
    expect(motion.duration['toastApparition']).toBe(appear);
    expect(motion.duration['toastPresence']).toBe(stay);
    expect(motion.duration['toastDisparition']).toBe(leave);
  });

  it.each([
    ['Sortie', 'sortie'],
    ['Entrée-sortie', 'entreeSortie'],
    ['Rebond léger', 'rebondLeger'],
  ])('la courbe « %s » est motion.easing.%s', (name, key) => {
    const row = curves?.find((cells) => cells[0] === name);
    expect(row, `courbe « ${name} » absente de la charte`).toBeDefined();
    const values = (row?.[1] ?? '').replace(/[()]/g, '').split(',').map(Number);
    expect(motion.easing[key]).toEqual(values);
  });

  it('les durées recopiées sont toutes vérifiées ou citées dans la charte', () => {
    expect(markdown).toContain('décalage de 60 ms');
    expect(motion.duration['decalageGeneration']).toBe(60);
    expect(markdown).toContain('fondu de 150 ms');
    expect(motion.duration['fonduReduit']).toBe(150);
    expect(Object.keys(motion.duration)).toHaveLength(10);
  });

  it('un bouton appuyé se réduit à 97 % (README, « États »)', () => {
    expect(readCharte('README.md')).toContain('le bouton se réduit à 97 %');
    expect(motion.echelleAppui).toBe(0.97);
  });
});

describe('mode Aînés (ACC-03)', () => {
  it('multiplie les textes par 1,3, comme le disent 04-typographie.md et 09-accessibilite.md', () => {
    expect(readCharte('04-typographie.md')).toContain('multiplie toutes les tailles par 1,3');
    expect(readCharte('09-accessibilite.md')).toContain('multipliées par 1,3');
    expect(aines.facteurTexte).toBe(1.3);
  });
});
