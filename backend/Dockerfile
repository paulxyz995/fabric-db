# Backend API (Node.js + Express)
FROM node:20-alpine

WORKDIR /app

# Install deps first (cache-friendly)
COPY package*.json ./
RUN npm install --omit=dev

# App source
COPY . .

EXPOSE 4000
CMD ["node", "src/index.js"]
