## Testing Strategy

Phase 9 establishes a layered test approach:

### Layers
1. Unit Tests
   - Service logic in isolation (e.g., validation in `PickService`).
2. Integration Tests
   - Multiple services + real SQLite schema (`better-sqlite3`) exercising end-to-end flows.
3. Migration Tests
   - Detect missing schema elements and validate forward compatibility (e.g., updated_at columns added in migrations 0006/0007).

### Key Integration Scenarios
- Command Routing (`command-router.test`): routing, permission denial, friendly error mapping.
- Pick Workflow (`pick-workflow.test`): successful creation, duplicate prevention, audit logging.
- Week Lifecycle (`week-lifecycle.test`): opening, locking at kickoff, finalization, outcome calculation, standings updates.
- Scheduler (`scheduler.test`): automated week opening, game syncing, finalization triggers.
- Data Ingestion (`data-ingestion.test`): provider-driven game upsert and status transitions with audit trails.
- Render Service (`render-service.test`): image generation using Satori + Resvg producing PNG buffer.
- Standings Edge Cases (`standings-edge.test`): tie handling (loss), cancelled game neutrality, auto-assignment for missing picks.
- Error Mapping (`error-mapping.test`): conversion of technical errors to user-friendly messages.
- Season Rollover (`season-rollover.test`): completing final week marks season completed and seeds next upcoming season.
- Migration Rollback Detection (`migration-rollback.test`): failure before migration, success after applying missing columns.

### Conventions
- Each test creates an isolated in-memory database and runs required migrations explicitly.
- Date fields are stored as ISO strings; services pass Date objects which are converted in `Database` update methods.
- Boolean values are stored as INTEGER (1/0) for Cloudflare D1 (SQLite).
- Audit payloads serialized via JSON to TEXT then deserialized by `AuditService`/`Database` read methods.

### Extensibility
Add new provider tests by stubbing `IDataProvider.fetchGamesForWeek` returning deterministic sequences. For platform adapter tests, introduce mock adapters capturing outbound messages without external API calls.

### Future Enhancements
- Load testing for image generation and large leaderboards.
- Property-based tests for pick validation rules.
- Fuzz tests for command parsing edge cases (excess whitespace, unicode team names).

---
Generated as part of Phase 9 completion to document current testing coverage.
