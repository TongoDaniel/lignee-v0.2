// Saisie à la main d'une personne (T-031) : du brouillon aux changements, de la fiche au brouillon,
// de la suppression à son lot. Noms générés, aucune donnée réelle.
import { describe, expect, it } from 'vitest';

import { createdObject } from './mutation';
import { fuzzyDateFromText, fuzzyDateSchema } from './fuzzy-date';
import { createUuidV7Generator, type Id } from './ids';
import {
  dateDraftFromDate,
  draftFromSource,
  emptyDateDraft,
  emptyFactDraft,
  emptyNameDraft,
  emptyPersonDraft,
  entryFieldForIssue,
  moveGivenNamesToFormer,
  parseDateDraft,
  planPersonChanges,
  planPersonDeletion,
  splitFullName,
  suggestFormerNameIndex,
  validatePersonDraft,
  type DateDraft,
  type PersonDraft,
} from './person-entry';
import { deterministicIds } from './test-support';

const nextId = deterministicIds(1_800_000_000_000);
const treeId = nextId();
const author = nextId();
const other = nextId();

function draft(overrides: Partial<PersonDraft> = {}): PersonDraft {
  const base = emptyPersonDraft();
  return {
    ...base,
    names: [{ ...emptyNameDraft('birth'), givenNames: 'Awa', surname: 'Ndomo' }],
    ...overrides,
  };
}

const date = (overrides: Partial<DateDraft>): DateDraft => ({ ...emptyDateDraft(), ...overrides });
const year = (value: string) => ({ year: value, month: '', day: '' });

