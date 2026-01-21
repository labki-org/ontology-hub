# Domain Pitfalls

**Domain:** Ontology/Schema Management Platform with GitHub Integration
**Researched:** 2026-01-20
**Confidence:** HIGH (multiple authoritative sources)

---

## Critical Pitfalls

Mistakes that cause rewrites, security incidents, or major architectural rework.

---

### Pitfall 1: Capability URL Token Leakage

**What goes wrong:** Bearer tokens embedded in URLs leak through multiple vectors: server logs, Referer headers, browser history, and redirect chains. Users share "draft preview" links casually, not realizing they grant full edit access.

**Why it happens:** URLs feel safe because they're "just links." Developers underestimate how many systems capture full URLs. Users don't understand capability URLs grant bearer-token-level access.

**Consequences:**
- Unauthorized draft modifications
- Draft content exposed to unintended parties
- No audit trail of who actually accessed/modified drafts
- Inability to revoke access without regenerating all URLs

**Warning signs:**
- Logs contain full URLs with tokens
- No token rotation mechanism designed
- Single token grants both read and write access
- No differentiation between "view" and "edit" capabilities

**Prevention:**
1. **Fragment-based tokens:** Place token in URL fragment (`#token=xyz`) which is not sent to server or included in Referer headers
2. **Scoped tokens:** Separate read-only (`?view=token`) vs read-write (`?edit=token`) capabilities
3. **Short-lived tokens:** 24-48 hour expiration with rotation mechanism
4. **Server-side token exchange:** Client retrieves token from fragment, exchanges for session cookie via Authorization header
5. **Log sanitization:** Strip query parameters and fragments from all logging

**Detection:**
- Audit all logging to verify URL parameters stripped
- Test Referer headers on external link clicks
- Review browser history after draft access

**Phase mapping:** Must be addressed in Phase 1 (Core Infrastructure). Cannot be retrofitted without URL scheme redesign.

