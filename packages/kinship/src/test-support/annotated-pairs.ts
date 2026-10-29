// Jeu de 200 paires annotées (T-023, plan V1 ; PRD, PAR-02 ; TRD, « Moteur de parenté », Tests) :
// lecture, contrôle de forme et signature structurelle des liens. Le format est décrit dans
// packages/kinship/test-data/paires-annotees/README.md. Réservé aux tests (lit des fichiers).
//
// L'attendu de chaque paire est la structure du lien, indépendante des mots : chemin (générations,
// ancêtres au sommet, unions traversées), fratrie, alliance nommée, base (naissance ou non),
// certitude et côtés. Les mots français et anglais de chaque lien sont des champs à remplir par
// T-026 et T-027 (« à rédiger » tant qu'ils ne le sont pas).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Id } from '@lignee/domain';
import {
  buildScenarioTree,
  scenarioTreeSchema,
  type ScenarioTree,
} from '@lignee/domain/test-support';
import { parse } from 'yaml';
import { z } from 'zod';

import type { KinshipGraph } from '../graph';
import type { PresentationResult, PresentedLink } from '../presentation';
import type { Relationship } from '../relationship';

export const PAIRS_DIR = fileURLToPath(
  new URL('../../test-data/paires-annotees/', import.meta.url),
);

/** Mots pas encore écrits (T-026 en français, T-027 en anglais). */
export const TO_WRITE = 'à rédiger';

/** Catégories du jeu ; chaque paire en a une seule (sa raison d'être dans le jeu). */
export const PAIR_CATEGORIES = [
  'polygamie',
  'levirat_sororat',
  'alliance',
  'degres_civils',
  'non_biologique_certitude',
  'implexe',
  'places_a_completer',
  'visibilite',
] as const;
export type PairCategory = (typeof PAIR_CATEGORIES)[number];

const KEY = /^[a-z][a-z0-9_]*$/;
const keySchema = z.string().regex(KEY);
const words = z.string().trim().min(1);

/**
 * Mots d'un lien dans une langue (PAR-11) : forme courte (« demi-frère, même père ») et forme
 * expliquée (« fils de votre père et de Mbuou »), ou « à rédiger » tant que le ticket de la
 * langue ne les a pas écrits (T-027 pour l'anglais).
 */
export const linkWordsSchema = z.union([
  z.literal(TO_WRITE),
  z.strictObject({ court: words, explique: words }),
]);
export type ExpectedWords = z.infer<typeof linkWordsSchema>;

const sideSchema = z.strictObject({
  par: keySchema,
  cote: z.enum(['father', 'mother', 'parent']),
  /** Type de la filiation vers ce parent ; absent : naissance. */
  type: z.enum(['adoptive', 'raised', 'fostered', 'guardian', 'donor', 'surrogacy']).optional(),
});

const timing = z.enum(['simultaneous', 'successive', 'unknown']);

