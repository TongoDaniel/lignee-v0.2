# 0029 — Fiche d'une personne : contenu de la V1, ancien prénom, cause de décès

Date : 25 octobre 2026 · Statut : proposée (T-024 du plan V1) · À relire par gardien-confidentialite ; les points 1 et 3 sont à confirmer par Daniel

## Contexte

T-024 affiche la fiche d'une personne. Le PRD (UNI-01, UNI-14, UNI-17, UNI-22) dit quoi montrer ; il ne dit pas tout :

- la charte (OngletsFiche) donne à la fiche trois rubriques, Souvenirs, Documents, Santé ; en V1, Mémoire (V2) et Santé (V3) n'existent pas (ADR 0015) ;
- le PRD ne dit nulle part que la cause de décès s'affiche sur la fiche : UNI-15 en fait une donnée de santé, visible de son seul auteur, absente de l'arbre, des notifications et des exports ;
- le PRD ne dit pas qui « a droit » à un ancien prénom (UNI-22 ; README de `packages/domain`, point ouvert de T-052) ; les relectures de T-021 et de T-052 excluent le propriétaire, le responsable de branche et l'administrateur ;
- la base locale ne garde pas le lien entre le compte du lecteur et sa fiche (CPT-06) ; elle ne garde que `readerAccountId`.

## Décision

1. **Pas d'onglets de fiche en V1.** La fiche est une page qui défile : en-tête (avatar, nom, titres, « Jumeaux »), puis des cartes (identité, vie, lieux de vie, profession, noms, notes). `ProfileTabs` n'y est pas monté : un onglet Souvenirs, Documents ou Santé vide promettrait ce que la V1 ne tient pas, comme pour la barre principale (ADR 0015). Ils arrivent avec la V2 (Souvenirs, Documents) et la V3 (Santé, après l'analyse d'impact, l'audit du chiffrement et l'avis juridique).
2. **La cause de décès ne s'affiche pas sur la fiche.** `buildProfile` ne la lit jamais, même pour son auteur : un test le prouve en lui donnant une cause saisie par le lecteur. Elle reste une donnée de santé ; son affichage relève du calque santé (V3). Si Daniel veut qu'elle s'affiche à son seul auteur sur la fiche, il suffit de l'ajouter à `buildProfile` avec une `MentionPrivee` de santé, après relecture de gardien-confidentialite.
3. **Ancien prénom.** Une seule fonction décide : `canViewFormerName(name, viewer)` (`packages/domain/src/profile.ts`). Elle ouvre l'ancien prénom à son auteur, et à la personne concernée si le lecteur donne sa propre fiche (`viewer.ownPersonId`, jamais fournie en V1, faute de lien compte-fiche sur le téléphone). Ni le propriétaire de l'arbre, ni un responsable de branche, ni un administrateur n'y ont droit en tant que tels. T-052 remplacera cette fonction par la règle de visibilité du nom (cible `name`) ; la seconde barrière de `packages/sync/src/local-db/snapshot.ts` refuse déjà l'ancien prénom d'un autre auteur, de sorte que même la « personne concernée » ne le reçoit pas tant que T-052 n'a pas ouvert la règle. L'ancien prénom affiché porte la mention « Visible par vous seul ».
4. **Le nom affiché** vient d'une seule fonction, `chooseDisplayName`, qui écarte d'abord tout nom `former`. Règle : un nom en cours (sans date de fin) passe avant un nom terminé, le plus récemment terminé si tous le sont ; à égalité, nom d'usage, nom de naissance, surnom, variante, titre ; à égalité encore, ordre de saisie. Le surnom sert de nom quand il est seul (CL-FAM-17) ; les noms successifs datés donnent le nom du moment (CL-FAM-18). L'ordre prénom-nom suit le réglage de l'arbre (CL-DON-01). La teinte de l'avatar suit le nom de famille du nom de naissance (ADR 0022), jamais un prénom : l'ancien prénom ne colore pas la fiche.
5. **Où vit la logique.** `buildProfile` est dans `@lignee/domain` (décisions sans mot, testées par les scénarios) ; `readProfile` dans `@lignee/sync` lit la copie locale (`readTreeSnapshot`) pour son lecteur ; les mots viennent de `packages/i18n` ; l'écran (`apps/mobile`) n'affiche que le résultat. La route est `/person/<identifiant>` (`profileRoute` dans `apps/mobile/src/navigation/profileRoute.ts`), avec `?treeId=` facultatif.
6. **Naissance multiple.** Les enfants absents de la copie locale en sont retirés (`projectMultipleBirth`) : « Jumeaux » ne s'affiche plus quand le seul autre enfant est masqué, et les rangs sont renumérotés pour ne pas trahir une lacune.
7. **Date de naissance d'une personne présumée vivante** : mention « Visible par l'arbre « … » » (cercle famille de MentionPrivee), parce que la valeur par défaut du TRD rend une personne visible de tout l'arbre. Si le cercle par défaut change (T-052, CON-04), la mention suit.

## Conséquences

- La fiche ne montre pas encore les parents, les conjoints ni les enfants : ils demandent de présenter des liens (certitude, type, ADR 0021) et relèvent de la saisie et de « Qui est-ce pour moi ? » (T-029, T-031).
- Chaque ouverture relit tout l'arbre de la copie locale (`readTreeSnapshot`), pour rester dans la copie filtrée sans requête de plus. Pour 5 000 personnes, la lecture se fait après le premier dessin (« Ouverture de la fiche… »). À mesurer sur l'Android de référence ; si elle dépasse le budget, une lecture ciblée (la personne, ses noms, ses faits, ses titres, sa naissance multiple) s'ajoute dans `packages/sync` sans changer `buildProfile`.
- Les dates de noms et de titres saisies en texte (scénarios) ne se trient pas ; l'ordre reste celui de la saisie jusqu'à ce que T-031 produise de vraies dates floues.

- Les dates floues composées (« vers années 1940 ») et le calendrier hégirien sont rendus au plus simple (année seule en hégirien) ; leur rendu complet est fait par T-031 (ADR 0032, points 1 et 2).

## Écarté

- **Afficher la cause de décès à son auteur sur la fiche** : le PRD ne le demande pas, et c'est une donnée de santé.
- **Choisir le nom dans l'écran** : deux endroits décideraient du nom, dont un pourrait un jour montrer un ancien prénom.
- **Un onglet Santé grisé** : voir ADR 0015.
