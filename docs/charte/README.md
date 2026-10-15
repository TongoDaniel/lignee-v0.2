Lignée est une app d’arbre généalogique pour toute la famille, de 15 à 95 ans. On y construit l’arbre à plusieurs, on garde la mémoire (voix, photos, recettes, documents) et on note, en privé, les antécédents de santé utiles au médecin. Signature : **« Votre famille, enfin visible. »**

L’identité tient en deux mondes. La **Nuit** (vert très sombre et or) porte la marque : film, stores, réseaux, écran de lancement. Le **Jour** (gris-vert clair, blanc, vert profond) porte l’interface de l’app. L’app a aussi un thème Nuit, construit avec les mêmes tokens.

Les sections suivantes détaillent chaque sujet : plateforme de marque, logo, couleurs, typographie, iconographie, arbre, mouvement, ton, accessibilité, applications, mise en œuvre React Native.

## Les dix règles

1. Posez chaque écran sur `fond` et chaque bloc sur `fond-carte`, avec `ombre-carte` et `rayon-carte`.
2. Écrivez en `texte`, et tout ce qui est secondaire en `texte-secondaire`. N’utilisez jamais `texte-discret` pour une information : il ne sert qu’au texte d’exemple d’un champ et aux états désactivés.
3. Une seule action principale par écran : un bouton pilule `action` avec son libellé en `sur-action`.
4. Le corail (`sante`, `sante-texte`, `sante-douce`) est réservé à la santé, toujours accompagné de l’icône `sante` ou `sante-plein`. Rien d’autre n’est corail.
5. L’or (`fete`, `fete-texte`, `fete-douce`, `chemin`) marque le lien et la célébration : la personne « Vous », les anniversaires, le chemin de parenté. Il reste rare.
6. La couleur d’un avatar ne porte aucun sens : elle suit la branche familiale (`personne-vert`, `personne-or`, `personne-lagon`, `personne-lilas`, `personne-ciel`, `personne-terre`). Ne codez jamais le genre par une couleur.
7. Les titres de marque sont en Fraunces Lignee (`display`, `titre-1`, `titre-2`, `citation`). Toute l’interface est en Instrument Sans. La Belle Aurore (`manuscrit`) ne sert qu’aux objets de mémoire.
8. Le texte courant fait au moins 17 px (`corps`) et les zones touchables au moins 48 px (`cible-tactile`), 56 px en mode Aînés (`cible-tactile-aines`).
9. Toute information privée affiche qui peut la voir : icône `prive` et la mention « Visible par vous seul » (composant MentionPrivee).
10. Écrivez au vouvoiement, en phrases courtes, avec le verbe de l’action sur chaque bouton.

## Contenu et ton

- Vouvoyez toujours, y compris les aînés et les plus jeunes. Le « vous » vaut aussi pour la personne qui utilise l’app dans l’arbre : son nœud s’appelle « Vous ».
- Mettez les titres, boutons et onglets en casse de phrase : « Ajouter quelqu’un », « Inviter vos proches ».
- Un bouton commence par un verbe : « Ajouter », « Inviter », « Enregistrer », « Oui, ajouter ». Une confirmation dit ce qui s’est passé : « Lucienne a rejoint l’arbre », « Antécédent enregistré, en privé ».
- Une erreur dit ce qui ne va pas et comment le corriger, sans s’excuser : « Ce fichier n’est pas un arbre GEDCOM. Exportez votre arbre au format .ged, puis réessayez. »
- Parlez de santé sans alarmer : « C’est une information à évoquer avec votre médecin, pas un diagnostic. »
- Nommez les liens de parenté exactement : « cousin issu de germain », « grand-tante », « demi-frère ».
- Pas d’emoji. Pas de point d’exclamation, sauf pour féliciter.
- Respectez la typographie française : espace insécable avant « : ; ? ! » et à l’intérieur des « guillemets », apostrophe typographique ’, années « 1934 – 2011 », heures « 14 h 30 ».

## Fondations visuelles

