This PR replaces the project Dockerfile with an optimized multi-stage build and updates .dockerignore to reduce final image size. Key changes:
- Adds a builder stage (Node + Bun + build deps) and a slim runtime stage (node:22-bookworm-slim) so build tools and dev dependencies are not included in the final image.
- Converts to production-only node_modules for runtime.
- Prunes pnpm store and removes build caches in builder to keep layers small.

Build & test instructions:
1. docker build -f Dockerfile -t openclaw:optimized .
2. docker image ls --format "{{.Repository}}:{{.Tag}}	{{.Size}}"
3. docker history --no-trunc openclaw:optimized (if image still large, paste output here for analysis)

If the PR needs further optimization (distroless runtime, removing large static assets, or stripping binaries), I can iterate.