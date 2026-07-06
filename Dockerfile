# ScreenScore — single app image: FastAPI engine serving the built frontend.
# Build:  docker compose build   Run:  docker compose up

FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/ ./backend/
RUN pip install --no-cache-dir ./backend
COPY --from=frontend /build/dist ./frontend/dist

ENV SCREENSCORE_DATA_DIR=/data \
    SCREENSCORE_FRONTEND_DIST=/app/frontend/dist

EXPOSE 8686
VOLUME /data

CMD ["uvicorn", "--factory", "screenscore.main:create_app", "--host", "0.0.0.0", "--port", "8686"]
