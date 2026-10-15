# Couleurs

Lignée vit dans deux mondes. La **Nuit** (vert très sombre, or, crème) porte la marque : film, stores, réseaux, écran de lancement, livre de famille. Le **Jour** (gris-vert clair, blanc, vert profond) porte l’interface de l’app. Dans l’app, chaque couleur passe par un token sémantique qui a une valeur Jour et une valeur Nuit : n’écrivez jamais une valeur hexadécimale dans un écran.

## Palette de marque

| Couleur | Token | HEX | RVB | Usage |
| --- | --- | --- | --- | --- |
| Nuit 950 | `nuit-950` | #040A08 | 4, 10, 8 | Bords des visuels de marque, vignettage. |
| Nuit 900 | `nuit-900` | #0A1713 | 10, 23, 19 | Fond de marque (film, stores, réseaux) et fond de l’app en thème Nuit. |
| Nuit 800 | `nuit-800` | #10251D | 16, 37, 29 | Surfaces posées sur Nuit 900 (cartes du thème Nuit). |
| Forêt 700 | `foret-700` | #173A2D | 23, 58, 45 | Grands aplats de marque, couverture du livre de famille. |
| Forêt 600 | `foret-600` | #27463B | 39, 70, 59 | Filets et séparateurs sur fond Nuit. |
| Brume 300 | `brume-300` | #A9BCB2 | 169, 188, 178 | Texte secondaire sur Nuit (9.2:1). |
| Crème 50 | `creme-50` | #F3ECE0 | 243, 236, 224 | Texte et logotype sur Nuit (15.6:1). |
| Or 300 | `or-300` | #FFE3A6 | 255, 227, 166 | Mots en valeur sur Nuit (citations, signature). |
| Or 500 | `or-500` | #F2B84B | 242, 184, 75 | Le doré de marque : symbole, action principale sur Nuit. Jamais sur fond clair (1.6:1). |
| Or 700 | `or-700` | #C98A22 | 201, 138, 34 | Ombre du doré dans les visuels de marque. Pas pour du texte. |
| Sauge 300 | `sauge-300` | #A9D18E | 169, 209, 142 | Accent vert sur Nuit : succès, avatars verts du thème Nuit. |
| Corail 400 | `corail-400` | #F2876B | 242, 135, 107 | Santé sur Nuit. |
| Lagon 400 | `lagon-400` | #62C6B8 | 98, 198, 184 | Mémoire et voix sur Nuit. |

Les valeurs CMJN et Pantone se fixent avec l’imprimeur au premier tirage (livre de famille, cartes), sur épreuve : ne les convertissez pas à la main.

### Proportions

![Proportions de la marque](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NjAgOTAiIHdpZHRoPSI5NjAiIGhlaWdodD0iOTAiPjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI1NzYuMCIgaGVpZ2h0PSI5MCIgZmlsbD0iIzBBMTcxMyIvPjx0ZXh0IHg9IjE0IiB5PSIzMCIgZm9udC1mYW1pbHk9Ikluc3RydW1lbnQgU2FucywgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiNGM0VDRTAiPk51aXQ8L3RleHQ+PHRleHQgeD0iMTQiIHk9IjU0IiBmb250LWZhbWlseT0iSW5zdHJ1bWVudCBTYW5zLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI0YzRUNFMCI+NjAgJTwvdGV4dD48cmVjdCB4PSI1NzYuMCIgeT0iMCIgd2lkdGg9IjE5Mi4wIiBoZWlnaHQ9IjkwIiBmaWxsPSIjMTczQTJEIi8+PHRleHQgeD0iNTkwLjAiIHk9IjMwIiBmb250LWZhbWlseT0iSW5zdHJ1bWVudCBTYW5zLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI0YzRUNFMCI+Rm9yw6p0PC90ZXh0Pjx0ZXh0IHg9IjU5MC4wIiB5PSI1NCIgZm9udC1mYW1pbHk9Ikluc3RydW1lbnQgU2FucywgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNGM0VDRTAiPjIwICU8L3RleHQ+PHJlY3QgeD0iNzY4LjAiIHk9IjAiIHdpZHRoPSIxMzQuNCIgaGVpZ2h0PSI5MCIgZmlsbD0iI0YzRUNFMCIvPjx0ZXh0IHg9Ijc4Mi4wIiB5PSIzMCIgZm9udC1mYW1pbHk9Ikluc3RydW1lbnQgU2FucywgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMwQTE3MTMiPkNyw6htZTwvdGV4dD48dGV4dCB4PSI3ODIuMCIgeT0iNTQiIGZvbnQtZmFtaWx5PSJJbnN0cnVtZW50IFNhbnMsIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMEExNzEzIj4xNCAlPC90ZXh0PjxyZWN0IHg9IjkwMi40IiB5PSIwIiB3aWR0aD0iNTcuNTk5OTk5OTk5OTk5OTk0IiBoZWlnaHQ9IjkwIiBmaWxsPSIjRjJCODRCIi8+PHRleHQgeD0iOTE2LjQiIHk9IjMwIiBmb250LWZhbWlseT0iSW5zdHJ1bWVudCBTYW5zLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iIzBBMTcxMyI+T3I8L3RleHQ+PHRleHQgeD0iOTE2LjQiIHk9IjU0IiBmb250LWZhbWlseT0iSW5zdHJ1bWVudCBTYW5zLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzBBMTcxMyI+NiAlPC90ZXh0Pjwvc3ZnPg==)

