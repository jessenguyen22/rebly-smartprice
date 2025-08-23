# Deployment Architecture

The deployment strategy leverages your dedicated server infrastructure with Docker containerization, automated CI/CD pipelines, and zero-downtime deployment capabilities.

### Deployment Strategy

**Frontend Deployment:**
- **Platform:** Your dedicated server with Nginx reverse proxy
- **Build Command:** `npm run build`
- **Output Directory:** `build/client` (static assets served by Nginx)
- **CDN/Edge:** Nginx with gzip compression and static asset caching

**Backend Deployment:**
- **Platform:** Docker containers on your dedicated server
- **Build Command:** `npm run build && npm run build:server`
- **Deployment Method:** Docker Compose with rolling updates
- **Process Management:** Docker containers with automatic restart policies

### CI/CD Pipeline

```yaml