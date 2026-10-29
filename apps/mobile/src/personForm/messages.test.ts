// Mots de la saisie d'une personne : chaque code des paquets a un texte en français et en anglais,
// les refus de l'enregistrement se rangent sur le bon champ, aucune valeur saisie n'entre dans un
// message (T-031 du plan V1, ADR 0027 : « codes de refus traduits par packages/i18n »).
import {
  planPersonChanges,
  emptyNameDraft,
  emptyPersonDraft,
  type DateDraftIssueCode,
} from '@lignee/domain';
import { createTranslator } from '@lignee/i18n';
import {
  InvalidMutationBatchError,
  MUTATION_ISSUE_CODES,
  MutationBatchRefusedError,
} from '@lignee/sync';

import { editPersonRoute, newPersonRoute } from '../navigation/personFormRoute';
import { describeSaveFailure } from './failures';
import { coherenceText, dateIssueText, entryIssueText, recordIssueText } from './messages';

const fr = createTranslator({ language: 'fr' });
const en = createTranslator({ language: 'en' });
const DATE_CODES: readonly DateDraftIssueCode[] = [
  'year_required',
  'year_invalid',
  'month_invalid',
  'day_invalid',
  'day_needs_month',
  'decade_year_invalid',
  'decade_no_month',
  'precision_differs',
  'range_order',
  'text_required',
  'invalid_date',
];

describe('textes des codes', () => {
  it.each([fr, en])('chaque code de refus de l’enregistrement a son texte (%#)', (translator) => {
    const generic = translator.t('common:personForm.saveFailed');
    for (const code of MUTATION_ISSUE_CODES) {
      const text = recordIssueText(translator, code);
      expect({ code, text: text.length > 0 }).toEqual({ code, text: true });
      // Un texte propre au code, pas le message générique.
      expect({ code, generic: text === generic }).toEqual({ code, generic: false });
    }
  });

  it('un code inconnu (autre version de l’app) retombe sur le message général', () => {
    expect(recordIssueText(fr, 'code_futur')).toBe(fr.t('common:personForm.saveFailed'));
  });

  it.each([fr, en])('chaque refus de date et de brouillon a son texte (%#)', (translator) => {
    for (const code of DATE_CODES)
      expect(dateIssueText(translator, code).length).toBeGreaterThan(0);
    for (const code of [
      'name_required',
      'cannot_forget_name',
      'title_label_required',
      'occupation_required',
    ] as const) {
      expect(entryIssueText(translator, code).length).toBeGreaterThan(0);
    }
  });

  it('les alertes de dates ont un texte ; un refus de lien n’en a pas ici', () => {
    expect(coherenceText(fr, 'death_before_birth')).toBe(
      'La date du décès est avant la date de naissance.',
    );
    expect(coherenceText(en, 'implausible_age')).toContain('120');
    expect(coherenceText(fr, 'third_birth_parent')).toBeUndefined();
  });
});

describe('du refus au champ', () => {
  const person = emptyPersonDraft();
  const plan = planPersonChanges({
    draft: {
      ...person,
      names: [{ ...emptyNameDraft('birth'), givenNames: 'Secret-Prénom' }],
      birth: { date: person.birth.date, place: 'Secret-Lieu' },
    },
    personId: '01900000-0000-7000-8000-000000000001',
    authorAccountId: '01900000-0000-7000-8000-000000000002',
    places: [],
    newId: (() => {
      let counter = 10;
      return () => `01900000-0000-7000-8000-${String((counter += 1)).padStart(12, '0')}`;
    })(),
  });

  it('un refus de l’enregistrement désigne le champ, avec son texte', () => {
    const failure = describeSaveFailure(
      new MutationBatchRefusedError([{ code: 'person_without_name', path: 'mutations[0]' }]),
      plan,
      fr,
    );
    expect(failure.fields['names.0.givenNames']).toBe(
      'Une personne connue garde au moins un nom, autre qu’un ancien prénom.',
    );
    expect(failure.form).toBeUndefined();
  });

  it('une erreur de schéma désigne le champ par son chemin', () => {
    const nameIndex = plan.changes.findIndex((change) => change.entity === 'name');
    const failure = describeSaveFailure(
      new InvalidMutationBatchError([`mutations[${String(nameIndex)}].fields.surname`]),
      plan,
      en,
    );
    expect(failure.fields['names.0.surname']).toBe(
      'This information is not valid. Check this field.',
    );
  });

  it('une erreur quelconque donne un message général qui ne cite rien', () => {
    const failure = describeSaveFailure(new Error('Secret-Prénom Secret-Lieu'), plan, fr);
    expect(failure.fields).toEqual({});
    expect(JSON.stringify(failure)).not.toContain('Secret');
  });
});

describe('adresses du formulaire', () => {
  it('ajoute ou modifie, avec l’arbre si besoin', () => {
    expect(newPersonRoute()).toBe('/person/new');
    expect(newPersonRoute('arbre 1')).toBe('/person/new?treeId=arbre%201');
    expect(editPersonRoute('abc')).toBe('/person/edit/abc');
    expect(editPersonRoute('abc', 'arbre 1')).toBe('/person/edit/abc?treeId=arbre%201');
  });
});
