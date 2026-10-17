# 0015 — Onglets de la V1

Date : 17 octobre 2026 · Statut : proposée (T-011)

## Contexte

La charte (`docs/charte/components/BarreOnglets/README.md`) fixe la navigation principale : « Quatre onglets, toujours dans cet ordre » : Arbre, Famille, Santé, Mémoire. Le README de la charte reprend la même barre.

Le PRD répartit ces fonctions sur plusieurs versions :

- **Santé** : tout le calque santé est en V3 (SAN-01 à SAN-13), après l'analyse d'impact, l'audit du chiffrement et l'avis juridique. CLAUDE.md interdit de l'implémenter avant.
- **Mémoire** : « Elle arrive en V2, une fois l'arbre solide ». Seule la photo de profil (MEM-01) est en V1, et elle vit sur la fiche d'une personne, pas dans un onglet.
- **Arbre** et **Famille** (membres, invitations, rôles) sont en V1.

Le doute n° 5 du découpage (`docs/plan/v1-decoupage.md`) pose la question.

## Décision

- En V1, la barre d'onglets n'a que **deux onglets : Arbre, puis Famille**. Un onglet vide ou grisé pour Santé ou Mémoire serait une promesse que la V1 ne tient pas, et un « Santé » visible avant l'accord explicite (SAN-01) inquiéterait sans raison.
- Les règles de la charte restent appliquées à ces deux onglets : ordre, icônes de 28, libellés `legende`, couleurs active et inactive, symbole compact pour Arbre, profil ouvert depuis la photo en haut de l'écran.
- **V2** : Mémoire s'ajoute en dernière position (Arbre, Famille, Mémoire).
- **V3** : Santé s'insère à sa place, entre Famille et Mémoire, ce qui rétablit les quatre onglets de la charte. Il n'apparaît qu'une fois le calque santé livré ; le faut-il pour tous, ou seulement après l'activation du calque par la personne (SAN-01) ? Cette question se tranche à la V3, avec `gardien-confidentialite`.
- La liste vit dans `apps/mobile/src/navigation/tabs.ts`. Un test vérifie qu'en V1 il n'y a qu'Arbre et Famille, ni Santé ni Mémoire.

## Conséquences

- Avec deux onglets, chaque zone touchable est plus large que prévu par la charte ; à vérifier sur l'Android de référence (rien ne doit paraître vide).
- La charte décrit une barre à quatre onglets : on la complétera, avec Daniel, d'une note « barre de la V1 » quand la source vivante sur claude.ai sera mise à jour.

## Écarté

- **Quatre onglets dès la V1, Santé et Mémoire désactivés** : une fonction annoncée mais absente, et la santé montrée avant l'accord.
- **Un onglet Profil à la place** : la charte ouvre le profil depuis la photo en haut de l'écran, pas depuis la barre.
