FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt ./backend/

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/app ./backend/app
COPY backend/run.py ./backend/

# Copy frontend
COPY frontend ./frontend

# Expose ports
EXPOSE 8080 3000

# Default to backend server
CMD ["python", "backend/run.py"]
