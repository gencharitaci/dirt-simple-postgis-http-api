# adapted from https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
FROM node:23-slim

# Set working directory
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Ensure port 3000 is exposed
EXPOSE 3000

# Use non-root user for better security
USER node

# Run application
CMD [ "npm", "run", "start" ]

