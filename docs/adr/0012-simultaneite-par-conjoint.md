# 0012 — Simultanéité des unions : déduction et réponse gardée par conjoint

Date : 16 octobre 2026 · Statut : proposée (T-007)

## Contexte

UNI-08 : « Unions simultanées ou successives : déduit des dates de début et de fin ; sans dates, Lignée pose la question une seule fois » ; critère : « La réponse est gardée et reste modifiable ». CL-POL-05 : « Une seule question, réponse modifiable ensuite ». Le TRD range la simultanéité dans la table `unions` (« Simultanéité déduite des dates, saisie sinon »), et T-004 l'a mise sur l'union (`union.simultaneity`).

Une valeur par union ne suffit pas. Dans un lévirat, la même union est simultanée pour le frère déjà marié et successive pour la veuve, qui avait un premier mari. Avec une valeur par union, répondre pour la veuve écrase la réponse donnée pour le frère, la question du frère revient, et « une seule fois » n'est plus tenu. Le cahier ne dit pas non plus ce que vaut une union sans date de fin.

## Décision proposée

1. **La réponse est gardée par conjoint** : `spouses[i].simultaneity` (`simultaneous`, `successive`, absente tant que la question n'a pas été posée) dit la place de cette union parmi les autres unions de ce conjoint. Le champ `union.simultaneity` de T-004 est retiré. En base (T-042), la colonne va dans `conjoints_union`, pas dans `unions` : écart au tableau du TRD.
2. **Déduction des dates d'abord**, pour deux unions d'une même personne (`resolveSimultaneity`) :
   - successives si l'une finit certainement au plus tard le jour où l'autre commence ;
   - simultanées si chacune commence certainement avant la fin la plus précoce possible de l'autre ;
   - sinon, inconnues.
   Les dates sont lues avec les marges de l'ADR 0011. La fin d'une union est au plus tard la mort du premier conjoint qui meurt (fait de décès daté). Le début est avant la fin.
3. **Une union sans date de fin n'est pas présumée en cours.** Sans date de fin, rien ne dit qu'elle a duré : un veuf remarié dont on n'a pas noté la mort de la première épouse serait affiché en polygame. Conséquence : un foyer polygame dont seules les dates de début sont connues reçoit la question ; une fois répondue, elle ne revient plus.
4. **Les dates priment sur la réponse gardée** : une réponse contredite par des dates ajoutées ensuite n'est plus lue (elle reste stockée).
5. **Lecture de la réponse** pour deux unions d'une personne : simultanées si ses deux réponses disent « simultanée », successives si l'une dit « successive », inconnues s'il en manque une. Pour un couple remarié (mêmes deux conjoints), la réponse de l'un vaut pour l'autre.
6. **Une seule question par personne** (`simultaneityQuestions`) : elle couvre toutes ses unions dont une paire reste inconnue ; une paire déjà couverte par la question d'une autre personne n'en crée pas une deuxième. Répondre (`answerSimultaneity`) écrit la réponse sur chacune de ces unions, du côté de cette personne ; répondre de nouveau la remplace.

## Écarté

- Garder la valeur sur l'union (TRD, T-004) : la question revient dans le lévirat, le sororat et toute union entre deux personnes qui ont chacune d'autres unions.
- Une valeur par paire d'unions : exact, mais une table de plus et des paires à maintenir à chaque ajout d'union.
- Une valeur par personne (« les unions de Fon sont simultanées ») : ne dit pas qu'un homme a eu deux épouses en même temps puis une troisième après leur mort.
- Présumer en cours une union sans fin (voir point 3).

## Conséquences

- T-004 (`union.ts`) : `spouseSchema` reçoit `simultaneity` ; `unionSchema` le perd. Le générateur (T-006) écrit la réponse du côté de chaque conjoint.
- T-042 (schéma Prisma) met la colonne dans `conjoints_union`.
- T-008 (foyers) lit `resolveSimultaneity` pour ranger les foyers ; T-032 et T-065 posent la question avec `simultaneityQuestionFor` et gardent la réponse avec `answerSimultaneity`.
- Si cette ADR est refusée, on revient à la valeur par union, et la limite du lévirat est documentée dans CL-POL-05.
