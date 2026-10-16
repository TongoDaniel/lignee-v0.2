# 0008 — Compléments au modèle de données

Date : 16 octobre 2026 · Statut : proposée (T-004)

## Contexte

T-004 traduit le modèle de données du TRD en schémas Zod (`packages/domain`). Le PRD demande des données que le tableau des tables du TRD ne range nulle part (titres et rôles datés, UNI-17 ; jumeaux et naissances multiples, UNI-14), et certaines règles de confidentialité supposent des champs que le tableau ne cite pas (« cause de décès, son auteur » suppose de connaître l'auteur).

## Décision proposée

1. **Titres et rôles datés** : une table à part, `titres_roles` (`titleRoleSchema`) : personne, libellé libre (Fon, Lamido, successeur désigné… ne se traduisent pas), début et fin en dates floues, lieu, notes. Ce n'est pas un nom de type « titre » (appellation portée comme un nom), ni un fait (un fait n'a qu'une date, un titre a une période).
2. **Naissances multiples** : une table `naissances_multiples` et ses membres (`multipleBirthSchema`) : au moins deux personnes distinctes, ordre de naissance facultatif et sans doublon. « Jumeaux » se déduit du nombre de membres.
3. **Cause de décès** : un fait distinct, de type `death_cause`, séparé du fait `death` (date, lieu). Il porte ainsi sa propre règle de visibilité (CON-03) sans masquer le décès lui-même.
4. **Auteur** : `authorAccountId` obligatoire sur les faits, les noms et les règles de visibilité. C'est le « son auteur » de la cause de décès et le « moi » de « moi seul ».
5. **Ancien prénom** : un nom de type `former`. Qui « y a droit » n'est pas écrit dans le cahier. Proposition, à trancher dans T-052 avec gardien-confidentialite : par défaut, l'auteur du nom seulement ; une règle explicite l'ouvre à d'autres.
6. **Statut vital** saisi : `living`, `deceased`, `unknown` (par défaut `unknown`). « Présumée vivante » reste un calcul (T-007).
7. **Valeurs par défaut des schémas**, limitées aux valeurs « non renseigné » du cahier : genre et type d'union `unspecified`. La certitude d'un lien n'a pas de valeur par défaut. Le réglage « carte activée » non plus : il se décide à la création de l'arbre (T-048, T-050).
8. **Identifiants** : UUIDv7 en minuscules seulement, générateur strictement croissant (compteur de la RFC 9562).
9. **Conjoints dans l'union** : le schéma porte les deux conjoints dans l'union (`spouses`, un couple exact). La table `conjoints_union` du TRD reste la forme stockée (T-042) ; l'API et la synchro échangent l'union entière.

## Écarté

- Titres et naissances multiples comme faits libres (`other`) : ni période, ni lien entre les fiches des jumeaux.
- Cause de décès comme champ du fait `death` : une seule règle de visibilité pour le décès et sa cause, contraire à UNI-15.
- Valeur par défaut « carte activée » : non écrite dans le cahier, et l'origine régionale est une donnée sensible (CON-13).

## Conséquences

- Le schéma Prisma (T-042) ajoute `titres_roles`, `naissances_multiples` et leurs membres, et la colonne d'auteur.
- T-052 applique les valeurs par défaut de la cause de décès et de l'ancien prénom (`packages/domain/README.md`).
- T-005 remplace la date floue minimale de `packages/domain/src/fuzzy-date.ts`, sans toucher aux autres schémas.
