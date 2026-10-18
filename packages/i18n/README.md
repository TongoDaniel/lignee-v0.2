# i18n

Textes d'interface en français et en anglais (ACC-04, ACC-05). Aucun texte en dur ailleurs. Agent : ecrans-lignee.

## Ce que le lint vérifie, et ce qu'il ne voit pas

Dans `apps/mobile`, `apps/web`, `apps/admin` et `packages/ui` (tests exclus), ESLint refuse :

- le texte dans le JSX : entre deux balises, en chaîne ou en gabarit (`{'Valider'}`, `accessibilityLabel="Ajouter votre mère"`, `{ok ? 'Oui' : 'Non'}`) ;
- une chaîne ou un gabarit passé à `Alert.alert`, `Alert.prompt`, `ToastAndroid.show`, ou en `text` d'un bouton d'`Alert`, y compris dans un fichier `.ts`.

Une valeur d'union littérale (`variant="primary"`), `testID`, `style` ou `key` restent permis. La preuve est dans `tools/ci/src/no-hardcoded-text.test.ts`.

Le lint ne voit pas, et la relecture doit s'en charger :

- une constante texte déclarée hors du JSX puis affichée (`const titre = 'Bienvenue'`, puis `<Text>{titre}</Text>`), ni les textes rangés dans un objet ou un tableau ;
- un composant nommé en capitales (`FAQ`) : le greffon le prend pour une constante et ne le contrôle pas. Nommez les composants en PascalCase ;
- dans un fichier `.ts`, tout ce qui n'est pas `Alert` ou `ToastAndroid` : titre de navigation, notification locale, hook qui renvoie du texte ;
- les textes produits par le serveur (`apps/api`, `apps/worker` : notifications, courriels, erreurs), qui devront passer par ce paquet eux aussi.

i18next avec le format de messages ICU (`i18next-icu`, `intl-messageformat`) ; dates et nombres par l'API `Intl`.

## Organisation