- **Couleur.** Jour : `fond` (#EEF2F0), `fond-carte` (#FFFFFF), `texte` (#15211D), `action` (#1E5A48). Nuit : `fond` (#0A1713), `fond-carte` (#10251D), `texte` (#F3ECE0), `action` (#F2B84B). N’écrivez jamais en or sur un fond clair : utilisez `fete-texte`.
- **Typographie.** Échelle de 15 styles en trois groupes (Éditorial, Interface, Manuscrit). Les polices sont dans `fonts/` en WOFF2 ; le kit contient les TTF pour l’app.
- **Espacement.** Grille de 4 px (`espace-1` à `espace-16`). Marge des écrans `marge-ecran` (16 px), marge intérieure des cartes `espace-5` (20 px), écart entre cartes `espace-4`.
- **Rayons.** Tout ce qui se touche est en pilule (`rayon-pilule`) : boutons, puces, interrupteurs, toasts. Champs `rayon-champ` (16 px), cartes `rayon-carte` (22 px), feuilles `rayon-feuille` (32 px).
- **Bordures.** `filet` et `filet-fort` sont décoratifs. Le contour d’un champ ou d’une case est `bordure-champ`, épais de 1.5 px (`trait-champ`), et passe à 2.5 px en `focus` quand le champ est actif.
- **Ombres.** Douces et basses : `ombre-carte` pour les cartes, `ombre-flottante` pour les toasts et notifications, `ombre-feuille` pour les feuilles. Pas d’ombre sur les boutons.
- **États.** Focus clavier : 2 px de `fond`, puis 2 px de `focus`. Appuyé : le bouton se réduit à 97 % pendant 120 ms. Désactivé : opacité `opacite-desactive` (0.4) et aucune ombre. Sélectionné : fond `action-douce`.
- **Images.** De vraies photos de famille, aux coins `rayon-carte` ou `rayon-s`. Pas de filtre sépia sur une photo récente ; les vieilles photos gardent leurs tons d’origine. Les objets d’archive (actes, lettres, recettes) se posent sur `papier-200`.
- **Mouvement.** Court et doux : 120 ms au toucher, 240 ms pour une transition, 360 ms pour une feuille. L’arbre « pousse » depuis la personne « Vous ». Rien ne rebondit dans la santé ni la confidentialité.
- **Mise en page.** Une colonne, un titre d’écran (`titre-ecran`) en haut à gauche, la barre d’onglets en bas (Arbre, Famille, Santé, Mémoire).

## Iconographie

- Utilisez le jeu d’icônes Lignée (groupe Icônes) : grille de 24 px, trait de 2 px (`trait-icone`), extrémités et jonctions arrondies. Les fichiers sont dessinés en `encre-900` (#15211D) : recolorez-les dans le code.
- Une icône est au trait, sauf quatre icônes pleines : `sante-plein` (une donnée de santé existe), `lieu`, `lecture` et `pause`.
- Couleur d’une icône : `texte` par défaut, `action` quand elle est active, la couleur fonctionnelle quand elle porte un sens (`sante` pour le cœur, `memoire` pour le micro d’un récit, `fete` pour l’anniversaire).
- L’onglet Arbre utilise le symbole Lignée en version compacte, pas une icône d’arbre générique.
- S’il manque une icône, dessinez-la dans la même grille. À défaut, prenez-la dans Lucide (même construction : 24 px, trait 2 px, bouts ronds) et signalez-la à l’équipe.
- Pas d’emoji dans l’interface.

## Logo

- Le logo principal est horizontal : symbole et logotype « Lignée ». Sur fond Nuit, symbole or et logotype crème (`lignee-logo-horizontal-nuit.svg`). Sur fond clair, symbole vert et logotype encre (`lignee-logo-horizontal-jour.svg`).
- Le symbole n’est jamais or sur un fond clair (1.6:1). Il n’est jamais recoloré hors de l’or, du vert, de la crème, de l’encre, du noir ou du blanc.
- Sous 48 px, utilisez le symbole compact (`lignee-symbole-compact-*.svg`), au trait plus épais.
- Laissez autour du logo un espace libre égal à la moitié du rayon de l’anneau.

## Composants

- **Bouton** : pilule de 56 px, une variante principale par écran.
- **Puce** : un ou deux mots de lien ou de statut (« Papa », « Sœur d’Odette »).
- **Carte** : bloc blanc posé sur `fond`.
- **Champ** : libellé au-dessus, boîte de 56 px, contour `bordure-champ`.
- **Interrupteur** : pour activer une option (calque santé, option Cousins).
- **OngletsFiche** : Souvenirs, Documents, Santé dans la fiche d’une personne.
- **BarreOnglets** : la navigation principale.
- **EnTete** : titre d’écran, sous-titre, action.
- **Avatar** : initiale sur fond teinté, photo, ou silhouette dorée pour « Vous ».
- **NoeudArbre** : une personne dans l’arbre, avec ses états.
- **LigneReglage** : une ligne de réglage avec icône et chevron.
- **Toast** : confirmation brève en pilule sombre.
- **Feuille** : panneau qui monte du bas pour une tâche courte.
- **Notification** : bannière système de l’app.
- **MentionPrivee** : qui peut voir une information.
