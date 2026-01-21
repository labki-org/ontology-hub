# Stack Research: Ontology Hub

**Project:** Ontology Hub - Ontology Management Platform
**Researched:** 2026-01-20
**Domain:** Public ontology browsing, draft proposals, GitHub PR integration

---

## Executive Summary

The recommended stack prioritizes mature, well-documented technologies with strong async support. FastAPI + SQLAlchemy 2.0 async provides excellent performance for the backend. React 19 + Vite 6 + TanStack Query v5 delivers a modern, type-safe frontend. GitHub OAuth App (not GitHub App) is sufficient for the PR-at-submit-time model.

For ontology validation, **avoid heavyweight OWL/RDF libraries** - the SemanticSchemas format is JSON-based and doesn't need full semantic web tooling. Build custom validation logic instead.

---

## Backend (Python FastAPI)

### Core Framework

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| FastAPI | ^0.128.0 | Web framework with async support, automatic OpenAPI | HIGH |
| Pydantic | ^2.12.0 | Data validation, settings management | HIGH |
| Uvicorn | ^0.34.0 | ASGI server | HIGH |

**Why FastAPI:**
- Native async support critical for GitHub API calls and database operations
- Automatic OpenAPI documentation (useful for wiki admins understanding the API)
- Pydantic v2 integration for request/response validation
- Dependency injection makes capability URL validation clean

**Rationale for versions:**
- FastAPI 0.128.0 (Dec 2025) dropped Python 3.8, requires Python 3.9+
- Pydantic v2.12+ has Python 3.14 support and new MISSING sentinel
- Avoid: FastAPI < 0.115 (lacks Pydantic v2.12 compatibility fixes)

