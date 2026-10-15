# Image du worker (tâches de fond), construite depuis la racine du dépôt :
#   docker compose --profile app build worker
# ou, sans Compose :
#   docker build -f apps/worker/Dockerfile -t lignee/worker:local .
#
# Image mince, en deux étapes : `pnpm deploy` isole le paquet et ses seules dépendances de
# production, puis l'image finale ne garde que ce résultat et Node, sous un utilisateur sans droits.
# Le paquet n'a pas encore de programme à faire tourner : l'image démarre et s'arrête aussitôt.
# À compléter par T-075 (pg-boss et tâches vocales).
#
# Node est épinglé par version et par empreinte (Dependabot propose les mises à jour,
# .github/dependabot.yml). Même image que .nvmrc (24).

FROM node:24.20.0-trixie-slim@sha256:50c3b2f6988dfc307b86e5301d69611af31f4789bdf232863b07d3b02fe55ae0 AS build
# Corepack (livré avec Node 24) prend la version de pnpm fixée dans package.json.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /repo
COPY . .
RUN corepack pnpm --filter @lignee/worker deploy --prod --legacy /out

FROM node:24.20.0-trixie-slim@sha256:50c3b2f6988dfc307b86e5301d69611af31f4789bdf232863b07d3b02fe55ae0
ENV NODE_ENV=production
WORKDIR /app
# Fichiers à root, en lecture seule pour l'utilisateur qui fait tourner le programme.
COPY --from=build /out ./
USER node
# Node 24 retire les types TypeScript à l'exécution, sans compilation.
CMD ["node", "src/index.ts"]