Sur un visuel de marque : environ 60 % de Nuit, 20 % de Forêt, 14 % de Crème, 6 % d’Or. L’or ne dépasse jamais un mot, un symbole ou une action.

![Proportions de l’interface](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NjAgOTAiIHdpZHRoPSI5NjAiIGhlaWdodD0iOTAiPjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI0OTkuMiIgaGVpZ2h0PSI5MCIgZmlsbD0iI0VFRjJGMCIgc3Ryb2tlPSIjQzlEM0NFIiBzdHJva2Utd2lkdGg9IjAiLz48dGV4dCB4PSIxMiIgeT0iMzAiIGZvbnQtZmFtaWx5PSJJbnN0cnVtZW50IFNhbnMsIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMTUyMTFEIj5HcmlzIDUwPC90ZXh0Pjx0ZXh0IHg9IjEyIiB5PSI1NCIgZm9udC1mYW1pbHk9Ikluc3RydW1lbnQgU2FucywgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMxNTIxMUQiPjUyICU8L3RleHQ+PHJlY3QgeD0iNDk5LjIiIHk9IjAiIHdpZHRoPSIyODguMCIgaGVpZ2h0PSI5MCIgZmlsbD0iI0ZGRkZGRiIgc3Ryb2tlPSIjQzlEM0NFIiBzdHJva2Utd2lkdGg9IjEiLz48dGV4dCB4PSI1MTEuMiIgeT0iMzAiIGZvbnQtZmFtaWx5PSJJbnN0cnVtZW50IFNhbnMsIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMTUyMTFEIj5CbGFuYzwvdGV4dD48dGV4dCB4PSI1MTEuMiIgeT0iNTQiIGZvbnQtZmFtaWx5PSJJbnN0cnVtZW50IFNhbnMsIEFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMTUyMTFEIj4zMCAlPC90ZXh0PjxyZWN0IHg9Ijc4Ny4yIiB5PSIwIiB3aWR0aD0iMTE1LjE5OTk5OTk5OTk5OTk5IiBoZWlnaHQ9IjkwIiBmaWxsPSIjMTUyMTFEIiBzdHJva2U9IiNDOUQzQ0UiIHN0cm9rZS13aWR0aD0iMCIvPjx0ZXh0IHg9Ijc5OS4yIiB5PSIzMCIgZm9udC1mYW1pbHk9Ikluc3RydW1lbnQgU2FucywgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiNGM0VDRTAiPkVuY3JlPC90ZXh0Pjx0ZXh0IHg9Ijc5OS4yIiB5PSI1NCIgZm9udC1mYW1pbHk9Ikluc3RydW1lbnQgU2FucywgQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNGM0VDRTAiPjEyICU8L3RleHQ+PHJlY3QgeD0iOTAyLjQwMDAwMDAwMDAwMDEiIHk9IjAiIHdpZHRoPSIzOC40IiBoZWlnaHQ9IjkwIiBmaWxsPSIjMUU1QTQ4IiBzdHJva2U9IiNDOUQzQ0UiIHN0cm9rZS13aWR0aD0iMCIvPjxyZWN0IHg9Ijk0MC44MDAwMDAwMDAwMDAxIiB5PSIwIiB3aWR0aD0iOS42IiBoZWlnaHQ9IjkwIiBmaWxsPSIjQTg2RTBGIiBzdHJva2U9IiNDOUQzQ0UiIHN0cm9rZS13aWR0aD0iMCIvPjxyZWN0IHg9Ijk1MC40MDAwMDAwMDAwMDAxIiB5PSIwIiB3aWR0aD0iOS42IiBoZWlnaHQ9IjkwIiBmaWxsPSIjQzQ1MTNBIiBzdHJva2U9IiNDOUQzQ0UiIHN0cm9rZS13aWR0aD0iMCIvPjwvc3ZnPg==)