describe('dates saisies par morceaux', () => {
  it('une date vide est une absence de date', () => {
    expect(parseDateDraft(emptyDateDraft())).toEqual({ ok: true, date: undefined });
  });

  it('« vers 1940 » est approximative à l’année ; « années 1940 » est à la décennie', () => {
    const about = parseDateDraft(date({ mode: 'about', from: year('1940') }));
    expect(about).toMatchObject({ ok: true, date: { qualifier: 'about', precision: 'year' } });
    const decade = parseDateDraft(date({ mode: 'exact', decade: true, from: year('1940') }));
    expect(decade).toMatchObject({ ok: true, date: { qualifier: 'exact', precision: 'decade' } });
  });

  it('le jour exige le mois, une décennie ni mois ni jour', () => {
    expect(
      parseDateDraft(date({ mode: 'exact', from: { year: '1940', month: '', day: '3' } })),
    ).toEqual({
      ok: false,
      issue: { code: 'day_needs_month', part: 'from' },
    });
    expect(
      parseDateDraft(
        date({ mode: 'exact', decade: true, from: { year: '1940', month: '2', day: '' } }),
      ),
    ).toEqual({ ok: false, issue: { code: 'decade_no_month', part: 'from' } });
  });

  it('une borne “entre” de précision différente est refusée sur la seconde borne', () => {
    const result = parseDateDraft(
      date({
        mode: 'between',
        from: { year: '1935', month: '5', day: '' },
        to: year('1940'),
      }),
    );
    expect(result).toEqual({ ok: false, issue: { code: 'precision_differs', part: 'to' } });
  });

  it('une date refusée ne cite jamais ce qui a été tapé', () => {
    const result = parseDateDraft(date({ mode: 'exact', from: year('secret-9') }));
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('un texte libre est gardé tel quel', () => {
    const result = parseDateDraft(
      date({ mode: 'text', text: '  l’année de la grande sécheresse ' }),
    );
    expect(result).toEqual({
      ok: true,
      date: fuzzyDateFromText('l’année de la grande sécheresse'),
    });
  });

  it('une date existante revient au brouillon puis à la même date', () => {
    const samples = [
      fuzzyDateSchema.parse({
        qualifier: 'between',
        precision: 'year',
        from: { year: 1935 },
        to: { year: 1940 },
      }),
      fuzzyDateSchema.parse({ qualifier: 'about', precision: 'decade', date: { year: 1940 } }),
      fuzzyDateSchema.parse({ qualifier: 'calculated', precision: 'year', date: { year: 1930 } }),
      fuzzyDateSchema.parse({
        qualifier: 'exact',
        precision: 'month',
        date: { year: 1431, month: 3 },
        calendar: 'hijri',
      }),
      fuzzyDateFromText('un jour de pluie'),
    ];
    for (const sample of samples) {
      expect(parseDateDraft(dateDraftFromDate(sample))).toEqual({ ok: true, date: sample });
    }
  });
});

describe('splitFullName (CL-DON-01)', () => {
  it('sépare selon l’ordre de l’arbre', () => {
    expect(splitFullName('Abenzo Lucien', 'surname_first')).toEqual({
      surname: 'Abenzo',
      givenNames: 'Lucien',
    });
    expect(splitFullName('Marie Claire Abenzo', 'given_first')).toEqual({
      surname: 'Abenzo',
      givenNames: 'Marie Claire',
    });
  });

  it('ne devine rien d’un seul mot', () => {
    expect(splitFullName('Kossivi', 'given_first')).toBeUndefined();
    expect(splitFullName('   ', 'surname_first')).toBeUndefined();
  });
});

describe('validation du brouillon (UNI-01)', () => {
  it('exige un nom, sauf pour « Inconnu »', () => {
    const empty = draft({ names: [emptyNameDraft('birth')] });
    expect(validatePersonDraft(empty)).toEqual([
      { field: 'names.0.givenNames', code: 'name_required' },
    ]);
    expect(validatePersonDraft({ ...empty, placeholder: true })).toEqual([]);
  });

  it('un ancien prénom seul ne suffit pas à une personne connue', () => {
    const onlyFormer = draft({ names: [{ ...emptyNameDraft('former'), givenNames: 'Jo' }] });
    expect(validatePersonDraft(onlyFormer).map((issue) => issue.code)).toEqual(['name_required']);
  });

  it('une ligne ajoutée puis laissée vide est ignorée', () => {
    const withBlank = draft({ names: [...draft().names, emptyNameDraft('nickname')] });
    expect(validatePersonDraft(withBlank)).toEqual([]);
  });

  it('une date illisible est signalée sur son champ', () => {
    const bad = draft({ birth: { date: date({ mode: 'about' }), place: '' } });
    expect(validatePersonDraft(bad)).toEqual([
      { field: 'birth.date', code: 'year_required', part: 'from' },
    ]);
  });
});

describe('création (UNI-01, CAR-01)', () => {
  const places = [{ id: nextId(), name: 'Douala' }];

  it('crée la fiche puis le nom, dans un seul ensemble ordonné', () => {
    const personId = nextId();
    const plan = planPersonChanges({
      draft: draft(),
      personId,
      authorAccountId: author,
      places,
      newId: nextId,
    });
    expect(plan.changes.map((change) => `${change.entity}:${change.operation}`)).toEqual([
      'person:create',
      'name:create',
    ]);
    expect(plan.changes[1]?.fields).toMatchObject({
      personId,
      type: 'birth',
      authorAccountId: author,
    });
  });

  it('« Inconnu » crée une place à compléter sans nom', () => {
    const plan = planPersonChanges({
      draft: draft({ placeholder: true, names: [emptyNameDraft('birth')] }),
      personId: nextId(),
      authorAccountId: author,
      places,
      newId: nextId,
    });
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.fields).toMatchObject({ nature: 'placeholder' });
  });

  it('chaque objet créé passe le schéma du modèle', () => {
    const full = draft({
      gender: 'female',
      vitalStatus: 'deceased',
      notes: 'Née pendant la saison des pluies',
      birth: { date: date({ mode: 'about', from: year('1940') }), place: 'Bafoussam' },
      death: { date: date({ mode: 'exact', from: year('2010') }), place: 'douala  ' },
      deathCause: { value: 'cause de test' },
      occupations: [{ ...emptyFactDraft(), value: 'Couturière' }],
      residences: [{ ...emptyFactDraft(), place: 'Yaoundé' }],
      titles: [
        {
          label: 'Chef',
          start: date({ mode: 'exact', from: year('1990') }),
          end: emptyDateDraft(),
        },
      ],
    });
    const personId = nextId();
    const plan = planPersonChanges({
      draft: full,
      personId,
      authorAccountId: author,
      places,
      newId: nextId,
    });
    for (const change of plan.changes) {
      expect(change.operation).toBe('create');
      const result = createdObject(change.entity, change.entityId, treeId, change.fields ?? {});
      expect({ entity: change.entity, ok: result.success }).toEqual({
        entity: change.entity,
        ok: true,
      });
    }
    // « Douala » existe déjà : réutilisé, pas recréé. « Bafoussam » et « Yaoundé » sont créés.
    const created = plan.changes.filter((change) => change.entity === 'place');
    expect(created.map((change) => change.fields?.name).sort()).toEqual(['Bafoussam', 'Yaoundé']);
    const death = plan.changes.find((change) => change.fields?.type === 'death');
    expect(death?.fields?.placeId).toBe(places[0]?.id);
  });

  it('cause de décès et ancien prénom sont toujours créés au nom du rédacteur (UNI-15, UNI-22)', () => {
    const sensitive = draft({
      vitalStatus: 'deceased',
      deathCause: { value: 'cause de test' },
      names: [
        { ...emptyNameDraft('birth'), givenNames: 'Awa' },
        { ...emptyNameDraft('former'), givenNames: 'Jo' },
      ],
    });
    const plan = planPersonChanges({
      draft: sensitive,
      personId: nextId(),
      authorAccountId: author,
      places,
      newId: nextId,
    });
    const cause = plan.changes.find((change) => change.fields?.type === 'death_cause');
    const former = plan.changes.find((change) => change.fields?.type === 'former');
    expect(cause?.fields?.authorAccountId).toBe(author);
    expect(former?.fields?.authorAccountId).toBe(author);
    expect(JSON.stringify(plan.changes)).not.toContain(other);
  });

  it('une cause saisie puis un statut “vivante” : la cause n’est pas envoyée', () => {
    const plan = planPersonChanges({
      draft: draft({ vitalStatus: 'living', deathCause: { value: 'cause de test' } }),
      personId: nextId(),
      authorAccountId: author,
      places,
      newId: nextId,
    });
    expect(JSON.stringify(plan.changes)).not.toContain('cause de test');
  });
});

describe('modification', () => {
  const personId = nextId();
  const nameId = nextId();
  const birthId = nextId();
  const placeId = nextId();
  const source = {
    people: [
      {
        id: personId,
        treeId,
        nature: 'known' as const,
        gender: 'female' as const,
        vitalStatus: 'living' as const,
        version: 3,
      },
    ],
    names: [
      {
        id: nameId,
        treeId,
        personId,
        type: 'birth' as const,
        givenNames: 'Awa',
        surname: 'Ndomo',
        authorAccountId: author,
      },
    ],
    facts: [
      {
        id: birthId,
        treeId,
        subject: { kind: 'person' as const, personId },
        type: 'birth' as const,
        date: fuzzyDateSchema.parse({
          qualifier: 'calculated',
          precision: 'year',
          date: { year: 1930 },
        }),
        placeId,
        authorAccountId: author,
      },
    ],
    titleRoles: [],
    places: [{ id: placeId, treeId, name: 'Bafoussam', formerNames: [] }],
  };
  const original = draftFromSource(source, personId, { accountId: author }) as PersonDraft;

  it('relit la fiche telle qu’elle est, sans rien changer', () => {
    const plan = planPersonChanges({
      draft: original,
      original,
      personId,
      authorAccountId: author,
      places: source.places,
      newId: nextId,
    });
    expect(plan.changes).toEqual([]);
  });

  it('n’envoie que les champs changés ; une date calculée non touchée reste calculée', () => {
    const changed: PersonDraft = {
      ...original,
      names: [{ ...(original.names[0] as PersonDraft['names'][number]), surname: 'Ndomo-Essaka' }],
    };
    const plan = planPersonChanges({
      draft: changed,
      original,
      personId,
      authorAccountId: author,
      places: source.places,
      newId: nextId,
    });
    expect(plan.changes).toEqual([
      expect.objectContaining({
        entity: 'name',
        operation: 'update',
        entityId: nameId,
        fields: { surname: 'Ndomo-Essaka' },
      }),
    ]);
  });

  it('vider un lieu le retire (null) ; retirer la naissance entière la supprime', () => {
    const noPlace = planPersonChanges({
      draft: { ...original, birth: { ...original.birth, place: '' } },
      original,
      personId,
      authorAccountId: author,
      places: source.places,
      newId: nextId,
    });
    expect(noPlace.changes[0]?.fields).toEqual({ placeId: null });
    const noBirth = planPersonChanges({
      draft: { ...original, birth: { id: birthId, date: emptyDateDraft(), place: '' } },
      original,
      personId,
      authorAccountId: author,
      places: source.places,
      newId: nextId,
    });
    expect(noBirth.changes).toEqual([
      expect.objectContaining({ entity: 'fact', operation: 'delete', entityId: birthId }),
    ]);
  });

  it('un nom retiré du brouillon est supprimé ; un nom existant ne se vide pas en silence', () => {
    const second = { ...emptyNameDraft('nickname'), id: nextId(), givenNames: 'Mama' };
    const withSecond = { ...original, names: [...original.names, second] };
    const plan = planPersonChanges({
      draft: original,
      original: withSecond,
      personId,
      authorAccountId: author,
      places: [],
      newId: nextId,
    });
    expect(plan.changes).toEqual([
      expect.objectContaining({ entity: 'name', operation: 'delete', entityId: second.id }),
    ]);
    const emptied = {
      ...original,
      names: [
        { ...(original.names[0] as PersonDraft['names'][number]), givenNames: '', surname: '' },
      ],
    };
    expect(validatePersonDraft(emptied)).toContainEqual({
      field: 'names.0.givenNames',
      code: 'cannot_forget_name',
    });
  });

  it('donner un nom à une place à compléter la rend connue', () => {
    const placeholderId = nextId();
    const start = draftFromSource(
      {
        ...source,
        people: [
          {
            id: placeholderId,
            treeId,
            nature: 'placeholder',
            gender: 'unspecified',
            vitalStatus: 'unknown',
            version: 0,
          },
        ],
        names: [],
        facts: [],
      },
      placeholderId,
      { accountId: author },
    ) as PersonDraft;
    const named: PersonDraft = {
      ...start,
      placeholder: false,
      names: [{ ...emptyNameDraft('birth'), givenNames: 'Dora' }],
    };
    const plan = planPersonChanges({
      draft: named,
      original: start,
      personId: placeholderId,
      authorAccountId: author,
      places: [],
      newId: nextId,
    });
    expect(plan.changes.map((change) => `${change.entity}:${change.operation}`)).toEqual([
      'person:update',
      'name:create',
    ]);
    expect(plan.changes[0]?.fields).toEqual({ nature: 'known' });
  });

  it('la cause de décès des autres n’est jamais relue dans le brouillon', () => {
    const causeId = nextId();
    const withForeignCause = {
      ...source,
      facts: [
        ...source.facts,
        {
          id: causeId,
          treeId,
          subject: { kind: 'person' as const, personId },
          type: 'death_cause' as const,
          value: 'cause d’un autre',
          authorAccountId: other,
        },
      ],
    };
    const result = draftFromSource(withForeignCause, personId, {
      accountId: author,
    }) as PersonDraft;
    expect(result.deathCause).toEqual({ value: '' });
    expect(JSON.stringify(result)).not.toContain('cause d’un autre');
  });

  it('l’ancien prénom d’un autre auteur n’entre pas dans le brouillon', () => {
    const withForeignFormer = {
      ...source,
      names: [
        ...source.names,
        {
          id: nextId(),
          treeId,
          personId,
          type: 'former' as const,
          givenNames: 'Autre',
          authorAccountId: other,
        },
      ],
    };
    const result = draftFromSource(withForeignFormer, personId, {
      accountId: author,
    }) as PersonDraft;
    expect(result.names.map((name) => name.type)).toEqual(['birth']);
  });
});

describe('constat de l’enregistrement → champ de l’écran', () => {
  const plan = planPersonChanges({
    draft: draft({ birth: { date: date({ mode: 'exact', from: year('1940') }), place: 'Douala' } }),
    personId: nextId(),
    authorAccountId: author,
    places: [],
    newId: nextId,
  });

  it('suit le rang de la mutation et le champ désigné', () => {
    const factIndex = plan.changes.findIndex(
      (change) => change.entity === 'fact' && change.fields?.type === 'birth',
    );
    expect(
      entryFieldForIssue(plan, {
        code: 'invalid_object',
        path: `mutations[${String(factIndex)}].fields.date.year`,
      }),
    ).toBe('birth.date');
    expect(
      entryFieldForIssue(plan, {
        code: 'dangling_reference',
        path: `mutations[${String(factIndex)}].fields.placeId`,
      }),
    ).toBe('birth.place');
  });

  it('un nom manquant désigne le premier champ de nom, quelle que soit la mutation', () => {
    expect(entryFieldForIssue(plan, { code: 'person_without_name', path: 'mutations[0]' })).toBe(
      'names.0.givenNames',
    );
  });

  it('sans rang connu : le formulaire entier', () => {
    expect(entryFieldForIssue(plan, { code: 'unknown_tree', path: 'treeId' })).toBe('form');
    expect(
      entryFieldForIssue(plan, { code: 'invalid_object', path: 'mutations[99].fields.x' }),
    ).toBe('form');
  });
});

describe('ancien prénom (UNI-22)', () => {
  const transition = (overrides: Partial<PersonDraft> = {}): PersonDraft =>
    draft({
      gender: 'female',
      names: [
        { ...emptyNameDraft('birth'), givenNames: 'Jean', surname: 'Ndomo' },
        { ...emptyNameDraft('usage'), givenNames: 'Jeanne', surname: 'Ndomo' },
      ],
      ...overrides,
    });

  it('propose de ranger le prénom de naissance quand un autre prénom est en cours', () => {
    expect(suggestFormerNameIndex(transition())).toBe(0);
  });

  it('ne propose rien sans signal : genre non renseigné et aucun ancien prénom', () => {
    expect(suggestFormerNameIndex(transition({ gender: 'unspecified' }))).toBeUndefined();
  });

  it('ne propose rien quand le prénom en cours est le même (nom d’usage après mariage)', () => {
    const married = transition({
      names: [
        { ...emptyNameDraft('birth'), givenNames: 'Marthe', surname: 'Tchoupa' },
        { ...emptyNameDraft('usage'), givenNames: 'Marthe', surname: 'Essaka' },
      ],
    });
    expect(suggestFormerNameIndex(married)).toBeUndefined();
  });

  it('range les prénoms en ancien prénom et garde le nom de famille de naissance', () => {
    const moved = moveGivenNamesToFormer(transition(), 0);
    expect(moved.names.map((name) => [name.type, name.givenNames, name.surname])).toEqual([
      ['birth', '', 'Ndomo'],
      ['former', 'Jean', ''],
      ['usage', 'Jeanne', 'Ndomo'],
    ]);
    expect(validatePersonDraft(moved)).toEqual([]);
  });

  it('ne reste qu’un ancien prénom et un nom en cours quand il n’y avait pas de nom de famille', () => {
    const noSurname = transition({
      names: [
        { ...emptyNameDraft('birth'), givenNames: 'Jean' },
        { ...emptyNameDraft('usage'), givenNames: 'Jeanne' },
      ],
    });
    const moved = moveGivenNamesToFormer(noSurname, 0);
    expect(moved.names.map((name) => name.type)).toEqual(['former', 'usage']);
  });
});

describe('suppression (ADR 0027)', () => {
  const ids = Array.from({ length: 24 }, () => nextId());
  const [
    ,
    a,
    b,
    c,
    d,
    nameA,
    nameB,
    titleA,
    factA,
    factUnion,
    unionAB,
    unionAC,
    answer,
    filAC,
    filBC,
    filAD,
    cand,
    birth,
    placeholderId,
    toPlaceId,
    recog,
    filBD,
    factFil,
  ] = ids as [
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
    Id,
  ];
  const person = (id: Id, extra: object = {}) => ({
    id,
    treeId,
    nature: 'known' as const,
    gender: 'unspecified' as const,
    vitalStatus: 'unknown' as const,
    version: 0,
    ...extra,
  });
  const source = {
    people: [
      person(a),
      person(b),
      person(c),
      person(d),
      person(placeholderId, { nature: 'placeholder', distinctFrom: [a, b] }),
    ],
    names: [
      {
        id: nameA,
        treeId,
        personId: a,
        type: 'birth' as const,
        givenNames: 'Ama',
        authorAccountId: author,
      },
      {
        id: nameB,
        treeId,
        personId: b,
        type: 'birth' as const,
        givenNames: 'Bako',
        authorAccountId: author,
      },
    ],
    unions: [
      {
        id: unionAB,
        treeId,
        spouses: [
          { personId: a, rank: 1 },
          { personId: b, rank: 1 },
        ],
      },
      {
        id: unionAC,
        treeId,
        spouses: [
          { personId: a, rank: 2 },
          { personId: c, rank: 1 },
        ],
      },
    ],
    simultaneityAnswers: [
      {
        id: answer,
        treeId,
        unionIds: [unionAB, unionAC] as [Id, Id],
        value: 'simultaneous' as const,
      },
    ],
    filiations: [
      {
        id: filAC,
        treeId,
        parentId: a,
        childId: c,
        type: 'birth' as const,
        certainty: 'certain' as const,
      },
      {
        id: filBC,
        treeId,
        parentId: b,
        childId: c,
        type: 'birth' as const,
        certainty: 'certain' as const,
        originUnionId: unionAB,
      },
      {
        id: filAD,
        treeId,
        parentId: a,
        childId: d,
        type: 'birth' as const,
        certainty: 'certain' as const,
      },
      {
        id: filBD,
        treeId,
        parentId: b,
        childId: d,
        type: 'birth' as const,
        certainty: 'certain' as const,
      },
    ],
    parentCandidates: [{ id: cand, treeId, childId: d, candidateId: a }],
    facts: [
      {
        id: factA,
        treeId,
        subject: { kind: 'person' as const, personId: a },
        type: 'birth' as const,
        authorAccountId: author,
      },
      {
        id: factUnion,
        treeId,
        subject: { kind: 'union' as const, unionId: unionAB },
        type: 'other' as const,
        value: 'Mariage',
        authorAccountId: author,
      },
      {
        id: recog,
        treeId,
        subject: { kind: 'person' as const, personId: d },
        type: 'recognition' as const,
        filiationId: filAD,
        authorAccountId: author,
      },
      {
        id: factFil,
        treeId,
        subject: { kind: 'person' as const, personId: b },
        type: 'birth' as const,
        authorAccountId: author,
      },
    ],
    titleRoles: [{ id: titleA, treeId, personId: a, label: 'Chef', authorAccountId: author }],
    multipleBirths: [
      { id: birth, treeId, members: [{ personId: a }, { personId: c }, { personId: d }] },
    ],
    toPlace: [
      {
        id: toPlaceId,
        treeId,
        personId: placeholderId,
        referencePersonId: a,
        path: ['parent' as const],
        side: 'unknown' as const,
        status: 'open' as const,
      },
    ],
  };

  it('liste les dépendants dans le même lot : noms, faits, liens, unions, titres', () => {
    const plan = planPersonDeletion(source, a);
    const deleted = new Set(
      plan.changes
        .filter((change) => change.operation === 'delete')
        .map((change) => change.entityId),
    );
    for (const id of [
      nameA,
      titleA,
      factA,
      factUnion,
      recog,
      answer,
      cand,
      filAC,
      filAD,
      unionAB,
      unionAC,
      toPlaceId,
      a,
    ]) {
      expect(deleted.has(id)).toBe(true);
    }
    expect(deleted.has(nameB)).toBe(false);
    expect(deleted.has(b)).toBe(false);
    expect(plan.summary).toEqual({ names: 1, facts: 3, titles: 1, links: 3, unions: 2 });
    expect(plan.changes[plan.changes.length - 1]).toMatchObject({
      entity: 'person',
      operation: 'delete',
      entityId: a,
    });
  });

  it('corrige sans supprimer ce qui cite aussi d’autres personnes', () => {
    const plan = planPersonDeletion(source, a);
    const updates = plan.changes.filter((change) => change.operation === 'update');
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'filiation',
          entityId: filBC,
          fields: { originUnionId: null },
        }),
        expect.objectContaining({
          entity: 'multiple_birth',
          entityId: birth,
          fields: { members: [{ personId: c }, { personId: d }] },
        }),
        expect.objectContaining({
          entity: 'person',
          entityId: placeholderId,
          fields: { distinctFrom: [b] },
        }),
      ]),
    );
  });

  it('une naissance multiple qui n’a plus que deux membres disparaît avec le troisième', () => {
    const plan = planPersonDeletion(
      {
        ...source,
        multipleBirths: [{ id: birth, treeId, members: [{ personId: a }, { personId: c }] }],
      },
      a,
    );
    expect(plan.changes).toContainEqual(
      expect.objectContaining({ entity: 'multiple_birth', operation: 'delete', entityId: birth }),
    );
  });

  it('une personne sans rien autour : la fiche seule', () => {
    const plan = planPersonDeletion(source, c);
    expect(plan.summary.names).toBe(0);
    expect(
      plan.changes.some((change) => change.entityId === c && change.operation === 'delete'),
    ).toBe(true);
  });
});

describe('identifiants', () => {
  it('le générateur de l’app sert aussi aux tests', () => {
    expect(createUuidV7Generator()()).toMatch(/^[0-9a-f-]{36}$/u);
  });
});
