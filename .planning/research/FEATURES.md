# Features Research

**Domain:** Ontology/Schema Management Platform
**Researched:** 2026-01-20
**Overall Confidence:** MEDIUM-HIGH

## Executive Summary

Research surveyed schema registries (Confluent, AWS Glue, Apicurio), ontology editors (Protege, WebProtege, WebVOWL), API documentation platforms (Swagger, ReadMe, Stoplight), and developer portals. The ontology management space sits at the intersection of these domains, requiring browsing/visualization from ontology tools, version control from schema registries, and developer UX from documentation platforms.

Key insight: Users of schema/ontology platforms expect **immediate discoverability** (search, navigation, visualization), **version awareness** (diffs, compatibility), and **zero-friction interaction** (no login for browsing, minimal friction for contributions). The draft-to-PR workflow is a differentiator in this space.

---

## Table Stakes

Features users expect from any schema browsing platform. Missing these creates "broken product" perception.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Full-text search** | Users need to find entities quickly in large ontologies; every comparable platform has this | Medium | Must search across entity names, descriptions, field names |
| **Entity detail pages** | Core browsing need; users need to inspect individual categories, properties, subobjects | Low | Standard CRUD read UI |
| **Inheritance visualization** | Ontologies are hierarchical; users need to see parent/child relationships | Medium | Tree or graph view; see WebVOWL, Protege patterns |
| **Breadcrumb navigation** | Users get lost in deep hierarchies; breadcrumbs provide orientation | Low | Standard UX pattern |
| **Version/release listing** | Schema platforms track versions; users expect to see release history | Low | List view with dates and labels |
| **Diff between versions** | Core schema registry feature; users expect to compare releases | Medium | Field-level diff visualization |
| **Module browsing** | Groupings are core concept; users need to explore modules | Low | List with entity counts |
| **Profile browsing** | Curated sets are core concept; users need to discover profiles | Low | List with module composition |
| **JSON/export download** | Developers expect raw data access; mentioned in PROJECT.md as U1 need | Low | Download buttons per entity/module |
| **Responsive navigation** | Desktop-first per constraints, but sidebar/nav must be usable | Low | Standard responsive patterns |
| **Syntax highlighting** | When showing JSON/schema definitions, users expect code formatting | Low | Use Prism, Shiki, or similar |

### Rationale

These features appear in **every** surveyed platform:
- Schema registries (Confluent, Glue, Apicurio) all have search, versioning, and browsing
- Ontology tools (Protege, WebVOWL) all have hierarchy visualization and entity detail views
- Documentation platforms (Swagger, ReadMe) all have search, navigation, and export