Dans l’app : le gris-vert clair (52 %) et le blanc (30 %) font l’essentiel, l’encre le texte (12 %), le vert une action par écran (4 %), et les couleurs fonctionnelles restent des touches.

## Couleurs de l’interface

| Token | Jour | Nuit | Usage |
| --- | --- | --- | --- |
| `fond` | #EEF2F0 | #0A1713 | Fond des écrans. |
| `fond-carte` | #FFFFFF | #10251D | Cartes, feuilles, barre d’onglets, champs. |
| `texte` | #15211D | #F3ECE0 | Texte principal, sur `fond` et `fond-carte`. |
| `texte-secondaire` | #5C6A64 | #A9BCB2 | Sous-titres, métadonnées, onglets inactifs, sur `fond` et `fond-carte`. |
| `texte-discret` | #97A39D | #6F8C7F | Texte d’exemple dans un champ, état désactivé. Contraste insuffisant pour une information (2.6:1 en Jour). |
| `filet` | #DCE3DF | #27463B | Séparateurs de listes (décoratif). |
| `bordure-champ` | #789185 | #4A7363 | Contour des champs et des cases (3:1 sur `fond` et `fond-carte`). |
| `lien-arbre` | #789185 | #4A7363 | Traits qui relient les personnes dans l’arbre (3:1 sur `fond`). |
| `action` | #1E5A48 | #F2B84B | Bouton principal, onglet actif, liens. Une seule action principale par écran. |
| `sur-action` | #FFFFFF | #0A1713 | Texte et icônes posés sur `action` (8.0:1 en Jour, 10.3:1 en Nuit). |
| `action-douce` | #DCEBE4 | #3A2D12 | Fond teinté d’un élément sélectionné. |
| `focus` | #1E5A48 | #F2B84B | Anneau de focus clavier : 2 px de `fond`, puis 2 px de `focus` (7:1 au moins). |
| `voile` | #0A171352 | #000000A3 | Voile posé sous une feuille ou une fenêtre. |

En thème Nuit, l’action principale devient or (`action` = `or-500`) avec un libellé sombre (`sur-action` = `nuit-900`) : c’est le bouton de la marque. Ne posez jamais de texte blanc sur l’or.

## Couleurs fonctionnelles

Chaque couleur fonctionnelle a un sens et un seul. Elle ne porte jamais ce sens seule : une icône ou un mot l’accompagne toujours, pour les daltoniens et les lecteurs d’écran.

| Sens | Token | Jour | Nuit | Règle |
| --- | --- | --- | --- | --- |
| Agir | `action` | #1E5A48 | #F2B84B | Bouton principal, onglet actif, lien. Une seule action principale par écran. |
| Lien et célébration | `fete` | #A86E0F | #F2B84B | « Vous », anniversaires, chemin de parenté, bonne nouvelle. Texte : `fete-texte`. Fond : `fete-douce`. |
| Santé | `sante` | #C4513A | #F2876B | Le calque santé et ses données, toujours avec l’icône cœur. Texte : `sante-texte`. Fond : `sante-douce`. |
| Mémoire et voix | `memoire` | #1F8274 | #62C6B8 | Récits enregistrés, transcriptions, capsule temporelle. Texte : `memoire-texte`. Fond : `memoire-douce`. |
| Parenté | `parente` | #66579A | #B9ABEA | Puces de lien (« Sœur d’Odette »), propositions de modification à valider. Fond : `parente-douce`. |
| Documents | `documents` | #386796 | #93BDEB | Actes, photos, fichiers, imports. Fond : `documents-douce`. |
| Erreur | `erreur` | #A3261D | #FFB4AB | Champ invalide, action destructrice, toujours avec l’icône alerte et un texte. Fond : `erreur-douce`. |
| Succès | `succes` | #1E5A48 | #A9D18E | Confirmation, étape faite, toujours avec l’icône valider. |

