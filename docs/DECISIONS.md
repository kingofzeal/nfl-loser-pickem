# Implementation Questions & Design Decisions

This document tracks open questions and design decisions for the NFL Loser Pick'em Bot implementation. Please answer these questions to guide development.

---

## 1. Auto-Assignment Logic
**Question:** When a player doesn't make a pick, the bot assigns "a random winning team not previously used." Should this be:
- [ ] **Option A:** A team that **won** in that specific week (requires waiting until all games are final)
- [ ] **Option B:** A team from the pool of **all remaining unpicked teams** (assigned at week start/finalization)
- [ ] **Option C:** A team that **is likely to win** based on betting odds (predictive approach)

**Recommended:** Option A - assign after all games final, from teams that won that week and haven't been used by the player.

**Your Decision:**
Option A

---

## 2. Tie Handling
**Question:** The spec says "Picked team wins or ties → player loss." Should we:
- [ ] **Option A:** Treat ties as losses (current spec)
- [ ] **Option B:** Treat ties as a push (no result, doesn't count)
- [ ] **Option C:** Allow admin override on tie handling

**Recommended:** Option A - ties count as losses for simplicity.

**Your Decision:**
Option A
---

## 3. Week Opening Automation
**Question:** Should weeks open automatically based on:
- [ ] **Option A:** Fixed schedule (every Tuesday 9am in workspace timezone)
- [ ] **Option B:** Dynamic (N days before first game of the week)
- [ ] **Option C:** Manual admin control only
- [ ] **Option D:** Hybrid (auto with admin override option)

**Recommended:** Option D - auto on Tuesday with admin override capability.

**Your Decision:**

---

## 4. Reminder Preferences
**Question:** Should reminders be:
- [ ] **Option A:** Workspace-wide only (all players get same reminders)
- [ ] **Option B:** Player-configurable (opt-in/opt-out per player)
- [ ] **Option C:** Time-zone aware per player
- [ ] **Option D:** All of the above

**Recommended:** Option D - workspace default with player timezone override support.

**Your Decision:**

---

## 5. Multiple Leagues Per Workspace
**Question:** Should a single workspace support:
- [ ] **Option A:** One league only (simplest)
- [ ] **Option B:** Multiple parallel leagues (different channels, separate standings)
- [ ] **Option C:** Future enhancement (add later)

**Recommended:** Option A for v1, architecture supports Option C for future.

**Your Decision:**

---

## 6. Historical Data & Archives
**Question:** After a season completes, should we:
- [ ] **Option A:** Keep all data in same tables (query by season)
- [ ] **Option B:** Archive to separate tables/database
- [ ] **Option C:** Export to JSON/CSV and purge
- [ ] **Option D:** Keep indefinitely with no archival

**Recommended:** Option A - keep all data, query by season_id.

**Your Decision:**

---

## 7. Pick Visibility
**Question:** When should other players see what teams were picked:
- [ ] **Option A:** Never (even after week completion, only see W/L outcome)
- [ ] **Option B:** After week finalization (show which team was picked in summary)
- [ ] **Option C:** Configurable per workspace
- [ ] **Option D:** Always visible (no privacy)

**Recommended:** Option B - picks visible in weekly summary after finalization.

**Your Decision:**

---

## 8. Playoff Weeks
**Question:** How should playoffs be handled:
- [ ] **Option A:** Not supported (18-week regular season only)
- [ ] **Option B:** Separate playoff league/mode
- [ ] **Option C:** Continuous into playoffs with same rules
- [ ] **Option D:** Admin decides on playoff format

**Recommended:** Option A for v1 - regular season only (18 weeks).

**Your Decision:**

---

## 9. Mid-Season Joins
**Question:** Can players join after week 1:
- [ ] **Option A:** No - must join before season starts
- [ ] **Option B:** Yes - they get losses for missed weeks
- [ ] **Option C:** Yes - they only participate in remaining weeks (no penalties)
- [ ] **Option D:** Admin discretion

**Recommended:** Option B - players can join anytime, missed weeks count as losses.

**Your Decision:**

---

## 10. Game Postponements
**Question:** If a game is postponed to a later week:
- [ ] **Option A:** Lock picks anyway at originally scheduled time
- [ ] **Option B:** Unlock picks and extend deadline to new kickoff time
- [ ] **Option C:** Allow admin to force outcome
- [ ] **Option D:** Automatic handling based on new kickoff time from API

**Recommended:** Option D with Option C fallback - picks lock at actual kickoff time (from sync), admin can override if needed.

**Your Decision:**

---

## 11. Scoring Edge Cases

### 11a. What if NO games have a loser in a week?
(Unlikely but possible if all games tie)
- [ ] **Option A:** Everyone who picked gets a loss
- [ ] **Option B:** Everyone who picked gets a win (compassion rule)
- [ ] **Option C:** No result for that week

**Your Decision:**

### 11b. What if a player's picked team doesn't play that week?
(e.g., bye week, or admin error in schedule)
- [ ] **Option A:** Count as automatic loss
- [ ] **Option B:** Allow pick change
- [ ] **Option C:** Admin must fix

**Your Decision:**

---

## 12. Platform Priority
**Question:** Which platform should be developed first:
- [ ] **Slack** (more common in workplaces)
- [ ] **Discord** (popular in gaming/casual groups)
- [ ] **Both simultaneously** (more work upfront, but equal support)

**Recommended:** Slack first, then Discord. The adapter pattern makes adding Discord straightforward.

**Your Decision:**

---

## 13. Image Generation for Weekly Summary
**Question:** How should the weekly summary image be generated:
- [ ] **Option A:** Server-side with canvas library
- [ ] **Option B:** Client-side HTML/CSS screenshot service (headless browser)
- [ ] **Option C:** Simple text table (no image)
- [ ] **Option D:** Use external service (e.g., Cloudinary, imgix)

**Recommended:** Option A - canvas is lightweight and serverless-friendly.

**Your Decision:**

---

## 14. Player Identity
**Question:** How should players be identified:
- [ ] **Option A:** By platform user ID only (user must send command from same account)
- [ ] **Option B:** By display name (allow admin to register players)
- [ ] **Option C:** By email (link platform accounts)

**Recommended:** Option A - platform user ID is most reliable.

**Your Decision:**

---

## 15. Bot Permissions
**Question:** What permissions should the bot require:
- [ ] **Minimum:** Read channels, send messages, read user info
- [ ] **Moderate:** Above + send DMs, post to specific channels
- [ ] **Maximum:** Above + manage channels, read message history

**Recommended:** Moderate permissions for full functionality.

**Your Decision:**

---

## Additional Questions/Refinements

Please add any additional questions or clarifications below:

```
[Your notes here]
```

---

**Instructions:** 
1. Check the boxes next to your preferred options
2. Add any additional context in the "Your Decision" sections
3. Add any new questions at the bottom
4. Save this file and the implementation will follow your decisions
