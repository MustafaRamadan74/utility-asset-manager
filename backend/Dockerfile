FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build TypeScript dist
COPY . .
RUN npm run build

EXPOSE 3001

# On startup, execute pending migrations and start production server
CMD ["sh", "-c", "npm run migration:run && npm run start:prod"]
