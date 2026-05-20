
# Start from a lightweight Node image
FROM node:18-alpine

WORKDIR /app

# Copy dependency files and install cleanly
COPY package.json package-lock.json ./
RUN npm ci

# Copy the Next.js source code
COPY . .

# Compile the optimized production build
RUN npm run build

# Start the production server
CMD ["npm", "run", "start"]