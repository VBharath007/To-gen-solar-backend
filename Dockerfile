FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
RUN npx playwright install --with-deps chromium
COPY . .
RUN npm run check && npm run pdf:build
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["npm","start"]