Sources:
- [FastAPI PyPI](https://pypi.org/project/fastapi/)
- [FastAPI Best Practices 2025](https://orchestrator.dev/blog/2025-1-30-fastapi-production-patterns/)
- [Pydantic v2.12 Release](https://pydantic.dev/articles/pydantic-v2-12-release)

### Database Layer

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| SQLAlchemy | ^2.0.45 | Async ORM with connection pooling | HIGH |
| asyncpg | ^0.30.0 | PostgreSQL async driver | HIGH |
| Alembic | ^1.18.0 | Database migrations | HIGH |

**Why SQLAlchemy 2.0 (not SQLModel):**
- SQLModel is simpler but less flexible for complex queries
- SQLAlchemy 2.0's native async support is production-ready
- Better separation of concerns: SQLAlchemy models for DB, Pydantic schemas for API
- More control over relationship loading strategies

**Configuration pattern:**
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

engine = create_async_engine(
    "postgresql+asyncpg://...",
    pool_size=5,
    max_overflow=10,
)
```

**Migration setup:**
- Use `alembic init -t async` for async-compatible migrations
- Autogenerate migrations with `alembic revision --autogenerate`

Sources:
- [SQLAlchemy PyPI](https://pypi.org/project/sqlalchemy/)
- [Async SQLAlchemy 2.0 Best Practices](https://leapcell.io/blog/building-high-performance-async-apis-with-fastapi-sqlalchemy-2-0-and-asyncpg)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)

### GitHub Integration

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Authlib | ^1.6.6 | OAuth 2.0 client (GitHub OAuth) | HIGH |
| httpx | ^0.28.0 | Async HTTP client for GitHub API | HIGH |
| PyGithub | ^2.8.0 | GitHub API wrapper (optional) | MEDIUM |

**Why OAuth App over GitHub App:**
- OAuth App is sufficient for user-initiated PRs (acts as the user)
- GitHub App would be better for automated bot actions, but adds complexity
- OAuth App tokens are long-lived (no refresh token management)
- Simpler installation: no webhook setup, no private key management

**OAuth Flow for Ontology Hub:**
1. User clicks "Submit to GitHub" on draft proposal
2. Redirect to GitHub OAuth authorize endpoint
3. Exchange code for access token
4. Use token to fork repo (if needed), create branch, commit, open PR
5. Token stored in session only, not persisted

**GitHub API Pattern:**
```python
from httpx import AsyncClient

async def create_pull_request(token: str, repo: str, head: str, base: str, title: str, body: str):
    async with AsyncClient() as client:
        response = await client.post(
            f"https://api.github.com/repos/{repo}/pulls",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": title, "body": body, "head": head, "base": base}
        )
        return response.json()
```

Sources:
- [GitHub OAuth vs GitHub App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [Authlib Documentation](https://docs.authlib.org/)
- [PyGithub PyPI](https://pypi.org/project/PyGithub/)

### Ontology Validation

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Custom validators | N/A | Schema consistency, breaking change detection | HIGH |
| jsonschema | ^4.23.0 | JSON Schema validation (if schemas are JSON Schema) | MEDIUM |
| pydantic | ^2.12.0 | Model validation (reuse from API layer) | HIGH |

**CRITICAL: Do NOT use heavyweight RDF/OWL libraries**

SemanticSchemas is JSON-based, not OWL/RDF. Avoid:
- rdflib (for RDF graphs, overkill for JSON schemas)
- Owlready2 (OWL ontology manipulation, wrong format)
- pySHACL (SHACL validation, wrong paradigm)
- LinkML (data modeling language, adds unnecessary complexity)

**Why custom validation:**
- SemanticSchemas has specific validation rules (property inheritance, module boundaries)
- Breaking change detection is domain-specific (renamed properties, removed categories)
- Custom validators are faster and more maintainable than adapting generic tools

**Validation architecture:**
```python
# validators/schema_validator.py
class SchemaValidator:
    def validate_category(self, category: dict) -> list[ValidationError]: ...
    def validate_property(self, property: dict) -> list[ValidationError]: ...
    def detect_breaking_changes(self, old: dict, new: dict) -> list[BreakingChange]: ...
```

Sources:
- [Comparing Python Ontology Libraries](https://incenp.org/notes/2025/comparing-python-ontology-libraries.html)
- [pySHACL PyPI](https://pypi.org/project/pyshacl/) (NOT recommended for this project)

### Testing

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| pytest | ^8.3.0 | Test framework | HIGH |
| pytest-asyncio | ^0.25.0 | Async test support | HIGH |
| httpx | ^0.28.0 | AsyncClient for testing FastAPI | HIGH |
| pytest-cov | ^6.0.0 | Coverage reporting | HIGH |

**Async testing pattern:**
```python
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_get_categories():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/categories")
        assert response.status_code == 200
```

Sources:
- [FastAPI Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/)
- [pytest-asyncio Documentation](https://pytest-asyncio.readthedocs.io/)

### Dev Tooling

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| uv | ^0.6.0 | Package and project manager (fast, replaces pip/poetry) | HIGH |
| ruff | ^0.9.0 | Linting and formatting (replaces black, flake8, isort) | HIGH |
| mypy | ^1.14.0 | Static type checking | HIGH |
| pre-commit | ^4.0.0 | Git hooks | MEDIUM |

**Why uv over pip/poetry:**
- 10-100x faster than pip
- Single tool for virtual environments, dependencies, and project management
- Lock file guarantees reproducible builds
- FastAPI team recommends uv for new projects

**Why ruff over black + flake8 + isort:**
- Single tool replaces multiple linters/formatters
- 10-100x faster (written in Rust)
- Zero configuration needed for good defaults
- Can auto-fix many issues

**pyproject.toml snippet:**
```toml
[tool.ruff]
line-length = 100
select = ["E", "F", "I", "B", "UP"]

[tool.mypy]
python_version = "3.12"
strict = true
```

Sources:
- [uv Documentation](https://docs.astral.sh/uv/)
- [Ruff Documentation](https://docs.astral.sh/ruff/)

---

## Frontend (Vite + React)

### Core Framework

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| React | ^19.2.0 | UI library | HIGH |
| Vite | ^6.1.0 or ^7.3.0 | Build tool and dev server | HIGH |
| TypeScript | ^5.7.0 | Type safety | HIGH |

**Version choice: Vite 6 vs Vite 7:**
- Vite 7.3 is latest but requires Node 20.19+ / 22.12+
- Vite 6.4 is actively maintained, supports Node 18
- **Recommendation:** Use Vite 6 for broader deployment compatibility

**React 19 features useful for Ontology Hub:**
- useSuspense for data loading (cleaner loading states)
- Server Components if SSR is needed later (can add)
- Improved hydration (if adding SSR)

Sources:
- [Vite Releases](https://vite.dev/releases)
- [React Versions](https://react.dev/versions)

### State & Data Management

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| TanStack Query | ^5.60.0 | Server state management, caching | HIGH |
| Zustand | ^5.0.0 | Client state (UI state, draft editor state) | HIGH |

**Why TanStack Query (not Redux Toolkit Query):**
- Purpose-built for server state (fetching, caching, background refresh)
- Much simpler than Redux for data fetching use cases
- Automatic cache invalidation and refetching
- DevTools for debugging queries

**Why Zustand (not Redux):**
- Minimal boilerplate for client state
- Perfect for draft proposal editor state
- No providers/context wrapping needed
- TypeScript-first design

**State separation pattern:**
```typescript
// Server state (TanStack Query)
const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: fetchCategories,
});

// Client state (Zustand)
const useDraftStore = create<DraftState>((set) => ({
  changes: [],
  addChange: (change) => set((state) => ({ changes: [...state.changes, change] })),
}));
```

Sources:
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand vs Redux 2025](https://www.zignuts.com/blog/react-state-management-2025)

### Routing

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| React Router | ^7.8.0 | Client-side routing | HIGH |

**Why React Router (not TanStack Router):**
- More mature, larger community
- Simpler API for SPA use case
- TanStack Router advantages (type-safe params) not critical for this project
- Team likely more familiar with React Router

**Route structure for Ontology Hub:**
```
/                       - Home/browse
/categories             - Category list
/categories/:id         - Category detail
/properties             - Property list
/properties/:id         - Property detail
/draft/:token           - Draft proposal (capability URL)
/draft/:token/submit    - GitHub OAuth callback
```

Sources:
- [TanStack Router vs React Router v7](https://medium.com/ekino-france/tanstack-router-vs-react-router-v7-32dddc4fcd58)

### UI Components

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Tailwind CSS | ^4.1.0 | Utility-first CSS | HIGH |
| shadcn/ui | latest | Component library (copy-paste, not npm) | HIGH |
| Radix UI | ^1.1.0 | Accessible primitives (via shadcn) | HIGH |

**Why shadcn/ui (not Material UI, Chakra, Mantine):**
- Components are copied into your codebase, not installed as dependency
- Full control over styling and behavior
- Built on Radix primitives (excellent accessibility)
- Tailwind-native (no CSS-in-JS runtime)
- Easy to customize for wiki admin audience

**Tailwind v4 improvements:**
- CSS-first configuration (no tailwind.config.js needed)
- Automatic content detection
- 5x faster builds
- First-party Vite plugin

**Installation:**
```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog form input table
```

Sources:
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui](https://ui.shadcn.com/)

### Forms

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| React Hook Form | ^7.54.0 | Form state management | HIGH |
| Zod | ^3.24.0 | Schema validation (shared with backend?) | HIGH |

**Why React Hook Form + Zod:**
- Minimal re-renders (performance)
- Zod schemas can potentially be shared with Python (via code generation)
- Excellent TypeScript inference
- shadcn/ui forms use this pattern

Sources:
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)

### Testing

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Vitest | ^4.0.0 | Unit testing (Jest-compatible, Vite-native) | HIGH |
| React Testing Library | ^16.1.0 | Component testing | HIGH |
| Playwright | ^1.50.0 | E2E testing | MEDIUM |

**Why Vitest (not Jest):**
- Native Vite integration (uses same config)
- Significantly faster
- Jest-compatible API (easy migration)
- Browser mode for component testing

Sources:
- [Vitest](https://vitest.dev/)

### Dev Tooling

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| ESLint | ^9.18.0 | Linting | HIGH |
| Prettier | ^3.4.0 | Formatting | HIGH |
| TypeScript ESLint | ^8.21.0 | TypeScript-aware linting | HIGH |

---

## Database

### PostgreSQL Setup

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| PostgreSQL | 16 | Primary database | HIGH |
| asyncpg | ^0.30.0 | Async driver for Python | HIGH |

**Schema design considerations:**
- Drafts table with capability URL token (indexed, unique)
- Changes stored as JSONB (flexible for different entity types)
- Audit trail for all modifications
- Consider: separate table per entity type vs. generic entity table

**Connection pooling:**
- asyncpg handles connection pooling via SQLAlchemy's pool
- Default pool_size=5, max_overflow=10 is reasonable start
- For production: consider PgBouncer if connection limits are hit

Sources:
- [PostgreSQL 16](https://www.postgresql.org/docs/16/)

---

## Infrastructure

### Docker

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Docker | 27.x | Containerization | HIGH |
| Docker Compose | 2.32.x | Multi-container orchestration | HIGH |

**Development setup:**
```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ontology_hub
      POSTGRES_USER: ontology_hub
      POSTGRES_PASSWORD: dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    depends_on:
      - db

  frontend:
    build: ./frontend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
```

**Production considerations:**
- Use multi-stage builds for smaller images
- Don't run database in container for production (use managed service)
- Add Traefik or nginx for reverse proxy and HTTPS
- Use Gunicorn + Uvicorn workers for production

Sources:
- [FastAPI Docker](https://fastapi.tiangolo.com/deployment/docker/)
- [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template)

---

## What NOT to Use

### Backend Anti-Recommendations

| Technology | Why NOT |
|------------|---------|
| Flask | No native async support; FastAPI is better for this use case |
| Django | Overkill; ORM is sync-first; admin panel not needed |
| SQLModel | Less flexible than SQLAlchemy for complex queries |
| Pydantic v1 | Deprecated, no Python 3.14 support |
| rdflib / Owlready2 / pySHACL | Wrong paradigm - SemanticSchemas is JSON, not RDF/OWL |
| Celery | No long-running background tasks needed; if needed, use FastAPI BackgroundTasks |
| requests | Sync only; use httpx for async |

### Frontend Anti-Recommendations

| Technology | Why NOT |
|------------|---------|
| Create React App | Deprecated; use Vite |
| Next.js | SSR complexity not needed for this project |
| Redux / Redux Toolkit | Overkill; TanStack Query + Zustand is simpler |
| Axios | Use native fetch or let TanStack Query handle it |
| CSS-in-JS (styled-components, emotion) | Runtime overhead; Tailwind is faster |
| Material UI / Chakra | Heavier than shadcn/ui; less customizable |
| Moment.js | Deprecated; use date-fns if needed |

### Infrastructure Anti-Recommendations

| Technology | Why NOT |
|------------|---------|
| Kubernetes | Overkill for single-service deployment; Docker Compose is sufficient |
| AWS Lambda / Serverless | Cold starts hurt UX; better for this use case to have always-on service |
| MongoDB | Relational data (categories, properties, relationships); Postgres is better fit |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| FastAPI + Pydantic | HIGH | Verified with PyPI, official docs |
| SQLAlchemy 2.0 async | HIGH | Well-documented, production-proven |
| React 19 + Vite 6 | HIGH | Stable releases, good compatibility |
| TanStack Query v5 | HIGH | Mature, v5 stable since Oct 2023 |
| GitHub OAuth | HIGH | Official GitHub docs confirm approach |
| Ontology validation approach | HIGH | Custom validation is clearly better than RDF tools for JSON schemas |
| shadcn/ui + Tailwind v4 | MEDIUM | Tailwind v4 is new (Jan 2025), but stable |
| Zustand | MEDIUM | Less widely used than Redux, but well-documented |
| Docker Compose for prod | MEDIUM | Fine for initial deployment, may need upgrade later |

---

## Installation Commands

### Backend

```bash
# Create project with uv
uv init backend
cd backend

# Add dependencies
uv add fastapi uvicorn pydantic pydantic-settings
uv add sqlalchemy asyncpg alembic
uv add authlib httpx
uv add --dev pytest pytest-asyncio pytest-cov ruff mypy
```

### Frontend

```bash
# Create Vite project
npm create vite@latest frontend -- --template react-ts
cd frontend

# Add dependencies
npm install @tanstack/react-query react-router-dom zustand
npm install react-hook-form @hookform/resolvers zod
npm install tailwindcss @tailwindcss/vite

# Add shadcn/ui
npx shadcn@latest init

# Add dev dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D eslint prettier eslint-plugin-react-hooks
```

---

## Sources

### Backend
- [FastAPI PyPI](https://pypi.org/project/fastapi/)
- [FastAPI Best Practices](https://github.com/zhanymkanov/fastapi-best-practices)
- [SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [GitHub OAuth vs GitHub Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [Authlib Documentation](https://docs.authlib.org/)

### Frontend
- [React 19 Release](https://react.dev/blog/2024/12/05/react-19)
- [Vite 6 Announcement](https://vite.dev/blog/announcing-vite6)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://zustand.docs.pmnd.rs/)
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui](https://ui.shadcn.com/)

### Ontology/Validation
- [Comparing Python Ontology Libraries](https://incenp.org/notes/2025/comparing-python-ontology-libraries.html)
- [rdflib PyPI](https://pypi.org/project/rdflib/)

### Infrastructure
- [FastAPI Docker Deployment](https://fastapi.tiangolo.com/deployment/docker/)
- [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template)
