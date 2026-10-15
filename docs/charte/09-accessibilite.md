# Accessibilité et mode Aînés

Lignée doit se lire et se toucher sans effort à 90 ans, avec une vue fatiguée, des doigts moins précis, ou un lecteur d’écran. Ces règles ne sont pas des options.

## Les seuils

| Sujet | Règle | Token |
| --- | --- | --- |
| Contraste du texte | 4.5:1 au moins sur son fond, dans les deux thèmes | `texte`, `texte-secondaire`, `*-texte` |
| Contraste des éléments graphiques | 3:1 au moins (contour de champ, trait de l’arbre, icône qui porte un sens, anneau de focus) | `bordure-champ`, `lien-arbre`, `focus` |
| Taille du texte courant | 17 au minimum | `corps` |
| Plus petite taille | 13, pour la barre d’onglets et les horodatages | `legende` |
| Zone touchable | 48 × 48 au minimum, 56 en mode Aînés | `cible-tactile`, `cible-tactile-aines` |
| Écart entre deux zones touchables | 8 au minimum | `espace-2` |

## Ce que l’on vérifie sur chaque écran

- Le texte suit la taille choisie dans le téléphone, jusqu’à 200 % sans troncature : les lignes passent à la ligne, les cartes s’allongent, rien ne se chevauche.
- Aucune information ne passe par la couleur seule : une icône ou un mot accompagne toujours la couleur (santé, erreur, succès, chemin de parenté).
- Chaque élément touchable a un libellé pour le lecteur d’écran, en français : « Ajouter votre mère », pas « Bouton plus ». Une photo a une description : « Mariage de Samuel et Claire, 1994 ».
- L’ordre de lecture suit l’ordre visuel. Dans l’arbre, le lecteur d’écran annonce : « Claire Martin, votre mère, née en 1968 ».
- Le focus clavier est visible : 2 px de `fond`, puis 2 px de `focus`.
- Les animations respectent le réglage « Réduire les animations ».
- Les messages vocaux et les récits ont une transcription.

## Le mode Aînés

Il s’active dans Profil › Affichage, ou au premier lancement si la personne le choisit.

- Toutes les tailles de texte sont multipliées par 1,3, en plus du réglage du téléphone.
- Les zones touchables passent à 56.
- Le mode simplifié garde trois actions sur l’écran d’accueil : voir l’arbre, écouter et enregistrer un récit, regarder les photos. Les autres fonctions restent dans le menu.
- Les confirmations restent affichées jusqu’à ce que la personne les ferme.
- Le micro est proposé partout où l’on peut écrire.

## Mise en œuvre

- iOS et Android : laissez `allowFontScaling` actif. Limitez `maxFontSizeMultiplier` à 2 seulement sur les éléments qui doivent tenir sur une ligne (barre d’onglets).
- Donnez `accessibilityLabel`, `accessibilityRole` et `accessibilityState` à chaque composant touchable.
- Testez avec VoiceOver et TalkBack, en mode Aînés, et avec le texte du téléphone au maximum.
