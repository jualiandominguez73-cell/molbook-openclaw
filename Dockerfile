FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

ARG OPENCLAW_DOCKER_APT_PACKAGES=""
RUN if [ -n "$OPENCLAW_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $OPENCLAW_DOCKER_APT_PACKAGES && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

# Optional: install Homebrew (Linuxbrew). This is mainly to support skill dependency
# installation flows that use brew (e.g. steipete/tap/* tools).
ARG OPENCLAW_DOCKER_INSTALL_BREW="0"
ARG OPENCLAW_DOCKER_BREW_FORMULAS=""
ENV HOMEBREW_NO_ANALYTICS=1 \
    HOMEBREW_NO_ENV_HINTS=1
RUN if [ "$OPENCLAW_DOCKER_INSTALL_BREW" = "1" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        file \
        git \
        procps && \
      rm -rf /var/lib/apt/lists/*; \
      mkdir -p /home/linuxbrew/.linuxbrew && \
      chown -R node:node /home/linuxbrew; \
    fi

# Homebrew refuses to install as root; install it as the runtime user.
USER node
ENV PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:${PATH}"
RUN if [ "$OPENCLAW_DOCKER_INSTALL_BREW" = "1" ]; then \
      NONINTERACTIVE=1 /bin/bash -lc "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; \
      brew --version; \
      if [ -n "$OPENCLAW_DOCKER_BREW_FORMULAS" ]; then \
        brew install $OPENCLAW_DOCKER_BREW_FORMULAS; \
      fi; \
      brew cleanup; \
    fi

# Build as root (matches current setup + avoids permission pitfalls for node_modules).
USER root

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm install --frozen-lockfile --child-concurrency 1

COPY . .
RUN OPENCLAW_A2UI_SKIP_MISSING=1 pnpm build
# Force pnpm for UI build (Bun may fail on ARM/Synology architectures)
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:build

ENV NODE_ENV=production

# Security hardening: Run as non-root user
# The node:22-bookworm image includes a 'node' user (uid 1000)
# This reduces the attack surface by preventing container escape via root privileges
USER node

CMD ["node", "dist/index.js"]
