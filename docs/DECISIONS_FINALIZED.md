# Implementation Decisions - Finalized

This document records all finalized design decisions for the NFL Loser Pick'em Bot.

---

## Game Rules & Mechanics

### ✅ Auto-Assignment for Missing Picks
**Decision:** Teams that **won in that specific week** and haven't been used by the player
- Requires waiting until all games are final
- Assigns from actual winners, ensuring it's a "bad" pick
- More challenging for players who forget

### ✅ Tie Handling
**Decision:** Ties count as **losses**
- Simplest to implement
- Consistent with "pick to lose" mechanic
- If picked team doesn't lose, player doesn't win

### ✅ Outcome: All Games Tie
**Decision:** Everyone who picked gets a **loss**
- Consistent with tie handling rule
- Extremely rare edge case

### ✅ Team Doesn't Play That Week
**Decision:** **Admin must fix** - players cannot pick teams without games
- Database trigger validates team has game in that week
- Prevents invalid picks at submission time
- Admin can manually adjust if schedule errors occur

---

## Week & Season Management

### ✅ Week Opening
**Decision:** **Hybrid** - Auto-open Tuesday 9am with admin override
- Automated for convenience
- Admin can manually open earlier/later if needed
- Consistent schedule for players

### ✅ Playoff Weeks
**Decision:** **Not supported** - 18-week regular season only
- Keeps v1 scope manageable
- Can add in future versions
- Clearly defined season boundaries

### ✅ Mid-Season Joins
**Decision:** Players can join anytime, **no penalties** for missed weeks
- Encourages participation throughout season
- Tracked via `joined_week_id` in database
- Standings only count weeks after join
- More inclusive and flexible

### ✅ Game Postponements
**Decision:** **Unlock picks and extend deadline** to new kickoff time
- Automatically handled when ESPN API updates kickoff time
- Fair to players who picked based on original schedule
- Admin can override if needed

---

## Player Experience

### ✅ Reminder Preferences
**Decision:** **Workspace-wide only** - simpler than per-player
- Friday and Sunday reminders
- Can be disabled at workspace level
- Separate toggles for each day
- Reduces complexity

### ✅ Pick Visibility
**Decision:** Picks shown **after week finalization** in summary
- Maintains privacy during week
- Shows which teams were picked in public summary
- Creates suspense until finalization
- Allows players to see strategies

### ✅ Player Identity
**Decision:** By **platform user ID** only
- Most reliable identification method
- No cross-platform linking needed
- Simple and secure

---

## Multi-Tenancy & Data

### ✅ Multiple Leagues Per Workspace
**Decision:** **One league only** per workspace
- Simplifies v1 implementation
- Workspace = league
- Architecture supports multiple leagues in future

### ✅ Historical Data
**Decision:** **Export to JSON/CSV and purge** old seasons
- Keeps database lean and performant
- Archives preserved for historical reference
- Auto-export after 90 days (configurable)
- Can restore from archive if needed

---

## Technical Implementation

### ✅ Node.js Version
**Decision:** **Node.js 22 LTS**
- Long-term support until April 2027
- Better performance and modern features
- Excellent serverless compatibility

### ✅ Platform Priority
**Decision:** **Slack first**, then Discord
- Slack more common in workplaces
- Adapter pattern makes Discord addition straightforward
- Can focus on one platform for v1

### ✅ Image Generation
**Decision:** **Server-side with canvas library**
- Lightweight and fast
- Serverless-friendly
- No external dependencies
- Complete control over rendering

### ✅ Bot Permissions
**Decision:** **Moderate** - DMs, post to channels, read user info
- Enough for full functionality
- Not overly permissive
- Standard for bot applications

---

## Implementation Notes

### Database Changes Made
1. ✅ Added `reminder_friday_enabled` and `reminder_sunday_enabled` to `workspaces`
2. ✅ Removed `timezone_override` from `players` (workspace-wide only)
3. ✅ Added `joined_week_id` to `players` for mid-season tracking
4. ✅ Added trigger `check_team_plays_in_week()` to validate picks
5. ✅ Archive configuration added to config

### Service Interface Updates
1. ✅ `IPickService.assignRandomTeam()` - documented to use teams that won
2. ✅ `IPickService.unlockPicksForGame()` - added for postponements
3. ✅ `IStandingsService.initializeStanding()` - now requires `joinedWeekId`
4. ✅ `IArchiveService` - new service for export/purge functionality

### Configuration Updates
1. ✅ Added `SYNC_GAMES_CRON` for hourly game updates
2. ✅ Added archive configuration section
3. ✅ Simplified reminder system (workspace-wide)

---

## Validation Rules Summary

| Rule | Enforcement |
|------|-------------|
| No repeat teams per season | Database trigger |
| One pick per week | UNIQUE constraint |
| Team must play in week | Database trigger (new) |
| Pick locks at kickoff | Application logic |
| Ties count as losses | Outcome calculation |
| Mid-season joins allowed | Application logic |
| Postponements unlock picks | Application logic |

---

## Future Enhancements (Not in v1)

- [ ] Per-player reminder preferences
- [ ] Discord support (after Slack)
- [ ] Advanced statistics
- [ ] Historical season browser
- [ ] Web dashboard

---

**Status:** All decisions finalized ✅  
**Ready for:** Phase 2+ implementation  
**Last Updated:** Based on DECISIONS.md review
