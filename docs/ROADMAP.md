# Development Roadmap

## Phase 1: Core Infrastructure ✅
- [x] Project scaffolding
- [x] Database schema design
- [x] TypeScript types and interfaces
- [x] Service layer interfaces
- [x] Command handler structure
- [x] Configuration management

## Phase 2: Database Layer 🔲
- [ ] PostgreSQL connection pool setup
- [ ] Implement all database repository methods
- [ ] Add transaction support
- [ ] Write database integration tests
- [ ] Add database seeding scripts
- [ ] Test migration rollback

## Phase 3: Service Layer 🔲
- [ ] Implement PickService
- [ ] Implement WeekService
- [ ] Implement StandingsService
- [ ] Implement GameService
- [ ] Implement AuditService
- [ ] Write unit tests for all services

## Phase 4: Platform Adapters 🔲
- [ ] Slack adapter implementation
  - [ ] Authentication
  - [ ] Command parsing
  - [ ] Message formatting (ephemeral, public)
  - [ ] DM support
- [ ] Discord adapter implementation
  - [ ] Authentication
  - [ ] Command parsing
  - [ ] Embed formatting
  - [ ] DM support
- [ ] Adapter integration tests

## Phase 5: Data Ingestion 🔲
- [ ] ESPN API client
- [ ] Team mapping utilities
- [ ] Schedule seeding
- [ ] Live score polling
- [ ] Error handling and retries
- [ ] Data normalization
- [ ] Integration tests with fixtures

## Phase 6: Scheduler 🔲
- [ ] Week open automation
- [ ] Reminder system
- [ ] Game sync jobs
- [ ] Week finalization triggers
- [ ] Timezone handling
- [ ] Job error handling

## Phase 7: Render Service 🔲
- [ ] Embed/block message generators
- [ ] Weekly summary image generation (canvas)
- [ ] Color coding (wins/losses)
- [ ] Player grid layout
- [ ] Image upload/storage
- [ ] Visual tests

## Phase 8: Command Router 🔲
- [ ] Command parsing logic
- [ ] Permission checking
- [ ] Error handling
- [ ] Help system
- [ ] Admin command validation

## Phase 9: Integration & Testing 🔲
- [ ] End-to-end tests
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation review

## Phase 10: Deployment 🔲
- [ ] Deployment scripts
- [ ] CI/CD pipeline
- [ ] Monitoring setup
- [ ] Backup strategy
- [ ] Production documentation

## Future Enhancements 💡
- [ ] Multi-league support
- [ ] Player statistics dashboard
- [ ] Historical season archives
- [ ] Playoff mode
- [ ] Custom scoring rules
- [ ] Mobile notifications
- [ ] Web dashboard
- [ ] Trading/waiver system
- [ ] Integration with other sports

---

## Current Focus

**Next Up:** Implement Database Layer (Phase 2)

**Blockers:** None - awaiting decisions in DECISIONS.md

**Questions:** See docs/DECISIONS.md for open questions
