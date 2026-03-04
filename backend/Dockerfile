FROM node:18-alpine

WORKDIR /app

# Install dependencies (ffmpeg and ghostscript are often needed for video/image processing)
RUN apk add --no-cache ffmpeg bc

COPY package*.json ./
RUN npm install

# Copy source code and prisma schema
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3001

# Start the application
CMD ["npm", "start"]