Le corail est réservé à la santé. Une erreur n’est pas une question de santé : elle a son propre rouge (`erreur`), plus sombre en Jour et plus clair en Nuit, et toujours son icône alerte.

## Couleurs des personnes

Un avatar sans photo affiche l’initiale sur un fond teinté. La teinte ne porte aucun sens, elle aide seulement à lire les branches : elle dépend du nom de naissance. Toutes les personnes nées Diallo partagent une teinte, toutes les personnes nées Lefèvre une autre. L’app la calcule à partir du nom de naissance (somme des codes de caractères, modulo 6, dans l’ordre vert, or, lagon, lilas, ciel, terre). « Vous » a toujours l’avatar doré à silhouette.

| Teinte | Initiales (Jour / Nuit) | Fond (Jour / Nuit) |
| --- | --- | --- |
| Vert | `personne-vert` #1E5A48 / #A9D18E | `personne-vert-fond` #DCEBE4 / #1C3A2C |
| Or | `personne-or` #94610D / #F2B84B | `personne-or-fond` #FBEFD2 / #3A2D12 |
| Lagon | `personne-lagon` #1C7468 / #62C6B8 | `personne-lagon-fond` #D6EFEA / #123631 |
| Lilas | `personne-lilas` #66579A / #B9ABEA | `personne-lilas-fond` #E8E3F4 / #28233F |
| Ciel | `personne-ciel` #386796 / #93BDEB | `personne-ciel-fond` #DDE9F6 / #162C42 |
| Terre | `personne-terre` #7A5A35 / #D9B48A | `personne-terre-fond` #F3E9DC / #33281B |

Le corail ne sert pas aux avatars : il appartient à la santé. Quand le calque santé est actif, tous les avatars passent en neutre (`fond-carte`, initiales `texte-secondaire`) et seules les pastilles santé gardent leur couleur.

Jamais de bleu pour les hommes et de rose pour les femmes. Le genre ne se code pas par une couleur.

## Matières d’archive

| Matière | Token | HEX | Usage |
| --- | --- | --- | --- |
| Papier | `papier-200` | #EADFC6 | Papier d’archive : fiches recettes, lettres, actes scannés. |
| Papier ombré | `papier-300` | #DCCDAA | Ombre du papier d’archive. |
| Sépia | `sepia-600` | #8A6A44 | Encre sépia des archives. |
| Encre bleue | `encre-bleue-700` | #34456A | Encre bleue manuscrite des archives. |

Ces teintes habillent les objets de mémoire (fiche recette, lettre, acte scanné, capsule). Elles ne servent jamais à l’interface elle-même.

## Contrastes mesurés

Ratios WCAG 2 mesurés sur les fonds que nomme chaque note. Seuils : 4.5:1 pour un texte, 3:1 pour un élément graphique (bordure, trait, icône, anneau de focus).

