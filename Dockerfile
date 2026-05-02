# Stage 1: Build frontend
FROM node:20-alpine AS builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Runtime
FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Copy source packages
COPY poker_trainer/ poker_trainer/
COPY backend/ backend/

# Copy built frontend from stage 1
COPY --from=builder /app/frontend/dist frontend/dist/

# Install Python dependencies
RUN uv sync --no-dev --frozen

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
