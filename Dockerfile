# Build and run Baton with Chromium available for the browser-driven agents.
#
# The official Playwright image ships Chromium + all system libraries at the
# version matching our playwright-core (1.61.1), so the UX-check reproduction and
# the QA browser tests work in production, not just in the dev sandbox.
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

ENV CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    NEXT_TELEMETRY_DISABLED=1

# Install dependencies (layer cached on lockfile). Dev deps are needed to build.
COPY package.json package-lock.json ./
RUN npm ci

# App source
COPY . .

# Target Postgres in production, generate the client, and build.
RUN bash scripts/db-provider.sh postgresql \
 && npx prisma generate \
 && npm run build

EXPOSE 3000
ENV NODE_ENV=production
# Sync the schema, then start. (Railway injects env vars at runtime.)
CMD ["sh", "-c", "npx prisma db push && npm start"]
