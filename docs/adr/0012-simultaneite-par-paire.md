# 0012 — Simultanéité des unions : déduction et réponse gardée par paire d'unions

Date : 17 octobre 2026 · Statut : proposée (T-007)

## Contexte

UNI-08 : « Unions simultanées ou successives : déduit des dates de début et de fin ; sans dates, Lignée pose la question une seule fois » ; critère : « La réponse est gardée et reste modifiable ». CL-POL-05 : « Une seule question, réponse modifiable ensuite ». Le TRD range la simultanéité dans la table `unions` (« Simultanéité déduite des dates, saisie sinon »), et T-004 l'avait mise sur l'union (`union.simultaneity`).

Une valeur par union, ou par conjoint d'une union, ne suffit pas :

- **Lévirat** : la même union est simultanée avec l'union du frère déjà marié, et successive avec le premier mariage de la veuve. Une valeur par union s'écrase d'une réponse à l'autre, et la question revient.
- **Foyers successifs** : « deux épouses en même temps, puis une troisième après leur mort » ne se dit pas avec une seule valeur par conjoint.
- **Chevauchement en chaîne** : u1 et u2 en même temps, u2 et u3 en même temps, u1 finie avant u3. Une valeur « simultanée » sur chaque union ferait lire u1 et u3 comme co-épouses, ce qui est faux.

Le cahier ne dit pas non plus ce que vaut une union sans date de fin.

## Décision proposée

1. **La réponse est gardée par paire d'unions** qui ont un conjoint en commun : `SimultaneityAnswer` (`simultaneityAnswerSchema`, `packages/domain/src/union.ts`) = identifiant, arbre, `unionIds` (les deux unions, plus petit identifiant d'abord), `simultaneity` (`simultaneous` ou `successive`). Une seule réponse par paire ; la modifier change sa valeur et garde son identifiant.
2. **Pas de personne dans la réponse.** Que deux unions se chevauchent est un fait sur leurs durées, le même pour chacun des conjoints. Une réponse par (personne, paire) permettrait deux réponses contradictoires pour le couple remarié (les deux unions relient les mêmes deux personnes). La personne n'intervient que dans la question : c'est à elle qu'on la pose.
3. **Écart au TRD et nouvelle table pour T-042** : la colonne « simultanéité » sort de la table `unions`. Nouvelle table `simultaneites_unions` : `id` (UUIDv7 créé sur le téléphone), `arbre`, `union_a`, `union_b` (avec `union_a < union_b`), `simultaneite` (`simultaneous`, `successive`), `version`. Contraintes : unique (`union_a`, `union_b`) ; les deux unions existent, dans le même arbre, et ont un conjoint en commun. Une union supprimée supprime ses réponses (cascade). Pas de règle de visibilité propre : une réponse n'est envoyée qu'à un lecteur qui voit les deux unions (sinon elle révélerait une union masquée) ; à ajouter aux objets dérivés de T-052.
4. **Les dates d'abord**, pour deux unions (`resolveSimultaneity(arbre, a, b)`) :
   - successives si l'une finit certainement au plus tard le jour où l'autre commence ;
   - simultanées si chacune commence certainement avant la fin la plus précoce possible de l'autre ;
   - sinon, la réponse gardée pour la paire ;
   - sinon, inconnues.
   Les dates sont lues avec les marges de l'ADR 0011. La fin d'une union est au plus tard la mort du premier conjoint qui meurt (fait de décès daté). Le début est avant la fin. Les dates priment sur la réponse gardée : une réponse contredite par des dates ajoutées ensuite reste stockée mais n'est plus lue.
5. **Une union sans date de fin n'est pas présumée en cours.** Sinon, un veuf remarié dont on n'a pas noté la mort de la première épouse serait affiché en polygame. Un foyer dont seules les dates de début sont connues reçoit donc la question ; une fois répondue, elle ne revient plus.
6. **Une seule question par personne** (`simultaneityQuestions`, `simultaneityQuestionFor`). Elle liste les unions de la personne en cause et chaque paire inconnue. Une paire déjà couverte par la question d'une autre personne (le couple remarié) n'est pas redemandée.
7. **La réponse donne une valeur à chaque paire.** L'écran garde une seule question et propose, du plus simple au plus fin :
   - « toutes en même temps » ou « l'une après l'autre » (`uniformPairAnswers`) ;
   - des foyers successifs (`pairAnswersFromHouseholds`) : des groupes d'unions simultanées qui se succèdent (`[[u1, u2], [u3]]`). C'est la saisie retenue par défaut, la plus simple pour « deux épouses ensemble, puis une troisième » ;
   - paire par paire, seule manière de dire un chevauchement en chaîne.
   `answerSimultaneity` garde les valeurs : il met à jour les paires déjà répondues et crée les autres.

## Écarté

- Valeur sur l'union (TRD, T-004) : la question revient dans le lévirat, le sororat et toute union entre deux personnes qui ont chacune d'autres unions.
- Valeur par conjoint d'une union (première version de cette ADR, relue « à corriger ») : ne dit ni les foyers successifs, ni le chevauchement en chaîne.
- Réponse par (personne, paire) : redondante (la paire désigne déjà les conjoints communs) et contradictoire possible pour un couple remarié.
- Foyers seulement : plus simple, mais le chevauchement en chaîne ne s'y dit pas. Les foyers restent une façon de saisir, convertie en valeurs par paire.
- Présumer en cours une union sans fin (voir point 5).

## Conséquences

- `unionSchema` n'a plus de champ `simultaneity` ; `spouseSchema` reste celui de T-004. `modelSchemas` reçoit `SimultaneityAnswer`.
- `TreeData` (outils de test) reçoit `simultaneityAnswers` ; `treeDataIssues` vérifie la paire (unions existantes, conjoint commun, une réponse par paire). Le générateur écrit une réponse par paire d'après le chevauchement réel des années, quand la question a été posée pour les deux unions.
- T-042 crée la table `simultaneites_unions` ; T-052 l'ajoute aux objets dérivés.
- T-060 et T-063 synchronisent cette entité, envoyée seulement à un lecteur qui voit les deux unions :
  - une mutation qui vise une union invisible pour son auteur reçoit la même erreur que les autres refus de droits, sans rien dire de l'union ;
  - quand une union masquée pour un lecteur est supprimée, ses réponses disparaissent en cascade sans qu'aucune trace de suppression ne lui parvienne ;
  - les réponses entrent dans les tests de non-fuite (CL-SEC-01).
- T-008 (foyers) lit `resolveSimultaneity(arbre, a, b)`. L'arbre fournit `unions`, `facts` et `simultaneityAnswers`. Il n'y a plus de paramètre « personne ».
- T-032 et T-065 posent la question avec `simultaneityQuestionFor` et gardent la réponse avec `answerSimultaneity`.
