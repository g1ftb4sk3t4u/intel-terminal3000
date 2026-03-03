FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install requests --no-cache-dir

# Copy mikrotik tool files
COPY mikrotik_master.py .
COPY mikrotik_headless.py .
COPY . .

# Create archive directory for output
RUN mkdir -p /app/mikrotik_archive

# Make scripts executable
RUN chmod +x /app/mikrotik_headless.py /app/mikrotik_master.py

# Default command: run full scan
ENTRYPOINT ["python3", "mikrotik_headless.py"]
CMD ["--full-scan"]

# For volumes
VOLUME ["/app/mikrotik_archive"]