/** Un lien présenté attendu (le principal, puis les autres, dans l'ordre). */
export const expectedLinkSchema = z.strictObject({
  /**
   * Segments du chemin : `2/1[a+b]` pour le sang (générations montées et descendues, ancêtres au
   * sommet triés), `=x` pour une union vers x ; un segment immobile (0/0) n'est pas écrit. Une
   * fratrie réunit ses chemins, séparés par ` | `, dans l'ordre du moteur.
   */
  chemin: z.string().min(1),
  /** Fratrie (une génération de chaque côté) : nature, partage dit par les mots, côté. */
  fratrie: z
    .strictObject({
      type: z.enum(['birth', 'birth_and_adoption', 'adoption', 'other']),
      partage: z.enum(['full', 'half', 'full_or_half']),
      cote: z.enum(['father', 'mother', 'parent']).optional(),
    })
    .optional(),
  /** Alliance nommée (ADR 0020). */
  alliance: z
    .strictObject({
      type: z.enum([
        'spouse',
        'parent_of_spouse',
        'spouse_of_parent',
        'child_of_spouse',
        'spouse_of_child',
        'sibling_of_spouse',
        'spouse_of_sibling',
        'step_sibling',
        'co_spouse',
        'spouse_of_spouse',
        'spouse_of_sibling_of_spouse',
        'other',
      ]),
      /** Deux conjoints d'une même personne : simultanéité de leurs unions avec elle. */
      simultaneite: timing.optional(),
      /**
       * Pour chaque passage depuis ou vers l'enfant d'un conjoint, dans l'ordre du chemin :
       * l'union traversée face à celle du parent avec l'autre parent de l'enfant.
       */
      autre_parent: z.array(z.enum(['simultaneous', 'successive', 'unknown', 'none'])).optional(),
    })
    .optional(),
  /** Types non biologiques du lien affiché ; absent : naissance seulement (PAR-06). */
  base: z.array(z.string()).min(1).optional(),
  /** Certitude la plus faible du lien affiché ; absente : certain (PAR-08). */
  certitude: z.enum(['probable', 'hypothetical']).optional(),
  /** Parent par lequel monte A (sauf fratrie) ; absent si A ne monte pas. */
  cote_de: sideSchema.optional(),
  /** Parent par lequel monte B, lu de B vers A (sauf fratrie). */
  cote_vers: sideSchema.optional(),
  fr: linkWordsSchema,
  en: linkWordsSchema,
});
export type ExpectedLink = z.infer<typeof expectedLinkSchema>;

/** Signature calculée d'un lien : l'attendu sans les mots. */
export type LinkSignature = Omit<ExpectedLink, 'fr' | 'en'>;

export const pairSchema = z.strictObject({
  id: z.string().regex(/^F\d{2}-\d{2}$/),
  de: keySchema,
  vers: keySchema,
  categorie: z.enum(PAIR_CATEGORIES),
  /** Personnes masquées pour le lecteur : retirées du graphe, comme par le filtre (PAR-09). */
  masques: z.array(keySchema).min(1).optional(),
  /** Justification de l'attendu : règle du cahier, de l'ADR ou cas limite, en une phrase. */
  pourquoi: z.string().trim().min(15),
  /** `aucun` : « Lien non disponible » ; `meme_personne` ; sinon les liens, dans l'ordre. */
  attendu: z.union([z.enum(['aucun', 'meme_personne']), z.array(expectedLinkSchema).min(1)]),
  /** Une limite de calcul atteinte (`truncated`) ; absent : non. */
  tronque: z.literal(true).optional(),
});
export type AnnotatedPair = z.infer<typeof pairSchema>;

export const familySchema = z.strictObject({
  famille: z.string().regex(/^F\d{2}$/),
  titre: z.string().min(1),
  /** `composee` (écrite à la main, prénoms générés) ou l'arbre généré d'où elle est figée. */
  origine: z.union([
    z.literal('composee'),
    z.strictObject({
      generateur: z.literal('generateTree'),
      graine: z.int(),
      taille: z.int().min(1),
      commit: z.string().regex(/^[0-9a-f]{7,40}$/),
    }),
  ]),
  arbre: scenarioTreeSchema,
  paires: z.array(pairSchema).min(1),
});
export type AnnotatedFamily = z.infer<typeof familySchema>;

export const pairSetHeaderSchema = z.strictObject({
  version: z.literal(1),
  total: z.int().min(1),
  /** Nombre minimal de paires par catégorie. */
  quotas: z.record(z.enum(PAIR_CATEGORIES), z.int().min(1)),
});
export type PairSetHeader = z.infer<typeof pairSetHeaderSchema>;

export interface LoadedFamily {
  file: string;
  family: AnnotatedFamily;
  tree: ScenarioTree;
}

/** Lit l'en-tête (`jeu.yaml`) et chaque famille (`F*.yaml`), dans l'ordre des fichiers. */
export function loadPairSet(dir: string = PAIRS_DIR): {
  header: PairSetHeader;
  families: LoadedFamily[];
} {
  const header = pairSetHeaderSchema.parse(parse(readFileSync(join(dir, 'jeu.yaml'), 'utf8')));
  const files = readdirSync(dir)
    .filter((file) => /^F\d{2}-.*\.yaml$/.test(file))
    .sort();
  const families = files.map((file) => {
    const family = familySchema.parse(parse(readFileSync(join(dir, file), 'utf8')), {
      reportInput: false,
    });
    return { file, family, tree: buildScenarioTree(family.arbre) };
  });
  return { header, families };
}

