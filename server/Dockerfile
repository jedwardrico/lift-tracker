FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci


FROM node:20-alpine

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY db/schema.sql ./schema.sql
COPY data ./data
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

VOLUME ["/app/db"]

ENV PORT=3000
ENV SCHEMA_PATH=/app/schema.sql
EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
