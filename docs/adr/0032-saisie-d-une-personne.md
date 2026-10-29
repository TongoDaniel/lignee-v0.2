# 0032 — Saisie à la main d'une personne : dates par morceaux, lieux en texte, ancien prénom, suppression

Date : 29 octobre 2026 · Statut : proposée (T-031 du plan V1) · À relire par gardien-confidentialite ; les points 4 et 5 sont des questions de produit pour Daniel

## Contexte

T-031 crée, modifie et supprime une personne à la main. Le PRD (UNI-01, UNI-15, CAR-01) et les cas limites (CL-POL-15, CL-DON-01, 02, 05, 06, CL-FAM-12, 17, 18, 19) disent quoi permettre ; ils ne disent ni comment saisir une date floue, ni quoi faire d'un lieu écrit deux fois, ni comment éviter qu'un ancien prénom soit rangé comme nom de naissance (relecture de T-024, obligation C2).

## Décision

1. **Dates par morceaux.** Une date se saisit par un choix (inconnue, précise, « vers », « avant », « après », « entre deux dates », en toutes lettres), puis année, mois, jour (deux fois pour « entre »), avec deux interrupteurs : « années entières » (décennie) et calendrier hégirien. Aucune phrase n'est analysée : le domaine (`parseDateDraft`, `packages/domain/src/person-entry.ts`) n'a aucun mot d'une langue. Les refus sont des codes (année manquante, bornes inversées, précisions différentes…), rangés sur le champ de la borne en cause. La date « calculée » n'est jamais proposée mais reste intacte si on ne la touche pas.
2. **Composition française des dates.** « Vers années 1940 » est corrigé : une décennie se dit « vers les années 1940 », « avant les années 1940 », « entre les années 1930 et les années 1940 » (EN : « around the 1940s »). Le calendrier hégirien est écrit une seule fois pour toute la date, avec mois et jour en chiffres (« 14/3/1431 (calendrier hégirien) »). Ceci complète l'ADR 0029.
3. **Lieux en texte (CAR-01).** Un lieu est un texte libre. Un lieu déjà dans l'arbre (même texte, à la casse et aux espaces près) est réutilisé, sinon un lieu est créé dans le même lot. Aucune permission, aucun module de position : un test échoue si l'un d'eux apparaît dans la configuration, les dépendances ou le code.
4. **Ancien prénom, question de produit.** À la saisie, quand la fiche dit déjà quelque chose d'une transition (un ancien prénom, ou un genre renseigné), qu'un nom de naissance a des prénoms et qu'un autre nom en cours porte d'autres prénoms, l'écran propose de ranger le prénom de naissance en `former` (« visible par vous seul »). C'est une question, jamais un changement d'office ; la réponse « non » ne se repose pas. J'ai ajouté la condition « un autre prénom en cours » à la lettre de l'obligation (genre renseigné ou ancien prénom) : sans elle, la question reviendrait pour presque toute fiche. Le nom de famille de naissance reste un nom de naissance à part. Le type « Ancien prénom » est toujours proposé, avec sa mention.
5. **« Nom de naissance : À compléter ».** Cette ligne de la fiche n'est pas une action, et elle n'est plus affichée à qui voit un ancien prénom (`buildProfile` : `birthNameMissing` faux), pour ne pas l'inviter à y saisir l'ancien prénom en `birth`. Un lecteur qui ne voit aucun ancien prénom la lit comme pour toute personne sans nom de naissance. À confirmer par Daniel.
6. **Cause de décès (UNI-15).** Saisie dans le formulaire (avec « Visible par vous seul » et le rappel qu'elle n'apparaît ni dans l'arbre, ni dans les notifications, ni dans les exports), toujours créée au nom du rédacteur, relue dans le formulaire de son seul auteur, et jamais affichée sur la fiche (ADR 0029, point 2). Repasser à « en vie » ou « je ne sais pas » ne l'envoie pas.
7. **Un lot par validation.** Le formulaire produit une liste de changements (lieux, fiche, noms, faits, titres) pour `recordLocalChanges` : un lot, hors ligne. En modification, seuls les champs changés sont envoyés ; un nom, un fait ou un titre retiré du formulaire est supprimé. Les refus se rangent sur le champ par leur chemin `mutations[i].fields.X`, via le rang des changements du formulaire : `person_without_name` désigne le premier champ de nom. Aucune correction de `packages/sync` n'a été nécessaire pour l'affichage (le formulaire connaît la mutation de chaque champ) ; `coherence_refusal` et `invalid_simultaneity_answer` ne se produisent pas dans ce formulaire.
8. **Alertes de cohérence avant d'écrire.** `previewCoherence` (@lignee/sync) applique les changements en mémoire et lance `checkPersonDates` sur la copie du lecteur ; l'écran montre les alertes et propose « Enregistrer malgré tout » (ADR 0027, point 5).
9. **Suppression.** `planPersonDeletion` liste en un seul lot la fiche, ses noms, faits (dont ceux de ses unions et les reconnaissances de ses liens), titres, liens de filiation et de candidature, unions et réponses « simultanées ou successives », places « À placer ». Ce qui cite aussi d'autres personnes est corrigé et non supprimé : l'union d'origine d'une filiation d'un autre, une naissance multiple qui garde deux enfants, le « n'est pas » d'une place à compléter. L'écran demande confirmation (action irréversible) et liste ce qui part avec la fiche. Aucun contrôle de droit n'existe encore (T-052, T-056).
10. **Rebond léger.** Le rebond de la charte pour une personne qui apparaît dans l'arbre n'est pas fait ici : l'écran revient à l'arbre, qui relit la copie (`useLocalChangeVersion`). Il revient à T-018 ou T-033, avec la vibration légère de la charte.

## Conséquences

- Accès : un bouton « Ajouter une personne » sur l'onglet Arbre (`TreeScreen`), « Modifier la fiche » sur la fiche. T-018 devra l'intégrer à sa barre (une seule action principale par écran).
- `Chip` reçoit `selected` (puce de choix, rôle `radio`, coche) et `Field` accepte `error: undefined` ; à répercuter dans le README de la charte (Puce).
- Chaque saisie relit l'arbre entier de la copie locale (ADR 0027) ; à mesurer sur l'Android de référence.
- La partie `saisie` des scénarios est jouée par domain (dates, découpage) et sync (formulaires enregistrés pour de bon).
- Rendu non vérifié sur émulateur ni téléphone (issue « À vérifier sur téléphone »).

## Écarté

- **Analyser « vers 1940 » tapé en phrase** : dépend de la langue, et la voix (T-058) a son propre analyseur.
- **Poser la question de l'ancien prénom pour tout genre renseigné** : trop fréquente, et elle désigne les personnes trans.
- **Un bouton « Compléter » sur « Nom de naissance : À compléter »** : invite à saisir l'ancien prénom en `birth`.
- **Géolocalisation pour les lieux** : refusé par CAR-01.