| Chemin | Contenu |
| --- | --- |
| `messages/<langue>/<espace>.json` | Les textes, un fichier par langue et par espace de noms (`common` pour l'instant). Le français fait référence. |
| `review/<langue>.json` | Relecture par un locuteur natif (ACC-05) : une entrée par message, `to-review` ou `reviewed` avec le texte relu. |
| `src/generated/message-params.ts` | Types des clés et des paramètres, générés depuis les messages français. Ne pas modifier à la main. |
| `src/translator.ts` | `createTranslator` : traduction typée, changement de langue à chaud, abonnement. |
| `src/format.ts` | Nombres, pluriels, dates d'événements de vie (partielles) et instants, selon la langue. |
| `src/tooling/` | Génération et contrôles (Node seulement, jamais dans l'app). |

## Ajouter un texte

1. Choisissez l'espace de noms (`common` pour ce qui sert partout) et une clé **en anglais**, en camelCase, rangée par thème : `actions.invite`, `tree.emptyState`. Jamais le texte français comme clé.
2. Écrivez le texte dans `messages/fr/<espace>.json` **et** dans `messages/en/<espace>.json`, au ton de `docs/charte/08-ton.md` : vouvoiement, un bouton commence par un verbe à l'infinitif (« Inviter », « Oui, ajouter »), vocabulaire de la charte (« fiche », « proches », « lien de parenté »), pas d'emoji. Anglais simple et chaleureux.
3. Ton et typographie, vérifiés par les tests (`src/tooling/typography.ts`) :
   - apostrophe ’ et guillemets « » ou “ ”, jamais ' ni " ; points de suspension … ; ni emoji ni « !! » ;
   - en français, pas de tutoiement : « tu », « te », « toi », « ton », « ta », « tes » et « t’ » sont refusés. Le contrôle est volontairement large (« le ton » serait refusé) : reformulez ;
   - en français, espace insécable avant ; : ! ? » et après « : fine (U+202F, de préférence) ou normale (U+00A0). C'est plus strict que les exemples de la charte, et voulu : à 200 %, un « ? » ne doit jamais passer seul à la ligne. Les adresses web (`https://…`, `mailto:…`, `www.…`) et les heures (« 14:05 ») ne sont pas concernées. Le test nomme la clé et le signe en cause. Dans le JSON, l'espace fine s'écrit telle quelle ou `\u202f`.
4. Lancez la génération, qui met à jour les types et marque le texte « à relire » dans `review/` :

   ```sh
   corepack pnpm --filter @lignee/i18n generate
   ```

5. Utilisez la clé : `t('common:actions.invite')`. Une clé inconnue, un paramètre manquant ou de mauvais type ne compile pas.
6. `corepack pnpm --filter @lignee/i18n test` vérifie que chaque clé existe dans les deux langues avec les mêmes paramètres ICU, que les types et la relecture sont à jour, et la typographie.

Un nouvel espace de noms : créez les deux fichiers, puis ajoutez-le à `namespaces` et à `resources` dans `src/resources.ts` (un test compare la liste aux fichiers).

## Paramètres, pluriels, dates

Syntaxe ICU. Noms de paramètres en anglais, en camelCase ; certains noms sont réservés par i18next (`context`, `lng`, `ns`, `defaultValue`…) et refusés à la génération. Pas de balises (`<b>`) dans les messages.

```json
{
  "tree": { "personJoined": "{name} a rejoint l’arbre." },
  "people": { "count": "{count, plural, =0 {Aucune personne} one {# personne} other {# personnes}}" }
}
```

```ts
t('common:tree.personJoined', { name: person.usualName });
t('common:people.count', { count: 3 }); // « 3 personnes », « 1 234 personnes »
```

Attention au pluriel : en français, 0 et 1,5 sont au singulier (« one ») ; en anglais, au pluriel. Prévoyez `=0` quand « aucun » se dit autrement.

Pour une date ou un nombre hors d'un message, formatez-le avec `translator.format`, puis passez le texte en paramètre :

| Fonction | Français | Anglais |
| --- | --- | --- |
| `format.number(1234.5)` | 1 234,5 | 1,234.5 |
| `format.calendarDate({ year: 1968 })` | 1968 | 1968 |
| `format.calendarDate({ year: 1968, month: 3, day: 1 })` | 1er mars 1968 | March 1, 1968 |
| `format.dateTime(new Date())` | 12 mars 2026 à 14:05 | March 12, 2026 at 2:05 PM |
| `format.plural(0)` | one | other |

`calendarDate` sert aux dates d'état civil, souvent partielles, sans fuseau ; `dateTime` aux instants (envoi, synchronisation), dans le fuseau de l'appareil.

## Changer de langue (CPT-12)

```ts
const translator = createTranslator({ language: resolveLanguage(deviceLanguages) });
await translator.changeLanguage('en'); // tout l'écran suit, sans redémarrer
const unsubscribe = translator.subscribe((language) => saveProfileLanguage(language));
```

Dans React : `useSyncExternalStore(translator.subscribe, () => translator.language)` redessine les écrans au changement de langue. Une langue d'appareil non prise en charge donne le français.

## Relecture par un locuteur natif (ACC-05)

```sh
corepack pnpm --filter @lignee/i18n review:count            # relus et à relire, par langue
corepack pnpm --filter @lignee/i18n review:count --strict   # échoue s'il reste un texte à relire
```

Le relecteur valide un message en remplaçant son entrée dans `review/<langue>.json` par `{ "status": "reviewed", "text": "<le texte relu, à l'identique>" }`. Si le texte change ensuite, la génération le repasse « à relire ». La relecture elle-même se fait dans T-107.

## Pour l'app mobile

Hermes ne fournit pas toujours tout Intl. L'app charge, avant le premier texte, les polyfills de FormatJS (`getCanonicalLocales`, `Locale`, `PluralRules`, `NumberFormat`, `DateTimeFormat` avec tous les fuseaux) pour `fr` et `en`, chacun seulement si le moteur en a besoin : `apps/mobile/src/intl/polyfills.ts`. Son test remplace tout Intl par FormatJS et vérifie les formats de ce paquet. Écart relevé : avec les données de FormatJS, `formatDateTime` donne « 1er mars 2026, 14:05 » au lieu de « 1er mars 2026 à 14:05 » (ICU de Node). Pour un texte identique partout, il faudra composer la date et l'heure par un message.