const SEGMENT = /^(?:(\d+)\/(\d+)\[([a-z0-9_+]+)\]|=([a-z0-9_]+))$/;

/** Problèmes de forme d'une paire dans sa famille, sans calculer le lien. */
export function pairIssues(family: AnnotatedFamily, pair: AnnotatedPair): string[] {
  const issues: string[] = [];
  const declared = new Set(family.arbre.personnes.map(({ key }) => key));
  const known = (key: string, where: string) => {
    if (!declared.has(key)) issues.push(`${where}: ${key} is not in ${family.famille}`);
  };
  if (!pair.id.startsWith(`${family.famille}-`))
    issues.push(`id ${pair.id} not in ${family.famille}`);
  known(pair.de, 'de');
  known(pair.vers, 'vers');
  for (const key of pair.masques ?? []) {
    known(key, 'masques');
    if (key === pair.de || key === pair.vers) issues.push(`masques: ${key} is A or B`);
  }
  if ((pair.de === pair.vers) !== (pair.attendu === 'meme_personne')) {
    issues.push('meme_personne exactly when de equals vers');
  }
  if (pair.categorie === 'visibilite' && pair.masques === undefined) {
    issues.push('a visibilite pair hides someone');
  }
  if (typeof pair.attendu === 'string') return issues;
  pair.attendu.forEach((link, index) => {
    const where = `attendu[${String(index)}]`;
    const paths = link.chemin.split(' | ');
    const blood = !link.chemin.includes('=');
    let firstLine: { up: number; down: number } | undefined;
    for (const path of paths) {
      const segments = path.split(' ');
      if (segments.length === 0) issues.push(`${where}: empty path`);
      segments.forEach((segment, position) => {
        const match = SEGMENT.exec(segment);
        if (match === null) {
          issues.push(`${where}: bad segment "${segment}"`);
          return;
        }
        if (match[4] !== undefined) {
          known(match[4], where);
          if (position === segments.length - 1 && match[4] === pair.de) {
            issues.push(`${where}: a path does not come back to A`);
          }
          return;
        }
        const up = Number(match[1]);
        const down = Number(match[2]);
        if (up + down === 0) issues.push(`${where}: a 0/0 segment is not written`);
        if (segments.length === 1) firstLine = { up, down };
        const ancestors = (match[3] ?? '').split('+');
        ancestors.forEach((key) => {
          known(key, where);
        });
        if ([...ancestors].sort().join('+') !== ancestors.join('+')) {
          issues.push(`${where}: ancestors of "${segment}" are not sorted`);
        }
      });
    }
    if (paths.length > 1 && link.fratrie === undefined) {
      issues.push(`${where}: several paths only for siblings`);
    }
    const sibling = blood && firstLine?.up === 1 && firstLine.down === 1;
    if ((link.fratrie !== undefined) !== sibling) {
      issues.push(`${where}: fratrie exactly for a 1/1 blood path`);
    }
    if ((link.alliance !== undefined) !== !blood) {
      issues.push(`${where}: alliance exactly for a path through a union`);
    }
    if (
      link.fratrie !== undefined &&
      (link.cote_de !== undefined || link.cote_vers !== undefined)
    ) {
      issues.push(`${where}: a sibling's side is in fratrie.cote`);
    }
    if (link.fratrie?.partage === 'full' && link.fratrie.cote !== undefined) {
      issues.push(`${where}: full siblings have no side`);
    }
    for (const side of [link.cote_de, link.cote_vers]) if (side) known(side.par, where);
  });
  return issues;
}

