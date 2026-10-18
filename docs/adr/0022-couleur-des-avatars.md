# 0022 — Règle de couleur des avatars : nom de naissance ou branche

Date : 18 octobre 2026 · Statut : proposée (T-015) · À trancher par Daniel

## Contexte

Deux textes décrivent la couleur d'un avatar sans photo, et ils ne disent pas la même chose :

- la charte (`docs/charte/03-couleurs.md`, « Couleurs des personnes ») : la teinte « dépend du nom de naissance. Toutes les personnes nées Diallo partagent une teinte, toutes les personnes nées Lefèvre une autre. L'app la calcule à partir du nom de naissance (somme des codes de caractères, modulo 6, dans l'ordre vert, or, lagon, lilas, ciel, terre) » ;
- l'exigence ARB-12 du PRD : « Une branche garde sa couleur sur tous les écrans », « par branche, selon la règle de la charte ».

Le plan V1 (section 4, doute n° 3) le relève. La différence compte : dans une famille où les femmes gardent leur nom de naissance, ou après une adoption ou un remariage, les membres d'une même branche (la descendance d'un même parent) ont des noms différents ; et deux branches qui n'ont aucun lien peuvent porter le même nom (deux familles Diallo).

## Décision proposée (par défaut, en attendant Daniel)

Appliquer la règle de la charte : la teinte se calcule à partir du **nom de naissance**. C'est la règle écrite, testable sans le serveur, stable hors ligne et identique sur tous les écrans, et elle ne dépend pas de la structure de l'arbre (qui change à chaque ajout de filiation).

Précision : le nom est d'abord normalisé (espaces autour retirés, accents composés, minuscules) avant la somme des codes, pour que « Diallo », « DIALLO » et « diallo » donnent la même teinte. La charte ne le dit pas, mais elle promet que toutes les personnes nées Diallo partagent une teinte ; sans normalisation, une saisie en capitales la romprait. Le test de référence le prouve (`packages/ui/src/components/avatarTint.test.ts`).

La règle est isolée dans `packages/ui/src/components/avatarTint.ts` : une fonction `defaultAvatarTintRule({ birthName, branchId? })` qui renvoie une des six teintes. L'avatar et le nœud de l'arbre l'appellent ; aucun écran ne calcule de teinte. L'avatar accepte aussi une prop `tint` qui impose une teinte, pour le cas d'un écran qui appliquerait une autre règle.

## Options

| Option | Effet | Coût |
| --- | --- | --- |
| A. Nom de naissance (charte, retenue par défaut) | Les personnes qui partagent un nom partagent une teinte, où qu'elles soient dans l'arbre. Deux branches distinctes du même nom ont la même teinte. | Aucun : implémentée. |
| B. Identifiant de branche | Tous les membres d'une branche partagent une teinte, quel que soit leur nom. Il faut définir la branche d'une personne qui appartient à plusieurs (union entre deux branches, adoption). Une personne peut changer de teinte si l'arbre change. | Une table de branches fiable sur le téléphone (T-012 et la synchronisation), une règle pour les personnes en plusieurs branches, une mise à jour de la charte et de ARB-12. |
| C. Mixte : branche, avec repli sur le nom de naissance | Comme B, sans teinte indéfinie. | Les coûts de B plus une règle à expliquer à la famille. |

Passer de A à B ou C : remplacer le corps de `defaultAvatarTintRule` (l'entrée porte déjà un `branchId` facultatif) et mettre à jour la charte. Les écrans et les composants ne changent pas.

## Conséquences

- ARB-12 est satisfaite au sens de la charte : une personne garde la même teinte sur tous les écrans, puisque la teinte ne dépend que de son nom de naissance. Si Daniel retient B ou C, ARB-12 prend son sens littéral et le test change avec la règle.
- La teinte ne porte aucun sens (ni genre, ni santé, jamais de corail) quelle que soit l'option.
- Le choix change l'aspect de l'arbre que les familles pilotes verront : à valider avec elles.
