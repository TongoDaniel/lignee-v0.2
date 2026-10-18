# 0019 — Claude relit et fusionne ; un modèle par agent

Date : 18 octobre 2026 · Statut : acceptée (décision de Daniel du 18 octobre 2026) · Remplace en partie l'ADR 0005

## Contexte

L'ADR 0005 confiait l'écriture du code à Claude et gardait la relecture et la fusion pour Daniel. Après trois jours, 13 pull requests attendaient en pile sans qu'aucune n'atteigne `main` : la relecture humaine était devenue le seul goulot, et le développement s'arrêtait aussi régulièrement sur la limite d'usage. Daniel décide que Claude relit et fusionne lui-même, en toute autonomie, et demande un modèle adapté à chaque agent.

## Décision

### La fusion

La session principale fusionne une pull request quand, et seulement quand :

1. la CI est verte sur le dernier commit (un échec instable se relance une fois ; s'il échoue encore, il se corrige avant la fusion) ;
2. `relecteur-code` a rendu « à fusionner » sur la dernière version, toutes ses demandes étant corrigées ;
3. `gardien-confidentialite` a rendu « à fusionner » si la pull request touche aux droits, à la visibilité, à la synchro, à l'auth, aux exports, aux notifications, au contexte voix ou aux données de santé et de mineurs ;
4. la pull request ne fait qu'une chose et son modèle est rempli, verdicts compris.

Méthode : **squash** pour une pull request seule (le titre, vérifié par commitlint, devient le message sur `main`) ; **merge commit** pour une pile de pull requests dépendantes, fusionnée de la base vers le haut, chaque fille repassant sur `main` avant sa fusion. Les branches fusionnées sont supprimées une fois qu'aucune pull request ne s'appuie plus dessus.

Claude ne pousse jamais directement sur `main` et ne contourne jamais une CI rouge.

### Ce qui reste à Daniel

- Les décisions humaines : société, comptes, contrats, paiements, secrets, juriste, familles pilotes et locuteurs (liste de l'ADR 0005, inchangée).
- Les ADR de **produit, de droit ou d'argent** : Claude les écrit au statut « proposée » et ne les accepte pas. Les ADR **techniques** internes au TRD (un algorithme, une bibliothèque, une convention de code), Claude les accepte et les fusionne.
- Les essais sur les téléphones physiques. Ils ne bloquent plus la fusion : chaque pull request d'écran ajoute ce qu'il faut regarder à un ticket « À vérifier sur téléphone » (étiquette `telephone`), que Daniel parcourt quand il veut.
- Un droit de veto : Daniel peut annuler toute fusion (`git revert`) ou rétablir sa relecture à tout moment.

### Un modèle par agent

Le coût d'un ticket est surtout celui des agents ; la limite d'usage est le premier frein. On garde Opus là où une erreur passe inaperçue et coûte cher, Sonnet là où le travail est plus balisé et vérifié par les relecteurs.

| Agent | Modèle | Raison |
| --- | --- | --- |
| `relecteur-code` | Opus | Seul gardien de `main` depuis que Daniel ne relit plus |
| `gardien-confidentialite` | Opus | Une fuite est le pire risque du produit |
| `moteur-parente` | Opus | Raisonnement sur des graphes ; une erreur de lien ruine la confiance |
| `modele-domaine` | Opus | Invariants et règles de visibilité dont tout dépend |
| `sync-hors-ligne` | Opus | Concurrence et pertes de données difficiles à voir |
| `pipeline-vocal` | Opus | Prompts, schéma d'extraction et résolveur ambigus |
| `api-serveur` | Sonnet | Routes Hono et Prisma classiques ; droits relus par le gardien |
| `ecrans-lignee` | Sonnet | Écrans guidés par la charte et ses composants |
| `exploitation` | Sonnet | CI, Docker, EAS : configuration documentée |
| `testeur-qualite` | Sonnet | Scénarios YAML et tests au format établi |
| `chef-de-chantier` | Sonnet | Découpage et suivi du plan |

La session principale reste sur le modèle choisi par Daniel.

### Pas de nouvel agent

Chaque agent ajouté rallonge le chemin d'un ticket et consomme de l'usage. Les onze agents couvrent tous les modules du TRD, et `relecteur-code` plus `gardien-confidentialite` remplacent la relecture humaine. Le seul manque, l'essai sur téléphone, demande un humain ou un simulateur piloté depuis la session principale : il ne justifie pas un agent de plus.

## Conséquences

- Le rythme n'est plus limité par la relecture humaine, mais par l'usage et la CI. L'hypothèse de 12 unités par cycle de la section 3 du plan est caduque ; elle se remesure à la fin du cycle en cours.
- Le risque principal grandit : du code faux qui entre sans œil humain. Parades : scénarios et tests avant le code, tests de propriétés, deux relecteurs sur Opus, CI obligatoire, pull requests petites, et le ticket « À vérifier sur téléphone ».

## Écarté

- **Garder Daniel comme relecteur obligatoire** : c'était le goulot.
- **Tous les agents sur Opus** : épuise la limite d'usage deux fois plus vite pour un gain faible sur le travail balisé.
- **Tous les agents sur Sonnet** : trop risqué pour la parenté, la synchro, la confidentialité et la relecture.
