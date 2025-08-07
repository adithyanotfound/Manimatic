# ===== 1. Build Stage =====
FROM node:20-slim AS build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    libcairo2-dev \
    libpango1.0-dev \
    libgdk-pixbuf2.0-dev \
    libffi-dev \
    shared-mime-info \
    libgirepository1.0-dev \
    texlive \
    texlive-latex-extra \
    texlive-fonts-extra \
    texlive-latex-recommended \
    texlive-science \
    texlive-fonts-extra

WORKDIR /app

# Copy package manifests and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Create Python venv and install Python build dependencies (e.g. manim for TypeScript/asset generation)
RUN python3 -m venv /app/manim_env
ENV PATH="/app/manim_env/bin:$PATH"
RUN pip install --upgrade pip && pip install manim

# Compile TypeScript (assumes your scripts expect manim and generate assets during build)
RUN npx tsc -b

# ===== 2. Runtime Stage =====
FROM node:20-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    libcairo2 \
    libpango1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi8 \
    shared-mime-info \
    libgirepository-1.0-1 \
    texlive \
    texlive-latex-extra \
    texlive-fonts-extra \
    texlive-latex-recommended \
    texlive-science && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only production Node dependencies from build stage
COPY --from=build /app/node_modules ./node_modules

# Copy production-related files (compiled JS, frontend build outputs, public files, assets)
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./

# Create runtime directories (these will be empty initially)
RUN mkdir -p videos audio uploads temp

# Copy Python virtual environment from build stage
COPY --from=build /app/manim_env /app/manim_env
ENV PATH="/app/manim_env/bin:$PATH"

# Environment settings
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/src/server-v4.js"]