/** Problèmes du jeu entier : en-tête, identifiants uniques, paires en double, total, quotas. */
export function pairSetIssues(header: PairSetHeader, families: readonly AnnotatedFamily[]) {
  const issues: string[] = [];
  const ids = new Set<string>();
  const pairs = new Set<string>();
  const familyIds = new Set<string>();
  const counts = new Map<PairCategory, number>();
  for (const family of families) {
    if (familyIds.has(family.famille)) issues.push(`family ${family.famille} twice`);
    familyIds.add(family.famille);
    for (const pair of family.paires) {
      if (ids.has(pair.id)) issues.push(`pair ${pair.id} twice`);
      ids.add(pair.id);
      const key = [family.famille, pair.de, pair.vers, ...[...(pair.masques ?? [])].sort()].join(
        ' ',
      );
      if (pairs.has(key)) issues.push(`pair ${pair.id} repeats ${key}`);
      pairs.add(key);
      counts.set(pair.categorie, (counts.get(pair.categorie) ?? 0) + 1);
      for (const issue of pairIssues(family, pair)) issues.push(`${pair.id}: ${issue}`);
    }
  }
  if (ids.size !== header.total) {
    issues.push(`${String(ids.size)} pairs, expected ${String(header.total)}`);
  }
  for (const category of PAIR_CATEGORIES) {
    const quota = header.quotas[category];
    if ((counts.get(category) ?? 0) < quota) {
      issues.push(
        `${category}: ${String(counts.get(category) ?? 0)} pairs, under its quota ${String(quota)}`,
      );
    }
  }
  return { issues, counts };
}

function describePath(relationship: Relationship, keyOf: (id: Id) => string): string {
  return relationship.segments
    .flatMap((segment) => {
      if (segment.kind === 'union') return [`=${keyOf(segment.toId)}`];
      if (segment.generationsUp + segment.generationsDown === 0) return [];
      const ancestors = segment.commonAncestors.map((ancestor) => keyOf(ancestor.personId)).sort();
      return [
        `${String(segment.generationsUp)}/${String(segment.generationsDown)}[${ancestors.join('+')}]`,
      ];
    })
    .join(' ');
}

/** Signature structurelle d'un lien présenté, dans la forme de l'attendu. */
export function linkSignature(link: PresentedLink, keyOf: (id: Id) => string): LinkSignature {
  const side = (value: PresentedLink['fromSide']) =>
    value === undefined
      ? undefined
      : {
          par: keyOf(value.parentId),
          cote: value.side,
          ...(value.type === 'birth' ? {} : { type: value.type }),
        };
  const alliance = link.alliance;
  const childSides = (alliance?.crossings ?? []).flatMap((crossing) =>
    [crossing.fromChild, crossing.toChild].flatMap((child) =>
      child === undefined ? [] : [child.timing],
    ),
  );
  const signature: LinkSignature = {
    chemin: link.relationships.map((relationship) => describePath(relationship, keyOf)).join(' | '),
  };
  if (link.sibling !== undefined) {
    signature.fratrie = {
      type: link.sibling.kind,
      partage: link.sibling.sharing,
      ...(link.sibling.sharing === 'full' || link.sibling.link.side === undefined
        ? {}
        : { cote: link.sibling.link.side }),
    };
  }
  if (alliance !== undefined) {
    signature.alliance = {
      type: alliance.kind,
      ...(alliance.sharedSpouse === undefined
        ? {}
        : { simultaneite: alliance.sharedSpouse.timing }),
      ...(childSides.length === 0 ? {} : { autre_parent: childSides }),
    };
  }
  if (link.nonBirthTypes.length > 0) signature.base = [...link.nonBirthTypes];
  if (link.certainty !== 'certain') signature.certitude = link.certainty;
  if (link.sibling === undefined) {
    const from = side(link.fromSide);
    const to = side(link.toSide);
    if (from !== undefined) signature.cote_de = from;
    if (to !== undefined) signature.cote_vers = to;
  }
  return signature;
}

