# 0034 — Normalisation des noms, clé phonétique et termes indexables

Date : 30 octobre 2026 · Statut : proposée (T-034, plan V1) · Les points 3, 5 et 6 sont à confirmer par Daniel ; le reste est technique et appliqué

## Contexte

T-034 (plan V1) prépare la recherche hors-ligne (T-038) et le score de doublon (T-040). Le TRD (Recherche) fixe :

- **Index** : « tous les noms (naissance, usage, surnoms, variantes, titres) […] normalisés avant l'indexation : minuscules, sans accents, sans apostrophes ni traits d'union » ;
- **Clé phonétique** : « une clé maison, pensée pour le français et les noms camerounais (« ou » et « u », « c », « k » et « q », « tch » et « ch », lettres doublées, finales muettes) […] Elle rapproche « Nkoulou » et « Nkulu », ou « Biyong » et « Biyon » ; elle est testée sur une liste de noms réels fournie par les familles pilotes » ;
- **Fautes de frappe** : Jaro-Winkler sur les formes normalisées ;
- **Classement** : exact, puis début de mot, puis phonétique, puis approché.

ARB-10 attend que « Ngo Biyong », « ngo biyon » et « Biyong » trouvent la même personne, en moins de 300 ms hors-ligne pour 5 000 personnes. CL-DON-03 garde la particule « Ngo » dans le nom et retrouve la personne sans elle ; CL-DON-04 garde les signes diacritiques et la recherche les ignore. L'ADR 0023 interdit à l'index de contenir une cause de décès ou l'ancien prénom d'un autre auteur.

Le cahier ne dit pas : quelles particules, quelles équivalences exactement, ce que devient un ancien prénom saisi par le lecteur lui-même, ni combien de temps peut prendre la construction de l'index. La liste de noms réels des familles pilotes n'existe pas encore (doute de la section 4 du plan) : les règles sont écrites et testées sur des noms générés.

## Décision

Code : `packages/domain/src/name-search.ts`, fonctions pures sans dépendance (téléphone et serveur).