| Couleur | Sur | Jour | Nuit | Seuil |
| --- | --- | --- | --- | --- |
| `texte` | `fond` | 14.7:1 | 15.6:1 | 4.5:1 |
| `texte` | `fond-carte` | 16.6:1 | 13.7:1 | 4.5:1 |
| `texte-secondaire` | `fond` | 5.0:1 | 9.2:1 | 4.5:1 |
| `texte-secondaire` | `fond-carte` | 5.7:1 | 8.1:1 | 4.5:1 |
| `texte-discret` | `fond` | 2.3:1 ✗ | 5.0:1 | 4.5:1 |
| `texte-discret` | `fond-carte` | 2.6:1 ✗ | 4.4:1 ✗ | 4.5:1 |
| `fete-texte` | `fond` | 4.7:1 | 10.2:1 | 4.5:1 |
| `fete-texte` | `fond-carte` | 5.3:1 | 9.0:1 | 4.5:1 |
| `fete-texte` | `fete-douce` | 4.6:1 | 7.5:1 | 4.5:1 |
| `sante-texte` | `fond` | 5.0:1 | 7.4:1 | 4.5:1 |
| `sante-texte` | `fond-carte` | 5.7:1 | 6.5:1 | 4.5:1 |
| `sante-texte` | `sante-douce` | 4.6:1 | 5.9:1 | 4.5:1 |
| `memoire-texte` | `fond` | 5.0:1 | 9.0:1 | 4.5:1 |
| `memoire-texte` | `fond-carte` | 5.6:1 | 7.9:1 | 4.5:1 |
| `memoire-texte` | `memoire-douce` | 4.6:1 | 6.4:1 | 4.5:1 |
| `parente` | `fond` | 5.5:1 | 8.8:1 | 4.5:1 |
| `parente` | `fond-carte` | 6.2:1 | 7.7:1 | 4.5:1 |
| `parente` | `parente-douce` | 4.9:1 | 7.2:1 | 4.5:1 |
| `documents` | `fond` | 5.2:1 | 9.4:1 | 4.5:1 |
| `documents` | `fond-carte` | 5.9:1 | 8.2:1 | 4.5:1 |
| `documents` | `documents-douce` | 4.8:1 | 7.3:1 | 4.5:1 |
| `erreur` | `fond` | 6.5:1 | 10.8:1 | 4.5:1 |
| `erreur` | `fond-carte` | 7.4:1 | 9.5:1 | 4.5:1 |
| `erreur` | `erreur-douce` | 6.1:1 | 9.0:1 | 4.5:1 |
| `sur-action` | `action` | 8.0:1 | 10.2:1 | 4.5:1 |
| `sur-fete` | `fete-forte` | 10.2:1 | 14.7:1 | 4.5:1 |
| `sur-notification` | `notification` | 16.6:1 | 15.6:1 | 4.5:1 |
| `personne-vert` | `personne-vert-fond` | 6.5:1 | 7.2:1 | 4.5:1 |
| `personne-or` | `personne-or-fond` | 4.6:1 | 7.5:1 | 4.5:1 |
| `personne-lagon` | `personne-lagon-fond` | 4.6:1 | 6.4:1 | 4.5:1 |
| `personne-lilas` | `personne-lilas-fond` | 4.9:1 | 7.2:1 | 4.5:1 |
| `personne-ciel` | `personne-ciel-fond` | 4.8:1 | 7.3:1 | 4.5:1 |
| `personne-terre` | `personne-terre-fond` | 5.2:1 | 7.4:1 | 4.5:1 |
| `bordure-champ` | `fond` | 3.0:1 | 3.4:1 | 3.0:1 |
| `bordure-champ` | `fond-carte` | 3.4:1 | 3.0:1 | 3.0:1 |
| `lien-arbre` | `fond` | 3.0:1 | 3.4:1 | 3.0:1 |
| `lien-arbre` | `fond-carte` | 3.4:1 | 3.0:1 | 3.0:1 |
| `focus` | `fond` | 7.1:1 | 10.2:1 | 3.0:1 |
| `focus` | `fond-carte` | 8.0:1 | 9.0:1 | 3.0:1 |
| `chemin` | `fond` | 3.8:1 | 10.2:1 | 3.0:1 |
| `chemin` | `fond-carte` | 4.3:1 | 9.0:1 | 3.0:1 |
| `fete` | `fond` | 3.8:1 | 10.2:1 | 3.0:1 |
| `fete` | `fond-carte` | 4.3:1 | 9.0:1 | 3.0:1 |
| `sante` | `fond` | 4.1:1 | 7.4:1 | 3.0:1 |
| `sante` | `fond-carte` | 4.6:1 | 6.5:1 | 3.0:1 |
| `memoire` | `fond` | 4.1:1 | 9.0:1 | 3.0:1 |
| `memoire` | `fond-carte` | 4.7:1 | 7.9:1 | 3.0:1 |

✗ : `texte-discret` ne passe pas le seuil d’un texte. C’est voulu : il ne sert qu’au texte d’exemple d’un champ et aux éléments désactivés, jamais à une information. Les filets (`filet`, `filet-fort`) sont décoratifs : un contour de champ utilise `bordure-champ`.

## Ce qu’on ne fait pas

- Écrire en or (`or-500`) sur un fond clair : utilisez `fete-texte`.
- Utiliser le corail pour autre chose que la santé.
- Porter un sens par la couleur seule : ajoutez toujours une icône ou un mot.
- Coder le genre, l’origine ou un statut familial par une couleur.
- Créer une nouvelle couleur dans un écran : ajoutez d’abord un token, avec sa valeur Nuit.
- Utiliser des dégradés dans l’interface. Les dégradés et les lueurs restent dans les visuels de marque.
