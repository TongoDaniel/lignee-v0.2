// Lecture et analyse des fichiers de messages (outillage : génération des types, contrôles, tests).
// Ce module n'est pas exporté par le paquet : l'analyseur ICU ne part pas dans l'app.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

/** Nature d'un paramètre ICU, telle qu'elle doit concorder entre les langues. */
export type ParamKind = 'text' | 'number' | 'date';

/** Paramètres attendus par un message : nom → nature. */
export type Signature = Readonly<Record<string, ParamKind>>;

/** Messages d'une langue : clé complète (`espace:chemin.de.la.cle`) → texte ICU. */
export type Catalog = ReadonlyMap<string, string>;

/** Clé d'un message à l'intérieur d'un espace de noms : segments anglais en camelCase. */
export const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;

/** Nom d'un espace de noms (un fichier par langue) : minuscules, sans séparateur. */
export const NAMESPACE_PATTERN = /^[a-z]+$/;

/** Nom d'un paramètre ICU : identifiant anglais en camelCase. */
export const PARAM_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

// Options que i18next lit dans l'objet de paramètres : un paramètre de ce nom changerait la
// recherche de la clé au lieu d'être inséré dans le texte.
const RESERVED_PARAMS = new Set([
  'context',
  'defaultValue',
  'interpolation',
  'joinArrays',
  'keyPrefix',
  'keySeparator',
  'lng',
  'lngs',
  'ns',
  'nsSeparator',
  'ordinal',
  'postProcess',
  'replace',
  'returnDetails',
  'returnObjects',
]);

/** Aplatit un arbre JSON de messages en clés pointées ; refuse toute feuille qui n'est pas un texte. */
export function flattenMessages(tree: unknown, where: string): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (!KEY_PATTERN.test(path)) {
        throw new Error(`${where} : clé « ${path} » invalide (segments anglais en camelCase).`);
      }
      out.set(path, node);
      return;
    }
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      throw new Error(`${where} : « ${path || '(racine)'} » doit être un texte ou un objet.`);
    }
    for (const [segment, child] of Object.entries(node)) {
      visit(child, path === '' ? segment : `${path}.${segment}`);
    }
  };
  visit(tree, '');
  return out;
}

/** Analyse un message ICU ; lève une erreur lisible si la syntaxe est fausse. */
export function parseMessage(message: string, key: string): MessageFormatElement[] {
  try {
    return parse(message, { requiresOtherClause: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${key} : message ICU invalide (${reason}).`, { cause: error });
  }
}

/** Paramètres d'un message et leur nature. */
export function signatureOf(message: string, key: string): Signature {
  const kinds = new Map<string, ParamKind>();
  const add = (name: string, kind: ParamKind): void => {
    if (!PARAM_PATTERN.test(name)) {
      throw new Error(
        `${key} : paramètre « ${name} » invalide (identifiant anglais en camelCase).`,
      );
    }
    if (RESERVED_PARAMS.has(name)) {
      throw new Error(`${key} : « ${name} » est réservé par i18next ; choisissez un autre nom.`);
    }
    const previous = kinds.get(name);
    if (previous === undefined || previous === 'text') {
      kinds.set(name, kind);
    } else if (kind !== 'text' && kind !== previous) {
      throw new Error(`${key} : « ${name} » est à la fois ${previous} et ${kind}.`);
    }
  };
  const walk = (elements: readonly MessageFormatElement[]): void => {
    for (const element of elements) {
      switch (element.type) {
        case TYPE.literal:
        case TYPE.pound:
          break;
        case TYPE.argument:
          add(element.value, 'text');
          break;
        case TYPE.number:
          add(element.value, 'number');
          break;
        case TYPE.date:
        case TYPE.time:
          add(element.value, 'date');
          break;
        case TYPE.plural:
          add(element.value, 'number');
          for (const option of Object.values(element.options)) walk(option.value);
          break;
        case TYPE.select:
          add(element.value, 'text');
          for (const option of Object.values(element.options)) walk(option.value);
          break;
        case TYPE.tag:
          throw new Error(`${key} : balise <${element.value}> non prise en charge.`);
      }
    }
  };
  walk(parseMessage(message, key));
  return Object.fromEntries([...kinds].sort(([a], [b]) => a.localeCompare(b, 'en')));
}

/** Morceaux de texte littéral d'un message (hors syntaxe ICU), pour les contrôles typographiques. */
export function literalTexts(message: string, key: string): string[] {
  const texts: string[] = [];
  const walk = (elements: readonly MessageFormatElement[]): void => {
    for (const element of elements) {
      if (element.type === TYPE.literal) texts.push(element.value);
      if (element.type === TYPE.plural || element.type === TYPE.select) {
        for (const option of Object.values(element.options)) walk(option.value);
      }
    }
  };
  walk(parseMessage(message, key));
  return texts;
}

/** Espaces de noms présents sur le disque pour une langue (`messages/<langue>/<espace>.json`). */
export function namespacesOnDisk(messagesDir: string, language: string): string[] {
  return readdirSync(join(messagesDir, language))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
}

/** Charge tous les messages d'une langue, clés complètes `espace:chemin`. */
export function loadCatalog(messagesDir: string, language: string): Catalog {
  const catalog = new Map<string, string>();
  for (const namespace of namespacesOnDisk(messagesDir, language)) {
    if (!NAMESPACE_PATTERN.test(namespace)) {
      throw new Error(`messages/${language}/${namespace}.json : nom d'espace invalide.`);
    }
    const file = join(messagesDir, language, `${namespace}.json`);
    const tree: unknown = JSON.parse(readFileSync(file, 'utf8'));
    for (const [key, text] of flattenMessages(tree, `messages/${language}/${namespace}.json`)) {
      catalog.set(`${namespace}:${key}`, text);
    }
  }
  return catalog;
}
