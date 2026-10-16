# 0009 — Conventions de la date floue

Date : 16 octobre 2026 · Statut : proposée (T-005)

## Contexte

Le TRD (« Modèle de données ») décrit la date floue : « qualificatif (exacte, vers, avant, après, entre, calculée, texte), précision (jour, mois, année, décennie), une ou deux bornes, le texte d'origine et le calendrier ; une colonne de tri en est déduite ». Le PRD (VOX-14) demande qu'une date calculée soit marquée approximative ; CL-DON-07 (calendrier hégirien, conversion pour le tri) est V2. Le cahier ne dit ni où placer chaque date dans le tri, ni comment comparer des dates de précisions différentes, ni quels calendriers existent, ni comment se fait le calcul à partir d'un âge. T-005 (`packages/domain/src/fuzzy-date.ts`) a besoin de ces règles.

## Décision proposée

1. **Forme** : union discriminée sur `qualifier` (`exact`, `about`, `before`, `after`, `calculated`, `between`, `text`). Les cinq qualificatifs à une borne ont `date` ; `between` a `from` et `to`. La forme `text` de T-004 (`{ qualifier: 'text', originalText }`) reste une branche, sans précision ni calendrier. Les autres branches ont `precision`, `calendar` (grégorien par défaut) et un `originalText` facultatif : une date choisie dans un sélecteur n'a pas de texte d'origine.
2. **Une seule précision par date** : les deux bornes de « entre » ont la précision de la date (« entre mars 1935 et 1940 » se garde en texte, ou à la précision la plus grossière). Une borne a une année de 1 à 9999 ; un mois si la précision est le mois ou le jour ; un jour si elle est le jour, et ce jour existe. Une décennie s'écrit par sa première année (1940 pour « les années 1940 »).
3. **« Entre »** : deux bornes ordonnées et distinctes ; des bornes égales sont refusées (c'est une date exacte).
4. **Calendriers** : `gregorian` et `hijri` (cité par CL-DON-07). Sans conversion en V1 : un jour hégirien est admis jusqu'au 30 de tout mois, et une date non grégorienne n'a pas de place dans le tri.
5. **Étendue nominale** (`fuzzyDateSpan`) : du premier au dernier jour de la borne (ou des deux bornes) ; « avant X » finit la veille du début de X, « après X » commence le lendemain de sa fin. « Vers » et « calculée » prennent l'étendue de leur borne, sans marge : la marge relève des contrôles de cohérence (T-007).
6. **Clé de tri** (`fuzzyDateSortKey`), chaîne comparée code par code (collation « C » en base) : `0:AAAAA-MM-JJ:R:P:Q`, plus `:AAAAA-MM-JJ` (dernier jour) pour « entre ».
   - Le jour retenu est dans l'étendue nominale : premier jour pour exacte, vers, calculée, entre ; dernier jour possible pour « avant » ; premier jour possible pour « après ». Conséquence vérifiée par des tests de propriétés : une date qui finit avant qu'une autre commence passe avant.
   - Au même jour : « après » en tête, « avant » en dernier ; entre les deux, de la précision la plus grossière à la plus fine, puis exacte, calculée, vers, entre (le plus court d'abord). Ainsi « 1940 » passe avant « 14 juillet 1940 », et « années 1940 » avant « 1940 ».
   - Texte libre et autre calendrier : `1`, après toute date grégorienne ; date absente : `2`. Entre eux, un tri stable garde l'ordre d'arrivée.
   - Deux dates grégoriennes ont la même clé si et seulement si elles disent la même chose (texte d'origine mis à part).
   - La clé n'est pas stockée dans l'objet échangé : le serveur (T-042) et la base du téléphone la calculent à l'écriture avec la même fonction.
7. **Calcul depuis un âge** (`birthDateFromAge`, VOX-14) : « mort à 80 ans en 2010 » donne une date `calculated`, à l'année, 2010 − 80 = 1930, dans le calendrier de la référence. La vraie naissance est en 1929 ou 1930 ; la date est marquée approximative (toute date autre qu'exacte l'est). Pas de calcul depuis un texte, une décennie, « avant », « après » ou « entre » : la date dite est gardée telle quelle.
8. **Affichage** (`describeFuzzyDate`) : une structure sans aucun mot (point, intervalle ou texte, avec précision, calendrier et indicateur d'approximation) ; les mots viennent de `packages/i18n`.
9. **Approximation** (`isApproximate`) : toute date est approximative sauf une date exacte, quelle que soit sa précision. Une décennie exacte (« dans les années 1940 », dite sans réserve) n'est donc pas marquée approximative, pas plus que « 1940 » exacte à l'année : la précision dit l'étendue de ce que l'on sait, le qualificatif dit si on en est sûr. « Vers les années 1940 » s'écrit `about` à la décennie, et l'est. Écarté : marquer approximative toute décennie, ce qui confondrait précision et incertitude et rendrait « années 1940 » et « vers les années 1940 » indiscernables à l'affichage.

## Écarté

- Clé de tri au milieu de l'étendue (« 1940 » au 1er juillet) : moins lisible, et « 1940 » passerait après « mars 1940 ».
- Précision propre à chaque borne : plus souple, mais le TRD parle d'une précision par date.
- Placer une date hégirienne à une année grégorienne approximative dès la V1 : c'est la conversion de CL-DON-07, V2.
- Clé stockée dans l'objet : elle pourrait diverger de la date qu'elle résume.

## Conséquences

- T-007 bâtit ses alertes (mère plus jeune que sa fille, enfant né après la mort du père) sur `fuzzyDateSpan`, en ajoutant sa marge aux dates approximatives.
- T-042 ajoute la colonne de tri, calculée par `fuzzyDateSortKey`, en collation « C ».
- La V2 (CL-DON-07) donnera une place aux dates hégiriennes ; leur clé changera, la forme de l'objet non.
- T-066 (voix) produit des dates de ce schéma et appelle `birthDateFromAge`.
