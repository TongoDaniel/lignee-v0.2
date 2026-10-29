// Refus de l'enregistrement d'une saisie (T-031 du plan V1) : du constat de @lignee/sync au champ
// du formulaire et au texte. Un constat ne porte qu'un code et un chemin ; ni l'un ni l'autre ne
// contient ce qui a été tapé, et rien n'est journalisé.
import { entryFieldForIssue, type PersonPlan } from '@lignee/domain';
import type { Translator } from '@lignee/i18n';
import { InvalidMutationBatchError, MutationBatchRefusedError } from '@lignee/sync';

import { recordIssueText } from './messages';

export interface SaveFailure {
  /** Texte par champ du formulaire (`names.0.givenNames`, `birth.date`…). */
  readonly fields: Readonly<Record<string, string>>;
  /** Texte pour l'ensemble du formulaire, quand aucun champ n'est désigné. */
  readonly form: string | undefined;
}

/**
 * Ce que l'écran montre après un échec. Lot mal formé ou refusé : le champ désigné par chaque
 * constat (`mutations[i].fields.X` rangé par `entryFieldForIssue`). Autre erreur (base fermée,
 * disque plein) : un message général, sans détail.
 */
export function describeSaveFailure(
  error: unknown,
  plan: PersonPlan,
  translator: Translator,
): SaveFailure {
  const fields: Record<string, string> = {};
  let form: string | undefined;
  const add = (field: string, code: string) => {
    const text = recordIssueText(translator, code);
    if (field === 'form') form ??= text;
    else fields[field] ??= text;
  };
  if (error instanceof InvalidMutationBatchError) {
    for (const path of error.paths)
      add(entryFieldForIssue(plan, { code: 'invalid_object', path }), 'invalid_object');
  } else if (error instanceof MutationBatchRefusedError) {
    for (const issue of error.issues) add(entryFieldForIssue(plan, issue), issue.code);
  } else {
    form = translator.t('common:personForm.saveFailed');
  }
  if (Object.keys(fields).length === 0 && form === undefined) {
    form = translator.t('common:personForm.saveFailed');
  }
  return { fields, form };
}
