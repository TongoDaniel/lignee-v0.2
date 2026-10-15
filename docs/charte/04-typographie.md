# Typographie

Trois familles, trois rôles. **Fraunces Lignee** donne la voix de la marque : chaleureuse, un peu ancienne, jamais solennelle. **Instrument Sans** porte toute l’interface : nette, lisible en petit, sans froideur. **La Belle Aurore** imite l’écriture à la main et ne sert qu’aux objets de mémoire.

| Famille | Fichiers | Rôle |
| --- | --- | --- |
| Fraunces Lignee | `FrauncesLignee-Display` (540), `FrauncesLignee-Italic` (460) | Titres de marque, noms sur les fiches, citations |
| Instrument Sans | `InstrumentSans-Regular` (400), `-Medium` (500), `-SemiBold` (600), `-Bold` (700) | Toute l’interface |
| La Belle Aurore | `LaBelleAurore-Regular` (400) | Fiches recettes, dédicaces, capsule temporelle |

Fraunces Lignee est une instance fixe de Fraunces, la police variable du film : axe de taille optique opsz 96, graisse 540, rondeur SOFT 40, WONK 0. L’italique est à opsz 96, graisse 460, SOFT 40. Les trois familles sont sous licence SIL Open Font License 1.1 : usage, intégration dans l’app et diffusion libres, vente seule de la police interdite.

## Échelle

| Style | Famille | Taille / interligne | Graisse | Exemple | Usage |
| --- | --- | --- | --- | --- | --- |
| `display-xl` | Fraunces Lignee | 64 / 68 | 540 | Votre famille, enfin visible. | Affiches, stores, site, réseaux. Jamais dans l’interface de l’app. |
| `display` | Fraunces Lignee | 40 / 46 | 540 | Bienvenue dans Lignée | Écrans d’accueil et d’introduction de l’app ; une fois par écran. |
| `titre-1` | Fraunces Lignee | 30 / 36 | 540 | Moussa Diallo | Nom sur la fiche d’une personne, titres de la Mémoire et du livre de famille. |
| `titre-2` | Fraunces Lignee | 24 / 30 | 540 | Recettes de famille | Titres de rubrique dans la Mémoire et le livre. |
| `citation` | Fraunces Lignee | 20 / 28 | 460 italique | « J’avais 19 ans quand j’ai pris le bateau à Dakar. » | Citations d’aînés, dédicaces, mots mis en valeur dans un titre. |
| `titre-ecran` | Instrument Sans | 30 / 36 | 700 | Mon arbre | Titre en haut de chaque écran. |
| `titre-section` | Instrument Sans | 22 / 28 | 700 | Ajouter un antécédent | Titre d’une feuille, d’une section ou d’une fenêtre. |
| `titre-carte` | Instrument Sans | 17 / 22 | 600 | Mariage de Samuel et Claire | Titre d’une carte ou d’une ligne de liste. |
| `corps` | Instrument Sans | 17 / 24 | 400 | Lignée remplit la fiche. Vérifiez-la, puis touchez « Oui, ajouter ». | Texte courant. Jamais en dessous de 17. |
| `bouton` | Instrument Sans | 17 / 20 | 600 | Oui, ajouter | Libellés de boutons et d’onglets de fiche. |
| `secondaire` | Instrument Sans | 15 / 20 | 400 | Née en 1934 · Lyon | Sous-titres, dates, lieux, métadonnées. |
| `etiquette` | Instrument Sans | 14 / 18 | 500 | Âge au diagnostic | Libellés de champs, étiquettes, puces. |
| `legende` | Instrument Sans | 13 / 16 | 500 | Arbre · Famille · Santé · Mémoire | Libellés de la barre d’onglets, horodatages. Taille minimale de l’app. |
| `surtitre` | Instrument Sans | 12 / 16 | 600, capitales espacées | LIGNÉE · MAINTENANT | Surtitres en capitales espacées (notifications, chapitres). |
| `manuscrit` | La Belle Aurore | 26 / 34 | 400 | Pour mes petits-enfants, | Fiches recettes, dédicaces, capsule. Jamais pour un nom propre (pas de ŋ ni de vietnamien). |

Les tailles sont en points (iOS) et en dp (Android). Elles suivent le réglage de taille de texte du téléphone : ne bloquez jamais l’agrandissement du texte.

## Règles

- Un écran de l’app a un seul titre en Fraunces au plus (`display` ou `titre-1`). Le reste de l’interface est en Instrument Sans.
- Le texte courant (`corps`) ne descend jamais sous 17. La plus petite taille de l’app est `legende` (13), réservée à la barre d’onglets et aux horodatages.
- Pour mettre un mot en valeur dans un titre de marque, passez-le en Fraunces italique : en `or-300` sur Nuit, en `fete-texte` sur Jour. Jamais en gras, jamais souligné.
- Casse de phrase partout. Les capitales espacées (`surtitre`) ne servent qu’aux surtitres de quelques mots.
- Alignez le texte à gauche. Le centré est réservé aux écrans d’accueil et aux visuels de marque.
- Pas plus de 65 caractères par ligne dans un texte long (aide, guide, livre).
- Le nom d’une personne s’écrit comme elle l’écrit elle-même : « N’Diaye », « Nguyễn Thị Hoa », « Łucja ». Ne retirez jamais un accent ou une lettre que la police ne connaîtrait pas : laissez la police de secours du système l’afficher.

## Typographie française

| Règle | Exemple |
| --- | --- |
| Espace insécable avant : ; ? ! | Un nom vous manque ? Laissez la place vide. |
| Guillemets français avec espaces insécables | « Oui, ajouter » |
| Apostrophe typographique | l’arbre, aujourd’hui (jamais l'arbre) |
| Points de suspension en un caractère | Je vous écoute… |
| Années d’une vie : tiret demi-cadratin espacé | Odette Lefèvre, 1931 – 2019 |
| Dates en toutes lettres | Née le 12 mars 1931 à Lyon |
| Heures | 14 h 30 |
| Milliers séparés par une espace insécable | 1 234 personnes |
| Majuscules accentuées | État civil, À propos, Île-de-France |
| Abréviations | n° (pas no), env., 2e génération (pas 2ème) |

Dans le code, utilisez l’espace insécable U+00A0. L’espace fine insécable U+202F n’est pas affichée correctement par toutes les polices de secours.

## Langues et écritures

Couverture vérifiée des polices sur les caractères des langues des familles de Lignée :

| Langue | Fraunces Lignee | Instrument Sans | La Belle Aurore |
| --- | --- | --- | --- |
| Français, anglais, espagnol, italien, allemand, portugais | oui | oui | oui |
| Wolof (ë, ñ, ŋ) | oui | oui | non (ŋ absent) |
| Polonais, tchèque, roumain, turc | oui | oui | en partie |
| Vietnamien | oui | non | non |
| Arabe, chinois, amharique, tamoul… | non | non | non |

Quand un caractère manque, iOS et Android affichent le glyphe avec une police du système : c’est le comportement voulu. Pour cette raison, La Belle Aurore ne sert jamais à écrire un nom propre.

## Mode Aînés

Le mode Aînés (Profil › Affichage) multiplie toutes les tailles par 1,3, en plus du réglage du téléphone, et passe les zones touchables à 56. Les interlignes suivent la même proportion. Vérifiez chaque écran à 130 % et à 200 % : aucun texte ne doit être tronqué, les lignes passent à la ligne et les cartes s’allongent.
