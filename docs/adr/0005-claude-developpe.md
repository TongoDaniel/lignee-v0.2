# 0005 — Claude développe, Daniel décide

Date : 15 octobre 2026 · Statut : acceptée (décision de Daniel)

## Contexte

Le cahier prévoit un binôme à temps partiel : Daniel pour le serveur, un second développeur « à confirmer » pour l'app, et une relecture croisée de chaque pull request. Daniel décide qu'il n'y aura pas de second développeur, et que **le code est écrit par Claude**, au moyen des agents de `.claude/agents/`.

## Décision

### Qui fait quoi

| Qui | Rôle |
| --- | --- |
| **Claude, session principale** | Maître d'œuvre : choisit le ticket suivant dans l'ordre du plan, le confie à l'agent spécialisé, fait relire, corrige, ouvre la pull request, tient le plan et les ADR à jour |
| **Agents spécialisés** | Écrivent le code et les tests de leur module : `modele-domaine`, `moteur-parente`, `sync-hors-ligne`, `pipeline-vocal`, `api-serveur`, `ecrans-lignee`, `exploitation`, `testeur-qualite` |
| **Agents relecteurs** (lecture seule) | `relecteur-code` sur chaque pull request, à la place du second développeur ; `gardien-confidentialite` pour les droits, la visibilité, la synchro, l'auth, les exports, les notifications et le contexte voix |
| **`chef-de-chantier`** | Découpe, prépare les cycles, vérifie « terminé » avant la clôture d'un ticket |
| **Daniel** | Décide, relit et fusionne chaque pull request ; teste sur l'Android de référence et sur un iPhone ; fait tout ce qui demande une personne (voir plus bas) |

### Le chemin d'un ticket

1. La session principale lit le ticket, sa ligne du plan, les sections du PRD et du TRD citées.
2. Elle confie le travail à l'agent du module, dans une copie de travail isolée (worktree) et sur une branche `feat/T-0NN-…` : scénario `test/scenarios/<ID>.yaml` et tests d'abord, puis le code.
3. L'agent lance lint, types et tests, et rapporte la sortie réelle.
4. `relecteur-code` relit ; `gardien-confidentialite` aussi quand le ticket le demande. Les corrections repartent à l'agent du module.
5. La session principale ouvre la pull request avec le modèle rempli, en disant ce qui est prouvé et ce qui reste à Daniel.
6. **Daniel relit et fusionne.** Claude ne fusionne jamais et ne pousse jamais sur `main`.

### Ce que seul Daniel peut faire

- Fusionner les pull requests et accepter les ADR.
- Tester sur les téléphones physiques (Android de référence, iPhone) et dire ce qu'il voit.
- Créer la société, ouvrir les comptes (stores, Apple, WhatsApp Business, agrégateur SMS, Mistral, Anthropic, hébergeur, R2), signer les contrats et les DPA, payer.
- Saisir les secrets dans GitHub Actions, EAS et SOPS ; Claude ne voit jamais un secret réel.
- Voir le juriste et le conseil en marques ; déposer la demande d'autorisation à l'Autorité.
- Recruter les familles pilotes et les locuteurs du jeu vocal, recueillir leur accord.

### Capacité

- Le travail d'écriture n'est plus la limite. Les limites deviennent : le temps de relecture de Daniel, les tests sur téléphone, et les étapes humaines ci-dessus.
- Hypothèse de départ : **environ 12 unités par cycle de 4 semaines** (S = 0,5 ; M = 1 ; L = 2), soit environ trois pull requests relues par semaine. Elle se mesure à la fin du premier cycle et se corrige alors.

## Conséquences

- La V1 compte environ 121 unités, soit **environ 11 cycles de travail**, un peu moins d'un an si Daniel suit le rythme de relecture.
- Le chemin critique devient humain : l'autorisation de transfert (ADR 0002), le jeu de 300 phrases réelles (ADR 0003), les comptes, les familles pilotes. Ils doivent démarrer tôt pour ne pas attendre le code.
- La relecture par un second développeur est remplacée par `relecteur-code`, puis par la lecture de Daniel. Le modèle de pull request et `.github/CODEOWNERS` le disent.
- Le risque principal change : du code produit vite mais faux sans qu'on le voie. Les parades sont les scénarios de cas limites écrits avant le code, les tests de propriétés, deux relecteurs automatiques, et des pull requests petites.

## Écarté

- **Un agent qui fusionne seul** : Daniel doit garder la main sur ce qui entre dans `main`.
- **Un agent « développeur » généraliste** : les agents par module portent les règles de leur partie du TRD ; un généraliste les oublierait.
- **Garder le calendrier à deux humains** : il serait faux dès le premier cycle.