/** Attendu d'une réponse, dans la forme du jeu (`aucun`, `meme_personne` ou les signatures). */
export function resultSignature(
  result: PresentationResult,
  keyOf: (id: Id) => string,
): { attendu: 'aucun' | 'meme_personne' | 'incomplet' | LinkSignature[]; tronque?: true } {
  if (result.status === 'none') return { attendu: 'aucun' };
  if (result.status === 'same_person') return { attendu: 'meme_personne' };
  if (result.status === 'incomplete') return { attendu: 'incomplet', tronque: true };
  return {
    attendu: result.links.map((link) => linkSignature(link, keyOf)),
    ...(result.truncated ? { tronque: true as const } : {}),
  };
}

/** L'attendu d'une paire, sans les mots, pour le comparer à `resultSignature`. */
export function expectedSignature(pair: AnnotatedPair): ReturnType<typeof resultSignature> {
  const attendu =
    typeof pair.attendu === 'string'
      ? pair.attendu
      : pair.attendu.map((link) => {
          const signature: Partial<ExpectedLink> = { ...link };
          delete signature.fr;
          delete signature.en;
          return signature as LinkSignature;
        });
  return { attendu, ...(pair.tronque === undefined ? {} : { tronque: pair.tronque }) };
}

/** Mots attendus d'un lien, rédigés ou non, par langue. */
export function wordFields(families: readonly AnnotatedFamily[]) {
  return families.flatMap((family) =>
    family.paires.flatMap((pair) =>
      typeof pair.attendu === 'string'
        ? []
        : pair.attendu.flatMap((link, index) => [
            { pair: pair.id, index, language: 'fr' as const, words: link.fr },
            { pair: pair.id, index, language: 'en' as const, words: link.en },
          ]),
    ),
  );
}

const GENDER_LETTERS = { male: 'M', female: 'F', other: 'A', unspecified: 'N' } as const;

/**
 * Vocabulaire couvert par le jeu : pour chaque lien attendu, sa forme de base et le genre de la
 * personne visée (B), qui commandent les mots (PAR-02, PAR-11). `ligne 0/2 F` : petite-fille, par
 * la naissance ; `fratrie half M` : demi-frère ; `parent_of_spouse F` : mère du conjoint ;
 * `genre A` : une personne visée de genre « autre ». Les liens non biologiques comptent à part
 * (`ligne 1/0 M adoptive`).
 */
export function vocabularyKeys(families: readonly AnnotatedFamily[]): Set<string> {
  const keys = new Set<string>();
  for (const family of families) {
    const genders = new Map(family.arbre.personnes.map(({ key, gender }) => [key, gender]));
    for (const pair of family.paires) {
      if (typeof pair.attendu === 'string') continue;
      const gender = GENDER_LETTERS[genders.get(pair.vers) ?? 'unspecified'];
      if (gender === 'A') keys.add('genre A');
      for (const link of pair.attendu) {
        const base = link.base === undefined ? '' : ` ${link.base.join('+')}`;
        if (link.fratrie !== undefined)
          keys.add(`fratrie ${link.fratrie.partage} ${gender}${base}`);
        else if (link.alliance !== undefined) keys.add(`${link.alliance.type} ${gender}${base}`);
        else {
          const line = /^(\d+\/\d+)\[/.exec(link.chemin)?.[1];
          if (line !== undefined) keys.add(`ligne ${line} ${gender}${base}`);
        }
      }
    }
  }
  return keys;
}

/** Personne sans prénom dans une famille générée : aucun nom dans les mots. */
const NAMELESS_KEY = 'sans_prenom';

/**
 * Noms affichés dans la forme expliquée des paires (« fils de votre père et de Mbuou ») : la clé
 * de la personne avec une majuscule ; aucun nom pour une place à compléter, ni pour une personne
 * sans prénom (`sans_prenom`). Dans l'application, c'est le nom affiché au lecteur (PAR-07).
 */
export function pairNameOf(tree: ScenarioTree, graph: KinshipGraph) {
  return (personId: Id): string | undefined => {
    const key = tree.keyOf(personId);
    const person = graph.person(personId);
    if (key === undefined || key === NAMELESS_KEY || person?.nature !== 'known') return undefined;
    return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  };
}
