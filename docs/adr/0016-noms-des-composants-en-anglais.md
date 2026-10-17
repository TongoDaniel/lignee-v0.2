# 0016 — Noms et props des composants de la charte en anglais

Date : 17 octobre 2026 · Statut : proposée (T-014)

## Contexte

La charte (`docs/charte/11-react-native.md`) demande : « Chaque composant de la charte (Bouton, Puce, Carte, Champ…) devient un composant React Native du même nom, avec les props décrites dans sa fiche ». Ses fiches et `docs/charte/components/index.d.ts` nomment les props en français (`libelle`, `variante`, `desactive`, `sousTitre`…).

CLAUDE.md fixe au contraire : « code et identifiants en anglais ». Le ticket T-014 demande des props en anglais. Les deux règles ne peuvent pas être suivies à la fois.

## Décision

- Les composants de `@lignee/ui` portent des noms et des props en anglais, comme tout le code. Les textes restent en français et en anglais dans `@lignee/i18n` ; les commentaires restent en français et citent la fiche de la charte.
- La correspondance est fixe et documentée dans `packages/ui/README.md` :

| Charte | `@lignee/ui` | Props principales |
| --- | --- | --- |
| Bouton | `Button` | `label`, `variant` (`primary`, `secondary`, `quiet`, `celebrate`, `danger`), `icon`, `compact`, `fullWidth`, `disabled`, `onPress` |
| Puce | `Chip` | `label`, `tone` (`green`, `kinship`, `celebrate`, `health`, `memory`, `documents`, `neutral`), `icon`, `onPress` |
| Carte | `Card` | `title`, `text`, `thumbnail`, `onPress`, `children` |
| Champ | `Field` | `label`, `value`, `onChangeText`, `placeholder`, `error`, `voiceInput`, `keyboard`, `disabled` |
| Interrupteur | `Switch` | `label`, `description`, `value`, `onValueChange`, `health`, `disabled` |
| EnTete | `Header` | `title`, `subtitle`, `back`, `action` |
| Feuille | `Sheet` | `visible`, `title`, `subtitle`, `onClose`, `closeLabel`, `children` |
| Toast | `Toast` | `message`, `visible`, `onHide`, `closeLabel`, `persistent` |
| LigneReglage | `SettingsRow`, `SettingsGroup` | `icon`, `iconTone`, `label`, `value`, `onPress` |
| Icones | `Icon` | `name` (nom du fichier en camelCase : `appareilPhoto`), `size`, `color` |
| Logo | `Logo` | `variant`, `height`, `background` |

- Les noms des icônes gardent ceux des fichiers de la charte (`sante`, `prive`, `suivant`) : ce sont des noms d'éléments de la charte, pas des identifiants de code, et les garder évite toute table de traduction.
- Trois écarts de forme, dictés par l'accessibilité et React Native :
  - `Champ.micro` devient `voiceInput` (action, libellé pour le lecteur d'écran, et `enabled` : absent, le micro est proposé en mode Aînés seulement) ;
  - `EnTete.retour` devient `back` (action et libellé : un bouton sans libellé serait muet au lecteur d'écran) ;
  - `Toast` et `Feuille` reçoivent `visible` et un libellé `closeLabel`, parce que le composant anime son apparition et sa disparition, et qu'en mode Aînés le toast reste jusqu'à ce qu'on le ferme.
- Aucun composant ne contient de texte : tout texte arrive en props, déjà traduit par l'écran.

## Conséquences

- Un développeur qui lit la charte trouve le composant par la table ci-dessus ; `index.d.ts` de la charte décrit l'intention, pas l'API exacte.
- Si Daniel préfère suivre la charte à la lettre, il faut renommer avant T-015, qui ajoute les composants de personne et de navigation sur le même modèle.

## Écarté

- Noms et props en français, comme la charte : contraire à CLAUDE.md, et mélange de deux langues dans le code (`<Bouton onPress=…>`).
- Double export (français et anglais) : deux noms pour une même chose, et des relectures plus longues.
