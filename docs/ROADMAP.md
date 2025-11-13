# Development Roadmap

## Phase 1: Core Infrastructure ✅
- [x] Project scaffolding
- [x] Database schema design
- [x] TypeScript types and interfaces
- [x] Service layer interfaces
- [x] Command handler structure
- [x] Configuration management

## Phase 2: Database Layer ✅
- [x] D1 (SQLite) implementation
- [x] All database repository methods
- [x] Database integration tests
- [x] Database seeding scripts
- [x] Migrations and rollback

## Phase 3: Service Layer ✅
- [x] Implement PickService
- [x] Implement WeekService
- [x] Implement StandingsService
- [x] Implement GameService
- [x] Implement AuditService
- [x] Implement RenderService
- [x] Implement ArchiveService
- [x] Unit tests for PickService and WeekService (others pending)

## Phase 4: Platform Adapters ✅
- [x] Discord adapter implementation (webhook interactions, user mapping)
- [x] Slack adapter implementation (Bolt framework, user mapping)
- [x] Command routing and context wiring
- [x] Platform-specific response formatting

## Phase 5: Data Ingestion ✅
- [x] ESPN API client implementation with retry logic
- [x] Data provider adapter pattern (ESPN + TheSportsDB support)
- [x] Team mapping utilities (ESPN IDs and abbreviations)
- [x] Schedule seeding
- [x] Live score polling with exponential backoff retry
- [x] Error handling and graceful degradation
- [x] Data normalization and validation (status, scores, dates)
- [x] Integration tests structure (date handling refinement pending)
- [x] Comprehensive documentation in DATA_INGESTION.md

## Phase 6: Scheduler ✅
- [x] Week open automation
- [x] Reminder system
- [x] Game sync jobs
- [x] Week finalization triggers
- [x] Timezone handling
- [x] Job error handling

## Phase 7: Render Service ⏳ (Partial)
- [x] Embed/block message generators (RenderService)
- [x] Message formatting for Discord/Slack
- [ ] Weekly summary image generation (placeholder only)
  - [ ] **REVIEW:** Evaluate alternatives to canvas (Cloudinary, Puppeteer, sharp, etc.)
  - [ ] Note: canvas currently optional dependency due to Windows native build requirements
- [ ] Color coding (wins/losses)
- [ ] Player grid layout
- [ ] Image upload/storage
- [ ] Visual tests

## Phase 8: Command Router 🔲 (Not Started)
- [ ] Command parsing logic
- [ ] Permission checking
- [ ] Error handling
- [ ] Help system
- [ ] Admin command validation

## Phase 9: Integration & Testing 🔲 (Next Focus)
- [ ] End-to-end tests
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation review
- [x] Unit/integration tests for database and some services

## Phase 10: Deployment 🔲 (Not Started)
- [ ] Deployment scripts
- [ ] CI/CD pipeline
- [ ] Monitoring setup
- [ ] Backup strategy
- [ ] Archive/export automation
- [ ] Production documentation

## Future Enhancements 💡
- [~] Discord support (full adapter implemented)
- [~] Slack support (full adapter implemented)
- [ ] Multi-league support per workspace
- [ ] Per-player reminder preferences & timezone overrides
- [ ] Image generation service decision (evaluate canvas alternatives)
- [ ] Player statistics dashboard
- [ ] Historical season archives browser
- [ ] Playoff mode
- [ ] Custom scoring rules
- [ ] Mobile notifications
- [ ] Web dashboard
- [ ] Trading/waiver system
- [ ] Integration with other sports

---

## Current Focus

**Next Up:** Command Router (Phase 8) and Integration & Testing (Phase 9)

**Blockers:** None - all decisions finalized in DECISIONS_FINALIZED.md

**Questions:** All answered - see docs/DECISIONS_FINALIZED.md
