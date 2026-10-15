FROM node:18-alpine

WORKDIR /app

# Accept build-time public API URL for Next.js browser bundle
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and compile Next.js production build
COPY . .
RUN npm run build

EXPOSE 3000

# Start production server
CMD ["npm", "run", "start"]