1. **Normalisation** (`normalizeNameText`, technique). Dans l'ordre : décomposition NFKD, minuscules, NFKD encore (une lettre de compatibilité comme « ℌ » se décompose en majuscule ; « İ » devient « i » et un point) ; retrait de tous les signes combinants (accents, tons, cédille) ; lettres que la décomposition ne ramène pas au latin de base : celles de l'alphabet général des langues camerounaises (ɛ → e, ɔ → o, ŋ → ng, ə et ǝ → e, ɨ → i, ʉ → u, ɓ → b, ɗ → d, ƴ → y, ƙ → k) et quelques lettres européennes (ø, æ, œ, ß, đ, ł, ı, þ, ð) ; élision française « d' » en tête de mot séparée (« d'Almeida » → « d almeida ») ; toute autre apostrophe retirée sans espace, coup de glotte (ꞌ, ʼ) compris (« N'Dzanga » → « ndzanga », comme « Ndzanga ») ; tout ce qui n'est ni lettre ni chiffre (trait d'union, point, virgule, parenthèse) devient une espace ; espaces réduites. Idempotente (propriété fast-check sur des textes quelconques).
   Exemples : « Ngo Biyong » → « ngo biyong » ; « Nguyễn Thị Hoa » → « nguyen thi hoa » ; « Ɛ̀yɔ́ŋ » → « eyong » ; « Hélène-Ruth » → « helene ruth ».
   Limites : une autre écriture (arabe…) garde ses lettres, sans translittération ; « Jean-Pierre » cherché « Jeanpierre » ne se trouve que par la forme accolée (point 4).
2. **Jetons** (`nameTokens`) : les mots de la forme normalisée.
3. **Particules** (`NAME_PARTICLES`, à confirmer par Daniel) : « ngo », « nga », « mbe », « de », « du », « des », « d ». Une particule reste dans le nom et dans l'index ; une requête ne l'exige pas (« Ngo Biyong » trouve aussi « Ernest Biyong », signalé `missingParticles` pour que T-038 le classe après), sauf si la requête n'est faite que de particules (« Ngo » seul cherche « Ngo »). « Ngo » et « Nga » ne sont pas rapprochés. Limites : « le », « la », « van », « von », « épouse », « veuve » ne sont pas des particules ; la liste est à compléter avec les noms réels des familles pilotes.
4. **Termes indexables** (`personSearchTerms`, `buildSearchTerms`, technique) : pour chaque nom de la personne de type naissance, usage, surnom, titre ou variante, les mots des prénoms, du nom de famille et de la forme d'affichage, puis, pour une partie de plusieurs mots, leur forme accolée (« ngobiyong », « heleneruth ») ; chaque mot avec sa clé. Sortie : la liste des termes et deux colonnes prêtes pour FTS5 (`text` : mots distincts ; `keys` : clés distinctes). Rien d'autre qu'un nom n'est lu (aucun fait, donc jamais de cause de décès), et seulement les noms de la personne. La liste reçue est la copie locale du lecteur, déjà filtrée (T-052) : un nom masqué n'y est pas.
5. **Ancien prénom** (à confirmer par Daniel) : un nom `former` n'entre **jamais** dans les termes, même saisi par le lecteur. C'est plus strict que l'ADR 0023 (« l'ancien prénom d'un autre auteur ») : la table FTS5 est un fichier à part, partagée par tous les écrans, et un ancien prénom qui y entre ressortirait par la recherche, les suggestions de la voix ou les doublons. Conséquence : l'auteur ne retrouve pas une personne par son ancien prénom ; il la retrouve par son nom actuel. Si Daniel veut l'inverse, il faudra une seconde table propre à l'auteur, effacée à chaque changement de compte, et une relecture de gardien-confidentialite.
6. **Clé phonétique** (`phoneticKey`, règles à confirmer sur les noms réels). Par mot normalisé en lettres latines de base (sinon, le mot est sa propre clé), en passes successives ; dans une passe, la première graphie qui convient, lue de gauche à droite, est remplacée :
   1. consonnes : « ph » → f ; « tch », « tsh », « sch », « ch », « sh » → x (marque du son « ch », la lettre x devenant « ks ») ; « dj » → j ; « gn » → ny ; « qu », « ck », « q » → k ; « c » devant e, i, y → s, sinon k ; « x » → ks ; « h » muet ;
   2. voyelles : « eau », « au » → o ; « ain », « ein », « aim », « eim » devant consonne ou en fin → in ; « ai », « ei » → e ; « ou », « w » → u ; « y » → i ;
   3. lettres doublées réduites ;
   4. nasales : « m » devant consonne ou en fin → n ; « ng » final → n ; lettres doublées réduites encore ;
   5. finale muette : t, s ou d après une voyelle, dans une clé de quatre lettres et plus.

   Exemples (tests de `name-search.test.ts`) : Nkoulou, Nkulu → nkulu ; Biyong, Biyon → bion ; Tchoupo, Choupo, Shoupo → xupo ; Camga, Kamga → kanga ; Tsafack, Tsafak → tsafak ; Djoumessi, Joumessi → jumesi ; Kwam, Kouam → kuan ; Essomba, Esomba → esonba ; Fotsing, Fotsin → fotsin ; Philomène, Filomène → filomene ; Thomas, Toma → toma.

   Limites, testées comme telles : « an » et « en » (Mengue, Mangue), « s » et « z » (Moussa, Mouza), le « e » final (Nyobè, Nyob), « ay » et « ai » (Ayissi, Aissi) restent distincts ; « Kamga » et « Kanga » sont confondus. Jaro-Winkler rattrape les paires proches à l'écrit.
7. **Requête et niveaux** (`queryTerms`, `matchQuery`, technique) : chaque mot exigé de la requête doit être un mot de la personne (`exact`), le début d'un de ses mots (`prefix`, la frappe en cours), ou avoir la clé d'un de ses mots (`phonetic`) ; le niveau rendu est le moins bon des mots exigés, dans l'ordre de classement du TRD. Le niveau approché, son seuil et le classement complet (proximité de « Vous ») sont à T-038.
8. **Fautes de frappe** (`jaroWinkler`, technique) : Jaro-Winkler classique (préfixe d'au plus 4 caractères, poids 0,1), rendu symétrique par un ordre fixe des deux textes (propriété fast-check). Les seuils sont à T-038 (recherche) et T-040 (doublons).
9. **Budget** (technique ; la valeur pour l'index est un choix, à revoir avec la mesure sur le téléphone, T-105). Mesurés sur l'arbre généré de 5 000 personnes, ramenés au poste par le facteur de l'ADR 0026 (÷ 30), puis garde-fou habituel (× 1,5 poste, × 3 CI) : une requête comparée aux termes de toutes les personnes, sans index, dans 300 ms (ARB-10, le pire cas sans FTS5) ; la construction des termes de 5 000 personnes dans 1 000 ms (celui de l'ouverture de l'arbre), faite quand la copie locale change, jamais pendant la frappe. Ces mesures (`name-search.budget.test.ts`) tournent seules, par `test:budget`, comme celles du moteur : lancées au milieu des autres fichiers de test, la construction de l'index mesurait jusqu'à quatre fois plus. Le facteur de ralentissement passe de `packages/kinship` à `@lignee/domain/test-support` (`reference-device.ts`), repris par kinship.

## Conséquences

- T-038 crée la table FTS5 à partir de `buildSearchTerms` (colonnes `text` et `keys`), jamais à partir du corps JSON brut d'un nom, avec un test qu'elle ne contient ni cause de décès ni ancien prénom (obligation de l'ADR 0023) ; la requête passe par `queryTerms` ; la même normalisation sert aux lieux et aux années, que T-038 ajoute à l'index (TRD, Index).
- T-040 réutilise `normalizeNameText`, `phoneticKey` et `jaroWinkler` ; le serveur garde pg\_trgm et unaccent pour sa tâche de fond, avec le risque d'écarts entre les deux normalisations (à mesurer sur le jeu de doublons).
- À vérifier sur téléphone (ticket « À vérifier sur téléphone ») : `String.prototype.normalize('NFKD')` et les classes Unicode `\p{L}`, `\p{N}`, `\p{M}` sous Hermes, et les deux temps mesurés (requête, construction de l'index) sur l'Android de référence.
- Daniel : fournir la liste de noms réels des familles pilotes (doute de la section 4 du plan), dans un fichier hors du dépôt ; la clé, les particules et les limites du point 6 seront revues sur elle, et chaque correction ajoutée comme exemple généré dans les tests.

## Écarté

- **Soundex ou Phonex** : pensés pour l'anglais ou le français seuls ; ni « ng » final, ni « tch », ni « ou » et « w ».
- **Retirer les particules de l'index** : « Ngo » seul ne trouverait plus personne, et le nom n'est plus « gardé dans le nom » pour la recherche.
- **Une clé pour le nom entier** : « Ngo Biyong » et « Biyong » auraient des clés différentes ; la clé se calcule par mot.
- **Indexer l'ancien prénom pour son seul auteur dans la même table** : la table est commune à tous les écrans (point 5).
