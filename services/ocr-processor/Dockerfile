FROM node:18-alpine

# Install system dependencies for Tesseract and image processing
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    imagemagick \
    ghostscript \
    poppler-utils \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create temp directory for processing
RUN mkdir -p temp

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the service
CMD ["npm", "start"]
