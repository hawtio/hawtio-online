# AGENTS.md - Hawtio Online Project Context

## Project Overview

**Hawtio Online** is a containerized web console designed for discovering and managing _hawtio-enabled_ applications deployed on OpenShift and Kubernetes clusters. A hawtio-enabled application exposes the [Jolokia](https://jolokia.org) API through a container port named `jolokia`, enabling JMX management capabilities through a web interface.

**Repository**: https://github.com/hawtio/hawtio-online
**License**: Apache-2.0
**Version**: 2.0.0-SNAPSHOT (Maven), 3.1.1 (online-shell), 3.0.0 (gateway)

## Core Purpose

Hawtio Online provides:
- **Discovery**: Automatically finds hawtio-enabled applications in Kubernetes/OpenShift clusters
- **Management**: Provides a web-based console to interact with JMX MBeans via Jolokia
- **Security**: Implements RBAC and authentication (OAuth or Form-based)
- **Multi-tenancy**: Supports both cluster-wide and namespace-scoped deployments

## Architecture

### Two-Container Deployment Model

Hawtio Online uses a **sidecar pattern** with two containers working together:

#### 1. **Nginx Container** (`hawtio-online`)
- **Base Image**: `registry.access.redhat.com/ubi9/ubi-minimal:9.4` with nginx 1.22.1
- **Purpose**: Web server, reverse proxy, rate limiting, security headers
- **Port**: 8443 (HTTPS), 8080 (HTTP)
- **Key Responsibilities**:
  - Serves static React application (`/online` path)
  - Proxies `/master/*` requests to gateway (Kubernetes API access)
  - Proxies `/management` requests to gateway (Jolokia access)
  - Handles `/auth/logout` endpoint
  - Implements rate limiting with multiple zones:
    - `api_limit`: 10 req/s (sensitive APIs)
    - `static_limit`: 50 req/s (static assets)
    - `proxy_limit`: 30 req/s (Kubernetes proxy)
  - Applies security headers (CSP, HSTS, X-Frame-Options)
  - Caches responses (pods, RBAC)

#### 2. **Gateway Container** (`hawtio-online-gateway`)
- **Base Image**: `registry.access.redhat.com/ubi9/ubi-minimal:9.4` with Node.js 22
- **Purpose**: Backend API server, authentication, authorization, proxying
- **Port**: 3000
- **Key Responsibilities**:
  - Guards `/master` endpoint with URI validation
  - Proxies approved requests to Kubernetes API server
  - Manages Jolokia connections to application pods
  - Implements RBAC authorization
  - Handles WebSocket connections
  - Provides `/status` health check endpoint
  - Masks IP addresses (optional)

### Communication Flow

```
User Browser
    ↓
Nginx Container (port 8443/8080)
    ↓ (static files served directly)
    ↓ (/master, /management proxied)
Gateway Container (port 3000)
    ↓ (/master → Kubernetes API)
    ↓ (/management → Jolokia in app pods)
Kubernetes API Server / Application Pods
```

## Technology Stack

### Frontend
- **Framework**: React 18.3.1
- **UI Library**: PatternFly 6.x (React components, charts, tables, topology)
- **Routing**: React Router DOM 6.30
- **State Management**: React hooks, EventEmitter3
- **Code Editor**: Monaco Editor 0.52
- **Build Tool**: Webpack 5.106
- **Language**: TypeScript 5.9

### Backend (Gateway)
- **Runtime**: Node.js 22
- **Framework**: Express 4.21
- **Proxy**: http-proxy-middleware 3.0
- **Security**: Helmet 8.1, CORS 2.8
- **Logging**: Pino 10.3 (structured logging)
- **Authentication**: JWT decode, OAuth support
- **Caching**: LRU Cache 11.5
- **Language**: TypeScript 5.9

### Build & Development
- **Package Manager**: Yarn 4.16 (workspaces)
- **Monorepo**: 8 packages in `packages/` directory
- **Build Tools**:
  - Webpack (frontend bundling)
  - tsup (TypeScript library bundling)
  - Maven (optional, for Java ecosystem integration)
- **Testing**: Jest 30.4
- **Linting**: ESLint 9.1, Prettier 3.8
- **CI/CD**: GitHub Actions

### Deployment
- **Container Runtime**: Docker/Podman
- **Orchestration**: Kubernetes 1.30+ / OpenShift 4.x
- **Deployment Methods**:
  - Helm Charts (recommended)
  - Kustomize
  - Manual kubectl/oc commands
- **Configuration**: ConfigMaps, Secrets, environment variables

## Project Structure

### Monorepo Layout (Yarn Workspaces)

```
hawtio-online/
├── packages/                    # Yarn workspace packages
│   ├── gateway/                 # Node.js Express gateway server
│   ├── kubernetes-api/          # Kubernetes API client library
│   ├── kubernetes-api-app/      # Standalone K8s API test app
│   ├── management-api/          # Jolokia/JMX management library
│   ├── management-api-app/      # Standalone management API test app
│   ├── oauth/                   # OAuth authentication library
│   ├── oauth-app/               # Standalone OAuth test app
│   └── online-shell/            # Main React UI application
├── deploy/                      # Kubernetes/OpenShift manifests
│   ├── base/                    # Base Kustomize resources
│   ├── k8s/                     # Kubernetes-specific overlays
│   ├── openshift/               # OpenShift-specific overlays
│   ├── patches/                 # Kustomization patches
│   └── templates/               # RBAC templates
├── docker/                      # Docker build context
│   ├── gateway/                 # Gateway build artifacts
│   ├── includes/                # Nginx config includes
│   └── osconsole/               # OpenShift console integration
├── charts/                      # Helm charts
│   └── hawtio-online/           # Main Helm chart
├── docs/                        # Documentation
├── scripts/                     # Utility scripts
├── tests/                       # Integration tests
├── Dockerfile-nginx             # Nginx container image
├── Dockerfile-gateway           # Gateway container image
└── Makefile                     # Build automation
```

### Key Packages

1. **`gateway`**: Express server handling authentication, authorization, and proxying
2. **`online-shell`**: React application providing the web UI
3. **`kubernetes-api`**: TypeScript library for Kubernetes API interactions
4. **`management-api`**: TypeScript library for Jolokia/JMX operations
5. **`oauth`**: OAuth authentication handling for OpenShift

## Authentication & Authorization

### Authentication Modes

Configured via `HAWTIO_ONLINE_AUTH` environment variable:

1. **OAuth Mode** (default on OpenShift)
   - Uses OpenShift OAuth server
   - Requires OAuthClient resource
   - Automatic token refresh
   - Single sign-on with OpenShift console

2. **Form Mode** (Kubernetes, or OpenShift alternative)
   - Bearer token authentication
   - Login form in UI
   - Requires ServiceAccount or user token
   - Manual token management

### RBAC (Role-Based Access Control)

**Configuration**: `hawtio-rbac` ConfigMap mounted at `/etc/hawtio/rbac/ACL.yaml`

**Role Inference**:
- **Admin role**: User has `update` permission on pod resource
- **Viewer role**: User has `get` permission on pod resource
- **No role**: User lacks both permissions

**ACL Structure**:
```yaml
# Format: <domain>.<type> or <domain> or default
java.lang.Threading:
  uninstall(java.lang.String)[0]: []  # No roles allowed
  delete(java.lang.String): admin
  dumpStatsAsXml: admin, viewer
```

**Authorization Process**:
1. Match most specific key (domain.type)
2. Fall back to domain-only key
3. Fall back to `default` key
4. Within key, match by:
   - Exact operation signature + arguments
   - Regex operation signature + arguments
   - Exact operation signature (no args)
   - Exact operation name

**RBAC Registry**: Optional feature to cache RBAC decisions (enabled by default)

## Security Features

### Network Security
- **Rate Limiting**: Multiple zones with burst protection
- **Connection Limits**: Per-IP connection limiting
- **SSL/TLS**: Mutual TLS support for gateway-to-cluster communication
- **Certificate Management**: Automatic cert mounting from Kubernetes secrets

### Application Security
- **Helmet.js**: Security headers (CSP, HSTS, X-Frame-Options)
- **CORS**: Configurable cross-origin policies
- **Method Override**: Limited to safe methods
- **Input Validation**: Request size limits (50MB JSON)
- **IP Masking**: Optional IP address anonymization

### Kubernetes Security
- **ServiceAccount**: Runs as non-root user (UID 998 nginx, 9999 gateway)
- **RBAC**: ClusterRole/Role bindings for API access
- **Network Policies**: Optional pod-to-pod restrictions
- **Pod Security**: Read-only root filesystem, no privilege escalation

## Development Workflow

### Prerequisites
- Node.js 20+
- Yarn 4.16+
- Docker/Podman (for image builds)
- kubectl/oc CLI (for deployment)
- Access to Kubernetes/OpenShift cluster

### Local Development

#### 1. Install Dependencies
```bash
yarn install
```

#### 2. Build All Packages
```bash
yarn build
# Or build specific packages:
yarn build:gateway
yarn build:online
```

#### 3. Run Development Servers

**Option A: Online Shell Only**
```bash
yarn start:online
# Runs on http://localhost:2772
```

**Option B: Gateway + Online Shell**
```bash
# Terminal 1: Start gateway
yarn start:gateway

# Terminal 2: Start online shell
yarn start:online
```

**Configuration Files**:
- `packages/gateway/.env.development` - Gateway config
- `packages/online-shell/.env` - Shell config

**Key Environment Variables**:
```bash
# Gateway
HAWTIO_ONLINE_GATEWAY_APP_PORT=3000
HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER=https://api.cluster.example.com:6443
HAWTIO_ONLINE_GATEWAY_CLUSTER_TOKEN=<your-token>
NODE_TLS_REJECT_UNAUTHORIZED=0  # For self-signed certs

# Online Shell
HAWTIO_GATEWAY_SERVER=http://localhost:3000
```

#### 4. Testing
```bash
# Run all tests
yarn test

# Watch mode
yarn test:watch

# Coverage
yarn test:coverage
```

#### 5. Linting & Formatting
```bash
yarn lint
yarn lint:fix
yarn format:check
yarn format:fix
```

### Building Container Images

```bash
# Build nginx image
make image
# Or with custom tags:
ORG=myorg PROJECT=online TAG=dev make image

# Build gateway image
make image:gateway
# Or with custom tags:
ORG=myorg PROJECT=online-gateway TAG=dev make image:gateway
```

### Deployment to Cluster

#### Helm (Recommended)
```bash
# Install to namespace (namespace mode)
helm install hawtio-online charts/hawtio-online \
  --set online.route.host=hawtio.apps.cluster.example.com

# Install cluster-wide (cluster mode)
helm install hawtio-online charts/hawtio-online \
  --set online.clusterRole.create=true
```

#### Kustomize
```bash
# Kubernetes namespace mode
kubectl apply -k deploy/k8s/namespace/

# OpenShift cluster mode
oc apply -k deploy/openshift/cluster/
```

#### Manual
```bash
# Create OAuth client (OpenShift cluster mode)
oc create -f oauthclient.yml

# Create ServiceAccount (namespace mode)
oc create -f serviceaccount.yml

# Apply base resources
oc apply -k deploy/base/
```

## Points of Complexity

### 1. **Dual-Container Coordination**
- Nginx and Gateway must communicate over localhost
- Shared configuration through environment variables
- Synchronization of SSL certificates
- Health check dependencies

### 2. **Multi-Cluster Support**
- OpenShift vs. Kubernetes differences
- OAuth vs. Form authentication
- Different API endpoints and capabilities
- Certificate handling variations

### 3. **WebSocket Proxying**
- Nginx → Gateway → Kubernetes API
- Connection upgrade handling
- Timeout management (3600s for long-lived connections)
- Self-handling responses to avoid premature closure

### 4. **RBAC Complexity**
- Dynamic role inference from Kubernetes permissions
- ACL matching with regex support
- Ordered vs. unordered map handling
- Fallback chain (specific → domain → default)

### 5. **Jolokia Discovery & Proxying**
- Finding pods with `jolokia` port
- Handling internal vs. external access
- SSL/TLS for pod-to-pod communication
- Request/response transformation

### 6. **Rate Limiting Strategy**
- Multiple zones with different rates
- Burst handling for dashboard initialization
- Configurable burst sizes via environment variables
- Balance between security and usability

### 7. **Build System**
- Yarn workspaces with 8 packages
- TypeScript compilation with tsup/webpack
- Multi-stage Docker builds
- Platform-specific builds (amd64/arm64)
- Maven integration for Java ecosystem

### 8. **Security Hardening**
- CSP headers with strict policies
- IP address masking
- Certificate validation
- Non-root container execution
- Read-only filesystems

### 9. **Configuration Management**
- Environment variables (20+ options)
- ConfigMaps for RBAC
- Secrets for certificates
- Kustomize patches for customization
- Helm values for templating

### 10. **Testing Challenges**
- Mocking Kubernetes API
- Simulating OAuth flows
- Testing WebSocket connections
- Integration testing with real clusters
- Certificate generation for tests

## Common Development Tasks

### Adding a New Feature to Gateway
1. Modify `packages/gateway/src/gateway-api.ts`
2. Add route handler or middleware
3. Update tests in `*.test.ts` files
4. Rebuild: `yarn build:gateway`
5. Test locally: `yarn start:gateway`

### Adding a New UI Component
1. Create component in `packages/online-shell/src/`
2. Import in appropriate parent component
3. Add routing if needed in `App.tsx`
4. Rebuild: `yarn build:shell`
5. Test locally: `yarn start:online`

### Modifying RBAC Rules
1. Edit `deploy/base/configmap-hawtio-rbac.yml`
2. Apply to cluster: `kubectl apply -f deploy/base/configmap-hawtio-rbac.yml`
3. Restart pods to reload: `kubectl rollout restart deployment hawtio-online`

### Updating Dependencies
1. Update `package.json` in root or specific package
2. Run `yarn install`
3. Test thoroughly: `yarn test`
4. Update lockfile: `yarn.lock` (automatic)

### Debugging Gateway Issues
1. Set log level: `HAWTIO_ONLINE_GATEWAY_LOG_LEVEL=debug` or `trace`
2. Check logs: `kubectl logs deployment/hawtio-online -c hawtio-online-gateway`
3. Use `/status` endpoint for health check
4. Enable nginx debug: `NGINX_LOG_LEVEL=debug`

## Key Files Reference

### Configuration
- `deploy/base/configmap-hawtio-online.yml` - Nginx configuration
- `deploy/base/configmap-hawtio-rbac.yml` - RBAC ACL rules
- `deploy/base/deployment.yml` - Pod specification
- `docker/nginx-gateway.conf.template` - Nginx template
- `packages/gateway/env.product` - Gateway production config

### Build
- `Dockerfile-nginx` - Nginx container build
- `Dockerfile-gateway` - Gateway container build
- `Makefile` - Build automation
- `pom.xml` - Maven build (optional)
- `package.json` - Root workspace config

### Source Code
- `packages/gateway/src/gateway-api.ts` - Gateway main entry
- `packages/gateway/src/master-guard/` - Kubernetes API guard
- `packages/gateway/src/jolokia-agent/` - Jolokia proxy
- `packages/online-shell/src/` - React UI source

### Documentation
- `README.md` - Main documentation
- `docs/rbac.md` - RBAC detailed guide
- `docs/install/` - Installation guides
- `packages/gateway/README.md` - Gateway documentation

## Troubleshooting Guide

### Issue: Gateway can't connect to Kubernetes API
- Check `HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER` is correct
- Verify token has not expired
- Set `NODE_TLS_REJECT_UNAUTHORIZED=0` for self-signed certs
- Check ServiceAccount has proper RBAC permissions

### Issue: Jolokia pods not discovered
- Verify pods have port named `jolokia`
- Check RBAC allows listing pods in namespace
- Ensure pods are in `Running` state
- Verify Jolokia endpoint is accessible

### Issue: Rate limiting errors (429)
- Increase burst size: `NGINX_MASTER_BURST=10000`
- Adjust rate limits in nginx config
- Check if legitimate traffic or attack

### Issue: WebSocket connections fail
- Verify nginx proxy settings allow upgrades
- Check timeout settings (3600s default)
- Ensure no intermediate proxies break connection
- Test with `/master/api/v1/namespaces` endpoint

### Issue: RBAC denies operations
- Check user has correct permissions on pod
- Verify ACL rules in `hawtio-rbac` ConfigMap
- Test with `oc auth can-i update pods/<pod>`
- Enable RBAC debug logging

## Best Practices

### Code Style
- Use TypeScript strict mode
- Follow ESLint rules (configured in `eslint.config.mjs`)
- Format with Prettier before commit
- Write tests for new features
- Document complex logic with comments

### Security
- Never commit secrets or tokens
- Use environment variables for sensitive data
- Validate all user inputs
- Apply principle of least privilege for RBAC
- Keep dependencies updated

### Performance
- Use caching for frequently accessed data
- Implement rate limiting for public endpoints
- Optimize bundle size (code splitting)
- Monitor memory usage in gateway
- Use connection pooling

### Deployment
- Test in staging before production
- Use Helm for reproducible deployments
- Version container images properly
- Monitor logs and metrics
- Have rollback plan ready

## Related Projects

- **Hawtio Core**: https://github.com/hawtio/hawtio
- **Hawtio React**: https://github.com/hawtio/hawtio-react
- **Jolokia**: https://jolokia.org
- **Example Applications**: https://github.com/hawtio/hawtio-online-examples

## Support & Community

- **Issues**: https://github.com/hawtio/hawtio-online/issues
- **Discussions**: GitHub Discussions
- **Documentation**: https://hawt.io
- **License**: Apache-2.0

---

**Last Updated**: 2026-07-02
**For LLM/Agent Use**: This document provides comprehensive context for understanding and working with the Hawtio Online project. Use it as a reference when analyzing code, suggesting changes, or answering questions about the project architecture and implementation.