**Sources:**
- [Neil Madden: Towards a Standard for Bearer Token URLs](https://neilmadden.blog/2021/03/20/towards-a-standard-for-bearer-token-urls/)
- [Neil Madden: Can You Ever Safely Include Credentials in a URL?](https://neilmadden.blog/2019/01/16/can-you-ever-safely-include-credentials-in-a-url/)
- [Bearer Capability URIs Demystified](https://ariadne.space/2019/10/11/demystifying-bearer-capability-uris/)

---

### Pitfall 2: GitHub OAuth Scope Creep

**What goes wrong:** OAuth apps request broad scopes "just in case," granting access far beyond what's needed. Users authorize access to ALL repositories when only one is relevant. Tokens persist indefinitely, creating long-term attack surface.

**Why it happens:** GitHub OAuth scopes are coarse-grained compared to GitHub Apps. Developers request `repo` scope for convenience, which grants full read/write to all repositories. No built-in mechanism to limit to specific repos at OAuth time.

**Consequences:**
- Single compromised token exposes all user repositories
- Users hesitant to authorize due to excessive permissions
- Compliance issues (audit logs show over-permissioned access)
- Supply chain attack vector if OAuth flow compromised

**Warning signs:**
- Requesting `repo` scope when `public_repo` or read-only suffices
- No token refresh/rotation strategy
- OAuth app instead of GitHub App
- No organization access restrictions consideration

**Prevention:**
1. **Use GitHub Apps instead of OAuth Apps:** Fine-grained permissions, repository-scoped installation, short-lived tokens
2. **Minimal scopes:** Request only what's needed for PR-time validation
3. **Token rotation:** Implement refresh token flow, revoke on logout
4. **User education:** Explain exactly why each permission is requested
5. **Organization restrictions:** Document that org admins may need to approve

**Detection:**
- Review requested scopes in OAuth configuration
- Test flow with user who has many private repos
- Verify token expiration and refresh behavior

**Phase mapping:** Phase 2 (GitHub Integration). Scope decisions made here are hard to change without user re-authorization.

**Sources:**
- [GitHub: Best Practices for OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app)
- [GitHub OAuth Phishing Attack (April 2025)](https://vorlon.io/saas-security-blog/new-oauth-phishing-attack-github-security)
- [GitHub: Security Updates for Apps (2025)](https://github.blog/changelog/2025-06-24-security-updates-for-apps-and-api-access/)

---

### Pitfall 3: Validation Engine False Positives Erode Trust

**What goes wrong:** Breaking change detection is either too aggressive (flags non-breaking changes) or too permissive (misses actual breaking changes). Users learn to ignore warnings, defeating the tool's purpose.

**Why it happens:** Defining "breaking change" is context-dependent. A field removal breaks consumers using it but not others. Automated detection cannot know which fields consumers actually use. Research shows even major ecosystems (Maven Central) fail to properly version breaking changes.

**Consequences:**
- Users ignore all warnings (cry wolf effect)
- Actual breaking changes slip through
- Trust in validation system collapses
- Users route around validation entirely

**Warning signs:**
- No severity levels in warnings
- No way for users to acknowledge/dismiss known issues
- No historical data about actual consumer impact
- Binary "breaking/not-breaking" classification

**Prevention:**
1. **Tiered severity:** "Definitely breaking" vs "Potentially breaking" vs "Safe"
2. **Context awareness:** Track which fields are actually used by downstream consumers (if possible)
3. **Expand-contract pattern support:** Detect and guide deprecation-then-removal workflow
4. **Acknowledgment mechanism:** Let users mark warnings as "reviewed and accepted"
5. **Conservative defaults:** Start strict, allow loosening per-project

**Detection:**
- User research: Do users trust the warnings?
- Track warning-to-action ratio
- Audit false positive rate in production

**Phase mapping:** Phase 3 (Validation Engine). Initial implementation should be conservative; tuning happens over time with real-world feedback.

**Sources:**
- [Semantic Versioning vs Breaking Changes (IEEE)](https://ieeexplore.ieee.org/document/6975655)
- [Practical vs Strict Semantic Versioning](https://aaronstannard.com/oss-semver/)
- [GraphQL Inspector](https://the-guild.dev/graphql/inspector/docs)

---

### Pitfall 4: GitHub Webhook Event Loss

**What goes wrong:** GitHub webhooks fail silently, are delivered out of order, or are duplicated. System assumes all PR events arrive reliably, leading to stale or inconsistent state.

**Why it happens:** GitHub does NOT automatically retry failed webhook deliveries. Network issues, server downtime, or slow response (>10 seconds) cause permanent event loss. Events may arrive out of order.

**Consequences:**
- PR status shows "pending" indefinitely
- Merged PRs not reflected in published state
- Duplicate processing causes data corruption
- Users lose trust in sync reliability

**Warning signs:**
- No idempotency in webhook handlers
- No periodic reconciliation mechanism
- No monitoring of webhook delivery status
- Reliance on webhook as sole source of truth

**Prevention:**
1. **Idempotent handlers:** Store and check `X-GitHub-Delivery` header
2. **Periodic polling:** Reconciliation job that polls GitHub API to catch missed events
3. **Event timestamps:** Use payload timestamps, not arrival order
4. **Delivery monitoring:** Use GitHub API to check delivery status, manually redeliver failures
5. **Graceful degradation:** System works (slowly) even if webhooks stop

**Detection:**
- Monitor webhook delivery success rate via GitHub API
- Compare webhook-derived state vs API-polled state
- Alert on webhook processing latency >10s

**Phase mapping:** Phase 2 (GitHub Integration). Must be designed from the start; retrofitting polling is difficult.

**Sources:**
- [GitHub: Handling Failed Webhook Deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries)
- [GitHub: Troubleshooting Webhooks](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks)
- [Hookdeck: GitHub Webhooks Best Practices](https://hookdeck.com/webhooks/platforms/guide-github-webhooks-features-and-best-practices)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

---

### Pitfall 5: Schema Drift Between Environments

**What goes wrong:** Different sources (GitHub, drafts, published index) have different versions of the same schema. No single source of truth. Users see different content depending on which view they access.

**Why it happens:** Multiple data stores (GitHub as source, local index for search, draft storage for edits) naturally diverge. Eventual consistency is hard to reason about. Sync failures are silent.

**Consequences:**
- Search returns stale results
- Draft edits overwrite newer published versions
- Merge conflicts invisible until PR creation
- User confusion about "which version is real"

**Warning signs:**
- No version vectors or timestamps on all data
- No reconciliation job
- Different code paths for reading from different sources
- No "last synced" visibility to users

**Prevention:**
1. **Single source of truth:** GitHub is authoritative for published content
2. **Version vectors:** Every record has GitHub commit SHA + local modification timestamp
3. **Conflict detection:** Before saving draft, check if upstream changed
4. **Visible sync status:** Show users when index was last synced
5. **Eventual consistency tolerance:** Design UX to handle stale reads gracefully

**Detection:**
- Compare index content hash vs GitHub content hash periodically
- Monitor sync job success/failure rates
- User reports of "I just changed this but search shows old version"

**Phase mapping:** Phase 1 (Data Model) and Phase 2 (GitHub Sync). Data model must support versioning from day one.

**Sources:**
- [Confluent: Schema Management Costs](https://www.confluent.io/blog/schema-management-costs/)
- [Google Cloud: Balancing Strong and Eventual Consistency](https://cloud.google.com/datastore/docs/articles/balancing-strong-and-eventual-consistency-with-google-cloud-datastore)

---

### Pitfall 6: Rate Limiting Without User Identity

**What goes wrong:** Without user accounts, abuse prevention relies on IP addresses, which are unreliable (NAT, VPNs, mobile networks). Legitimate users behind shared IPs get blocked; attackers use distributed IPs to evade limits.

**Why it happens:** Traditional rate limiting assumes "one IP = one user." Modern networks break this assumption. Anonymous systems lack better identifiers.

**Consequences:**
- Corporate users (shared IP) constantly rate-limited
- Attackers trivially bypass with rotating IPs
- VPN/Tor users unfairly penalized
- No way to distinguish good vs bad actors

**Warning signs:**
- Rate limits solely on IP address
- No graduated response (immediate hard block)
- No allowlisting mechanism for known-good actors
- No CAPTCHA or proof-of-work fallback

**Prevention:**
1. **Layered identification:** IP + User-Agent + behavioral fingerprint
2. **Graduated response:** Slow down before blocking, CAPTCHA before ban
3. **Token bucket:** Allow bursts, smooth over time
4. **Allowlisting:** Known CI/CD systems, academic institutions
5. **Capability URL as identity:** Rate limit per capability token, not just IP
6. **Anonymous credentials (emerging):** Watch Cloudflare's Privacy Pass work

**Detection:**
- Monitor false positive rate (legitimate users blocked)
- Track evasion patterns (distributed attacks)
- User complaints from corporate/academic networks

**Phase mapping:** Phase 1 (Core Infrastructure). Rate limiting architecture affects all endpoints.

**Sources:**
- [Cloudflare: Anonymous Credentials for Rate Limiting](https://blog.cloudflare.com/private-rate-limiting/)
- [DEV: Abuse Prevention Without User Accounts](https://dev.to/vibetalk_51a1a0b171d67095/how-we-designed-abuse-prevention-without-user-accounts-in-an-anonymous-chat-app-5gp5)

---

### Pitfall 7: GitHub API Rate Limit Exhaustion

**What goes wrong:** Application hits GitHub's primary or secondary rate limits, causing sync failures, broken PR integrations, and degraded user experience during high-traffic periods.

**Why it happens:** GitHub's rate limits are per-account/per-IP, not per-application-need. Secondary rate limits trigger on "suspicious" patterns (many concurrent requests, bulk operations). Unauthenticated requests have very low limits.

**Consequences:**
- Sync jobs fail mid-execution
- PR validation stalls during busy periods
- Users see errors when GitHub quota exhausted
- Batch operations (initial import) impossible

**Warning signs:**
- No rate limit monitoring
- No request queuing/batching
- Unauthenticated requests for read-only data
- No caching of GitHub responses

**Prevention:**
1. **Authenticated requests:** Always use OAuth tokens (higher limits)
2. **Request batching:** GraphQL for bulk queries, batch API calls
3. **Aggressive caching:** Cache GitHub responses, use conditional requests (If-None-Match)
4. **Rate limit monitoring:** Track `X-RateLimit-Remaining`, pause before hitting limit
5. **Exponential backoff:** On 429, wait with `Retry-After` header
6. **Secondary rate limit awareness:** Spread bulk operations over time

**Detection:**
- Monitor rate limit headers on every response
- Alert when remaining quota drops below threshold
- Track 429 response frequency

**Phase mapping:** Phase 2 (GitHub Integration). Rate limit handling must be built into GitHub client wrapper.

**Sources:**
- [GitHub Community: Rate Limit Best Practices](https://github.com/orgs/community/discussions/151675)
- [Endor Labs: GitHub API Rate Limits](https://www.endorlabs.com/learn/how-to-get-the-most-out-of-github-api-rate-limits)

---

### Pitfall 8: Ontology Browser Navigation at Scale

**What goes wrong:** Tree-based navigation becomes unusable with large ontologies. Deep hierarchies require excessive clicking. Users can't find what they're looking for in complex schemas.

**Why it happens:** "It works fine in testing" with small ontologies. Production ontologies may have thousands of classes with deep inheritance. Conventional tree views don't scale.

**Consequences:**
- Users abandon browser for text search only
- Important relationships invisible
- No understanding of ontology structure
- Feature becomes useless for real-world ontologies

**Warning signs:**
- Only tree-based navigation implemented
- No search with context (where does result fit in hierarchy?)
- No visualization of relationships
- No performance testing with large (1000+ class) ontologies

**Prevention:**
1. **Multi-modal navigation:** Tree + search + graph visualization
2. **Search with context:** Show ancestry path for search results
3. **Lazy loading:** Load tree branches on demand
4. **Breadcrumb navigation:** Always show current position in hierarchy
5. **Performance budgets:** Test with realistic large ontologies early

**Detection:**
- User testing with large real-world ontologies
- Navigation analytics (how many clicks to find target?)
- Performance profiling with 1000+ node trees

**Phase mapping:** Phase 4 (UI/Browsing). Design for scale from the start; don't assume small test data represents production.

**Sources:**
- [ResearchGate: Ontology Explorer User Interface](https://www.researchgate.net/figure/Ontology-Explorer-User-Interface-a-tab-selector-b-search-box-c-hierarchical_fig3_376749118)
- [Academia: Navigation over Large Ontologies](https://www.academia.edu/2685891/Navigation_over_a_large_ontology_for_industrial_web_applications)

---

## Minor Pitfalls

Mistakes that cause annoyance, edge-case bugs, or minor technical debt.

---

### Pitfall 9: Draft Expiration Without User Warning

**What goes wrong:** Drafts expire (by design), but users lose work because they weren't warned. No reminder before expiration, no grace period, no recovery option.

**Consequences:**
- User loses hours of work
- Trust in system destroyed
- Users avoid draft feature entirely
- Support burden from "where did my draft go?"

**Prevention:**
1. **Visible expiration:** Show "expires in X hours" prominently
2. **Email/notification warning:** If email provided, warn 24h before expiration
3. **Grace period:** "Expired" drafts recoverable for 7 days
4. **Extend option:** One-click to extend expiration
5. **Local storage backup:** Browser caches draft content as fallback

**Phase mapping:** Phase 1 (Draft System). Must be designed into draft lifecycle from the start.

---

### Pitfall 10: MediaWiki Export Format Brittleness

**What goes wrong:** MediaWiki updates change export format, breaking downstream parsers. Parser relies on undocumented structure that changes without notice.

**Consequences:**
- Import pipeline breaks silently
- Imported content corrupted or missing
- Manual intervention required after MediaWiki updates
- Wikidata/Wikipedia imports unpredictable

**Prevention:**
1. **Schema validation:** Validate against official XML schema (export-0.11.xsd)
2. **Version detection:** Check MediaWiki version, warn on unknown versions
3. **Defensive parsing:** Handle missing optional fields gracefully
4. **Subscribe to announcements:** Follow mediawiki-api-announce mailing list
5. **Integration tests:** Test against real MediaWiki exports regularly

**Phase mapping:** Phase 5 (External Imports). Defensive design from the start.

**Sources:**
- [MediaWiki: API Breaking Changes Announcement](https://lists.wikimedia.org/hyperkitty/list/mediawiki-api-announce@lists.wikimedia.org/message/B45IQ4F5USISN7H24OXF65EQLSLXVDHD/)
- [MediaWiki: API Data Formats](https://www.mediawiki.org/wiki/API:Data_formats)

---

### Pitfall 11: Search Index Staleness Visibility

**What goes wrong:** Users search, get stale results, don't understand why, conclude system is broken.

**Consequences:**
- User confusion and frustration
- Bug reports that aren't bugs
- Workarounds that bypass search
- Loss of trust in search feature

**Prevention:**
1. **"Last indexed" timestamp:** Show when content was last synced
2. **Freshness indicator:** Visual cue for recently-updated vs stale content
3. **Manual refresh:** Button to "refresh from source"
4. **Expectation setting:** Documentation explains eventual consistency

**Phase mapping:** Phase 4 (Search/Index). UX decision, not just backend concern.

---

### Pitfall 12: Validation Message UX Antipatterns

**What goes wrong:** Validation errors are technically accurate but incomprehensible to users. Messages cite schema paths, not human-readable field names. No guidance on how to fix.

**Consequences:**
- Users can't understand what's wrong
- Support burden increases
- Users avoid validation feature
- Errors ignored because they're confusing

**Prevention:**
1. **Human-readable messages:** "The 'description' field is required" not "$.properties.description: required"
2. **Fix suggestions:** "Add a description field" not just "missing required field"
3. **Visual highlighting:** Show errors inline in schema editor
4. **Progressive disclosure:** Summary first, details on expand
5. **Examples:** Show what valid content looks like

**Phase mapping:** Phase 3 (Validation Engine). UX layer over technical validation.

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| Phase 1 | Capability URLs | Token leakage vectors | Fragment-based tokens, scoped access, short TTL |
| Phase 1 | Data Model | No version tracking | Include commit SHA + timestamps from day one |
| Phase 1 | Rate Limiting | IP-only identification | Layered approach with capability token |
| Phase 2 | GitHub OAuth | Over-permissioned tokens | Use GitHub Apps, minimal scopes |
| Phase 2 | Webhooks | Silent event loss | Idempotency + polling reconciliation |
| Phase 2 | API Rate Limits | Quota exhaustion | Caching, batching, monitoring |
| Phase 3 | Breaking Change Detection | False positives erode trust | Tiered severity, acknowledgment workflow |
| Phase 3 | Validation Messages | Incomprehensible errors | Human-readable with fix suggestions |
| Phase 4 | Ontology Browser | Doesn't scale to large ontologies | Multi-modal navigation, lazy loading |
| Phase 4 | Search Freshness | Users don't understand staleness | Visible sync status, freshness indicators |
| Phase 5 | MediaWiki Import | Format changes break parser | Schema validation, defensive parsing |

---

## Prevention Strategy Summary

### Security Pitfalls
- **Capability URLs:** Use fragment-based tokens, implement token rotation, separate read/write capabilities
- **OAuth:** Prefer GitHub Apps over OAuth Apps, request minimal scopes, implement token refresh
- **Rate Limiting:** Layer identification methods beyond IP, use capability tokens as rate limit keys

### Data Consistency Pitfalls
- **Schema Drift:** Single source of truth (GitHub), version vectors on all records, visible sync status
- **Webhook Reliability:** Idempotent handlers, polling reconciliation, delivery monitoring
- **Index Staleness:** Visible "last synced" timestamps, freshness indicators in search results

### UX Pitfalls
- **Draft Expiration:** Visible countdown, warning notifications, grace period recovery
- **Validation Messages:** Human-readable errors, fix suggestions, inline highlighting
- **Ontology Navigation:** Multi-modal (tree + search + graph), lazy loading, performance testing at scale

### Integration Pitfalls
- **GitHub Rate Limits:** Caching, batching, authenticated requests, rate limit monitoring
- **MediaWiki Export:** Schema validation, version detection, defensive parsing, integration tests

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Capability URL Security | HIGH | Well-documented in security literature (Neil Madden, RFC 6750) |
| GitHub OAuth/Webhook | HIGH | Official GitHub documentation, recent security advisories |
| Schema Drift/Consistency | HIGH | Common distributed systems problem, well-documented patterns |
| Validation False Positives | MEDIUM | Research exists but domain-specific tuning required |
| Rate Limiting Without Accounts | MEDIUM | Emerging solutions (Privacy Pass), no established best practice |
| Ontology Browser UX | MEDIUM | Academic research exists, but specific to ontology tools |
| MediaWiki Export | LOW | MediaWiki-specific knowledge, limited recent documentation |

---

## Open Questions for Phase-Specific Research

1. **GitHub Apps vs OAuth Apps trade-offs** - Need deeper investigation during Phase 2 planning
2. **Anonymous credential systems** - Cloudflare Privacy Pass maturity for rate limiting
3. **Ontology visualization libraries** - Need hands-on evaluation during Phase 4 planning
4. **Breaking change detection specificity** - How to tune for OWL/RDF vs JSON Schema vs other formats