Sources:
- [AWS Glue Schema Registry](https://docs.aws.amazon.com/glue/latest/dg/schema-registry.html)
- [Confluent Schema Registry](https://docs.confluent.io/platform/current/schema-registry/index.html)
- [Apicurio Registry](https://www.apicur.io/registry/)
- [WebVOWL](https://github.com/VisualDataWeb/WebVOWL)
- [ReadMe Documentation](https://readme.com/documentation)

---

## Differentiators

Features that would make Ontology Hub stand out. Not expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Capability-URL drafts** | Zero-account contribution workflow; unique in this space | Medium | Already in requirements; strong differentiator vs login-required tools |
| **Inline validation feedback** | Real-time feedback during draft review; schema registries do this at submit time only | High | Consistency checks, breaking change detection as you review |
| **Compatibility classification** | Automatic major/minor/patch suggestions; few tools do this interactively | High | Semver suggestions based on change impact analysis |
| **Canonical vs local overlay toggle** | Unique to MediaWiki export workflow; no comparable feature found | Medium | Visual distinction during draft review |
| **Interactive inheritance graph** | WebVOWL-style visualization with click-to-navigate; most tools have static trees | High | D3.js or similar; force-directed with entity details on click |
| **Module dependency visualization** | Show which modules depend on which; helps admins understand impact | Medium | Graph or matrix view |
| **Profile coverage matrix** | Show which modules/entities each profile includes; aids decision-making | Medium | Table or Venn diagram visualization |
| **Field-level diff with annotations** | Beyond simple diff; show why a change is breaking/additive | High | Combines diff UI with validation engine output |
| **"Time to PR" optimization** | ReadMe talks about "Time to First Call"; this is "Time to PR" | Medium | Streamlined 3-5 step flow from draft upload to PR |
| **PR structured summary** | Generated PR body with categorized changes; helps maintainers review | Medium | Template-based generation from diff analysis |
| **Faceted search** | Filter by entity type, module, version, change type | Medium | Standard in e-commerce, rare in schema tools |
| **API-first draft ingestion** | REST API accepts MediaWiki exports directly; no manual upload | Low | Already in requirements; enables automation |

### Competitive Landscape

| Platform | Differentiators We Could Match/Beat |
|----------|-------------------------------------|
| Confluent Schema Registry | Has compatibility checking, but not interactive; requires auth |
| WebProtege | Has collaboration, but requires accounts |
| Swagger/OpenAPI | Has try-it-out, but for APIs not schemas |
| ReadMe | Has analytics/dashboards, but overkill for our use case |
| Apicurio | Has API registry, but less focused on PR workflow |

Our unique position: **Anonymous draft workflow + validation feedback + PR generation**. No surveyed tool does this.

Sources:
- [Schema Evolution in Confluent](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)
- [WebProtege Collaboration](https://pmc.ncbi.nlm.nih.gov/articles/PMC3691821/)
- [ReadMe Developer Dashboard](https://docs.readme.com/main/docs/developer-dashboard)

---

## Anti-Features

Things to deliberately NOT build. Common mistakes in this domain or features that conflict with project goals.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Platform user accounts** | PROJECT.md explicitly excludes this; adds friction, maintenance burden | GitHub OAuth at PR time only; capability URLs for drafts |
| **Comments/discussion threads** | PROJECT.md excludes social features; GitHub is the discussion venue | Link to GitHub issues/PRs for discussion |
| **Realtime collaborative editing** | Overkill for draft review; high complexity; WebProtege does this but we don't need it | Single-user draft editing; parallel drafts are separate URLs |
| **Schema creation from scratch** | Ontology Hub is for reviewing/proposing changes, not authoring; Protege/editors exist | Accept imports only; direct users to MediaWiki for authoring |
| **Query execution** | SPARQL/query endpoints are complex; out of scope per PROJECT.md | Static browsing only; link to external query tools if needed |
| **Mobile-first design** | PROJECT.md specifies desktop-first; schema review is a desktop task | Responsive enough to not break, but optimize for wide screens |
| **Custom theming/white-labeling** | Single-purpose platform; adds maintenance burden | One consistent brand; labki.org theme |
| **Notification system** | Requires accounts; complexity overhead | Users watch GitHub repo for notifications |
| **Draft history/undo** | Adds significant complexity; drafts are ephemeral (7-day TTL) | Drafts are single-version; create new draft if needed |
| **Metrics dashboard** | ReadMe-style analytics is overkill; adds tracking complexity | Basic server logs for debugging; no user analytics |
| **Plugin/extension system** | Protege has this; massive complexity for niche use case | Monolithic, focused feature set |
| **Multiple schema formats** | Confluent supports Avro/Protobuf/JSON Schema; we only need SemanticSchemas JSON | Single format: SemanticSchemas JSON structure |
| **Schema inference from data** | Some tools infer schema from examples; not our workflow | Accept explicit schema definitions only |

### Rationale

These anti-features stem from:
1. **Explicit exclusions in PROJECT.md** (accounts, social, mobile)
2. **Scope control** (authoring, queries, analytics)
3. **Complexity avoidance** (plugins, multiple formats, collaboration)

The "Schema Registry" anti-patterns research also highlights:
- Avoid tight coupling to schema versions in code
- Don't build features that require "magic" (like Confluent's magic byte)
- Don't over-engineer versioning when simple works

Sources:
- [Schema Anti-Patterns](https://medium.com/indigitech-blog/schema-sharing-and-evolution-anti-patterns-and-solutions-2a7c1dc17d20)
- [17 Ways to Mess Up Schema Registry](https://www.confluent.io/blog/17-ways-to-mess-up-self-managed-schema-registry/)

---

## Feature Dependencies

```
Legend:
  A → B means B requires A (build A first)
  A ⟷ B means mutual dependency (build together)

Core Browsing Layer (Foundation)
├── Entity detail pages
├── Search (requires entities to be indexed)
├── Breadcrumb navigation (requires entity hierarchy)
└── Inheritance visualization → Entity detail pages

Version/Release Layer (builds on Browsing)
├── Version/release listing → Entity pages
├── Diff between versions → Version listing + Entity pages
└── JSON export → Entity pages

Module/Profile Layer (builds on Browsing)
├── Module browsing → Entity pages (needs entity references)
├── Profile browsing → Module browsing (profiles reference modules)
├── Module dependency viz → Module browsing
└── Profile coverage matrix → Profile browsing + Module browsing

Draft Layer (parallel to Browsing, integrates with Validation)
├── Draft ingestion API (independent)
├── Capability URL system → Draft ingestion
├── Draft review UI → Entity pages + Diff views
├── Field-level diff → Draft review UI
├── Canonical/local toggle → Draft review UI
└── Module assignment → Module browsing + Draft review UI

Validation Layer (integrates with Draft)
├── Consistency checks → Entity model understanding
├── Breaking change detection → Version/Release layer
├── Compatibility classification → Breaking change detection
├── Inline validation feedback → Draft review + Validation engine
└── Semver suggestions → Compatibility classification

PR Layer (builds on Draft + Validation)
├── GitHub OAuth → Draft review UI (triggered at end)
├── PR creation → GitHub OAuth + Draft data
└── PR structured summary → Validation output + Diff data
```

### Recommended Build Order

1. **Phase 1: Core Browsing** - Entity pages, search, navigation, inheritance viz
2. **Phase 2: Versioning** - Release listing, diff views, export
3. **Phase 3: Modules/Profiles** - Module/profile browsing, dependency viz
4. **Phase 4: Draft Foundation** - Ingestion API, capability URLs, basic review UI
5. **Phase 5: Validation** - Consistency checks, breaking change detection, inline feedback
6. **Phase 6: PR Integration** - GitHub OAuth, PR creation, structured summaries

---

## Complexity Assessment

| Category | Overall Complexity | Key Drivers |
|----------|-------------------|-------------|
| **Core Browsing** | LOW-MEDIUM | Standard CRUD; search indexing adds some complexity |
| **Versioning/Diffs** | MEDIUM | Diff algorithms; version comparison logic |
| **Module/Profile** | LOW-MEDIUM | Relationship modeling; visualization is optional enhancement |
| **Draft System** | MEDIUM-HIGH | Capability URLs, secure token handling, TTL management, state machine |
| **Validation Engine** | HIGH | Schema understanding, breaking change detection, consistency rules |
| **GitHub Integration** | MEDIUM | OAuth flow, GitHub App API, PR creation |
| **Visualization** | MEDIUM-HIGH | D3.js/graph libraries; interactive UX; performance with large graphs |

### Complexity Drivers by Feature

| Feature | Complexity | Why |
|---------|------------|-----|
| Full-text search | Medium | Postgres full-text or dedicated search (Meilisearch, Typesense) |
| Inheritance graph | Medium-High | Graph layout algorithms, click-to-navigate, performance |
| Field-level diff | Medium | JSON diff libraries exist; UI presentation is the work |
| Capability URLs | Medium | Token generation, hashing, TTL checking, security considerations |
| Breaking change detection | High | Requires semantic understanding of schema changes |
| Compatibility classification | High | Rules engine for semver suggestion; domain-specific logic |
| PR structured summary | Medium | Template-based; requires good diff categorization |

### Risk Areas

1. **Validation Engine** - Highest complexity; consider phased approach (basic → advanced rules)
2. **Graph Visualization** - Can become performance bottleneck with large ontologies; consider progressive loading
3. **Draft Security** - Capability URLs need careful implementation; token leakage risks

---

## MVP Recommendation

For MVP, prioritize table stakes plus core differentiators:

### Must Have (MVP)
1. Entity browsing with detail pages (table stakes)
2. Search across entities (table stakes)
3. Inheritance visualization (table stakes, can be simple tree view)
4. Module/profile browsing (table stakes for this domain)
5. Draft ingestion API (core differentiator)
6. Capability URL drafts (core differentiator)
7. Basic draft review UI with diffs (core differentiator)
8. GitHub OAuth + PR creation (core differentiator)

### Should Have (MVP+)
1. Version/release listing
2. Diff between versions
3. Basic validation feedback (consistency checks)
4. JSON export/download

### Nice to Have (Post-MVP)
1. Interactive graph visualization (WebVOWL-style)
2. Advanced validation (breaking change detection, semver suggestions)
3. Module dependency visualization
4. Faceted search
5. Profile coverage matrix

### Defer Indefinitely
All anti-features listed above.

---

## Sources

### Schema Registries
- [AWS Glue Schema Registry](https://docs.aws.amazon.com/glue/latest/dg/schema-registry.html) - HIGH confidence
- [Confluent Schema Registry](https://docs.confluent.io/platform/current/schema-registry/index.html) - HIGH confidence
- [Confluent Schema Evolution](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) - HIGH confidence
- [Apicurio Registry](https://www.apicur.io/registry/) - MEDIUM confidence
- [Schema Comparison 2025](https://www.automq.com/blog/kafka-schema-registry-confluent-aws-glue-redpanda-apicurio-2025) - MEDIUM confidence

### Ontology Tools
- [Protege Stanford](https://protege.stanford.edu/) - HIGH confidence
- [Protege Getting Started](http://protegeproject.github.io/protege/getting-started/) - HIGH confidence
- [WebVOWL GitHub](https://github.com/VisualDataWeb/WebVOWL) - HIGH confidence
- [WebProtege Paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC3691821/) - MEDIUM confidence

### API Documentation Platforms
- [Swagger Editor](https://swagger.io/tools/swagger-editor/) - HIGH confidence
- [ReadMe Documentation](https://readme.com/documentation) - MEDIUM confidence
- [Stoplight](https://stoplight.io/) - MEDIUM confidence

### Anti-Patterns & Best Practices
- [Schema Anti-Patterns](https://medium.com/indigitech-blog/schema-sharing-and-evolution-anti-patterns-and-solutions-2a7c1dc17d20) - MEDIUM confidence
- [Solace Schema Best Practices](https://docs.solace.com/Schema-Registry/schema-registry-best-practices.htm) - HIGH confidence

### UX Patterns
- [Faceted Search OpenSearch](https://docs.opensearch.org/latest/tutorials/faceted-search/) - HIGH confidence
- [Schema-Driven UX](https://rjv.im/blog/conceptual/schema-driven-ux) - LOW confidence
