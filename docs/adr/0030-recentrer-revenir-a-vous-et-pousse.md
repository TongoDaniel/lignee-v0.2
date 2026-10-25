# 0030 — Recentrer l'arbre, revenir à « Vous » et le faire pousser : choix que le cahier ne fixe pas

Date : 25 octobre 2026 · Statut : proposée (T-018, plan V1)

## Contexte

T-018 (plan V1) ajoute à l'arbre dessiné par T-017 le retour à « Vous » en une touche (ARB-09), le recentrage sur n'importe quelle personne avec un fil d'Ariane (ARB-09), et la pousse de l'arbre à l'ouverture avec le réglage « Réduire les animations » respecté (ARB-13). Le PRD fixe ces exigences ; la charte (`07-mouvement.md`) fixe les durées, les courbes et le principe « les traits partent de Vous vers le haut, puis les avatars apparaissent génération par génération (décalage de 60 ms) ». L'ADR 0025 (point 11) laisse « Vous » à `chooseCenter` tant que T-048 et T-050 n'existent pas.

## Décision proposée

1. **Recentrer, c'est refaire la disposition.** La personne choisie devient la personne centrale de `layoutTree` (les foyers repartent de leurs choix par défaut) et prend la place de « Vous » au lancement : en bas, au centre, à l'échelle standard (`bottomCenterFrame`). « Vous » garde son avatar doré partout où il est dessiné (`youId`, distinct de la personne centrale). Le retour à « Vous » est le même geste, vers `model.centerId`, et vide le fil d'Ariane.
2. **Toucher une personne ne recentre pas.** Le toucher sélectionne la personne (et ouvrira sa fiche, T-024/T-025). Le recentrage passe par un bouton « Recentrer » qui nomme la personne pour le lecteur d'écran, au dessin comme en liste (ACC-06). Raison : une même touche ne peut pas ouvrir la fiche et déplacer tout le dessin.
3. **Fil d'Ariane** : « Vous », puis les personnes sur lesquelles on a recentré, au plus quatre après « Vous ». Chaque étape est un bouton ; revenir à une étape raccourcit le fil jusqu'à elle. Pas de séparateur dessiné : la charte n'a pas d'icône de chevron et le texte en dur est interdit.
4. **Où vit la logique** : fonctions pures sans Skia dans `apps/mobile/src/tree/` (`treeFrames.ts`, `treeMotion.ts`, `trail.ts`), testées dans Jest. `packages/layout` n'est pas modifié : il ne connaît pas les jetons de mouvement.
5. **Pousse** (`planGrowth`) : durées et courbes des jetons `motion` (trait : `arbre` 600 ms, entrée-sortie ; personne : `transition` 240 ms, sortie ; décalage entre générations : `decalageGeneration` 60 ms). Les traits partent de la personne centrale, rangée après rangée, dans le sens qui les éloigne d'elle ; les personnes apparaissent en fondu une demi-durée de trait plus tard, la personne centrale d'emblée. Un foyer qui s'ouvre ne fait pousser que ce qui est nouveau, depuis sa pastille ; un foyer qui se replie disparaît d'un coup. Un seul temps écoulé (valeur partagée de Reanimated) pilote tout ; chaque élément en déduit son avancement par la courbe de Bézier du jeton (`appearance`, worklet).
6. **Réduire les animations** : aucune pousse (`planGrowth` rend `undefined`) et aucun déplacement animé du cadre (`framePlan`). **Écart à `07-mouvement.md`** : la charte demande de remplacer les déplacements par un fondu de 150 ms ; T-018 les remplace par un changement d'un coup, comme T-017 le faisait déjà pour le zoom, parce que l'exigence ARB-13 est « aucun mouvement animé » et que l'arbre « s'affiche directement ». Le jeton `fonduReduit` n'est pas utilisé.
7. **Recentrage sans trajet animé** : la disposition entière change, il n'y a pas de trajet entre deux dispositions ; le cadre arrive d'un coup et l'arbre pousse. Le retour au cadre de « Vous » quand la disposition est déjà celle de « Vous » est animé (240 ms, entrée-sortie) sauf réglage contraire.
8. **Pas de rebond léger** : la charte le réserve à « un nouvel ajout » dans l'arbre. Aucun ajout n'existe encore dans l'écran (T-031 à T-033 et T-079) ; il faudra l'ajouter au premier ticket qui fait apparaître une personne nouvelle. Aucune courbe de rebond n'est utilisée ici.

## Conséquences

- T-048 et T-050 remplacent `chooseCenter` : rien à changer ici, `model.centerId` est la seule source de « Vous ».
- T-024 et T-025 branchent `onOpenPerson` ; le bouton « Recentrer » pourra aussi figurer sur la fiche.
- Mesures sur l'Android de référence à faire par Daniel (issue #34) : fluidité de la pousse sur 500 personnes, absence de clignotement au recentrage, rendu des traits qui se tracent (y compris les pointillés d'un lien supposé).
