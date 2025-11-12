import { Database } from '../../src/database/Database';
import { testConnection, closePool } from '../../src/database/connection';
import { Team, Season, Week, Game, Workspace, Player, Pick, Standing } from '../../src/types';

describe('Database Integration', () => {
  let db: Database;

  beforeAll(async () => {
    db = new Database();
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to test database');
    }
  });

  afterAll(async () => {
    await closePool();
  });

  describe('Connection', () => {
    it('should connect to database', async () => {
      const result = await db.query<{ result: number }>('SELECT 1 as result');
      expect(result[0].result).toBe(1);
    });
  });

  describe('Teams', () => {
    it('should find all teams', async () => {
      const teams = await db.teams.findAll();
      expect(teams.length).toBeGreaterThan(0);
    });

    it('should find team by ID', async () => {
      const teams = await db.teams.findAll();
      const firstTeam = teams[0];
      const team = await db.teams.findById(firstTeam.team_id);
      expect(team).not.toBeNull();
      expect(team?.team_id).toBe(firstTeam.team_id);
    });

    it('should find team by slug', async () => {
      const team = await db.teams.findBySlug('chiefs');
      expect(team).not.toBeNull();
      expect(team?.slug).toBe('chiefs');
    });
  });

  describe('Seasons', () => {
    let testSeasonId: number;

    it('should create a season', async () => {
      const season = await db.seasons.create({
        year: 2025,
        weeks_count: 18,
        state: 'upcoming',
      });
      expect(season.season_id).toBeDefined();
      expect(season.year).toBe(2025);
      testSeasonId = season.season_id;
    });

    it('should find season by year', async () => {
      const season = await db.seasons.findByYear(2025);
      expect(season).not.toBeNull();
      expect(season?.season_id).toBe(testSeasonId);
    });

    it('should update season', async () => {
      const updated = await db.seasons.update(testSeasonId, { state: 'active' });
      expect(updated.state).toBe('active');
    });

    afterAll(async () => {
      await db.query('DELETE FROM seasons WHERE season_id = $1', [testSeasonId]);
    });
  });

  describe('Weeks', () => {
    let testSeasonId: number;
    let testWeekId: number;

    beforeAll(async () => {
      const season = await db.seasons.create({
        year: 2024,
        weeks_count: 18,
        state: 'active',
      });
      testSeasonId = season.season_id;
    });

    it('should create a week', async () => {
      const week = await db.weeks.create({
        season_id: testSeasonId,
        week_number: 1,
        state: 'open',
        open_at: new Date(),
        close_at: null,
      });
      expect(week.week_id).toBeDefined();
      expect(week.week_number).toBe(1);
      testWeekId = week.week_id;
    });

    it('should find weeks by season', async () => {
      const weeks = await db.weeks.findBySeason(testSeasonId);
      expect(weeks.length).toBeGreaterThan(0);
    });

    it('should find week by season and number', async () => {
      const week = await db.weeks.findBySeasonAndNumber(testSeasonId, 1);
      expect(week).not.toBeNull();
      expect(week?.week_id).toBe(testWeekId);
    });

    it('should update week', async () => {
      const updated = await db.weeks.update(testWeekId, { state: 'in_progress' });
      expect(updated.state).toBe('in_progress');
    });

    afterAll(async () => {
      await db.query('DELETE FROM weeks WHERE season_id = $1', [testSeasonId]);
      await db.query('DELETE FROM seasons WHERE season_id = $1', [testSeasonId]);
    });
  });

  describe('Games', () => {
    let testSeasonId: number;
    let testWeekId: number;
    let testGameId: number;
    let homeTeamId: number;
    let awayTeamId: number;

    beforeAll(async () => {
      const season = await db.seasons.create({ year: 2023, weeks_count: 18, state: 'active' });
      testSeasonId = season.season_id;

      const week = await db.weeks.create({
        season_id: testSeasonId,
        week_number: 1,
        state: 'open',
        open_at: new Date(),
        close_at: null,
      });
      testWeekId = week.week_id;

      const teams = await db.teams.findAll();
      homeTeamId = teams[0].team_id;
      awayTeamId = teams[1].team_id;
    });

    it('should create a game', async () => {
      const game = await db.games.create({
        week_id: testWeekId,
        external_id: 'espn-test-123',
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_time: new Date(),
        status: 'scheduled',
      });
      expect(game.game_id).toBeDefined();
      testGameId = game.game_id;
    });

    it('should find game by external ID', async () => {
      const game = await db.games.findByExternalId('espn-test-123');
      expect(game).not.toBeNull();
      expect(game?.game_id).toBe(testGameId);
    });

    it('should find games by week', async () => {
      const games = await db.games.findByWeek(testWeekId);
      expect(games.length).toBeGreaterThan(0);
    });

    it('should update game', async () => {
      const updated = await db.games.update(testGameId, {
        status: 'final',
        home_score: 24,
        away_score: 17,
        winner_team_id: homeTeamId,
      });
      expect(updated.status).toBe('final');
      expect(updated.home_score).toBe(24);
    });

    it('should check if all games final', async () => {
      const allFinal = await db.games.allFinalForWeek(testWeekId);
      expect(allFinal).toBe(true);
    });

    afterAll(async () => {
      await db.query('DELETE FROM games WHERE week_id = $1', [testWeekId]);
      await db.query('DELETE FROM weeks WHERE season_id = $1', [testSeasonId]);
      await db.query('DELETE FROM seasons WHERE season_id = $1', [testSeasonId]);
    });
  });

  describe('Workspaces and Players', () => {
    let testWorkspaceId: number;
    let testPlayerId: number;

    it('should create a workspace', async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T12345678',
        name: 'Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      expect(workspace.workspace_id).toBeDefined();
      testWorkspaceId = workspace.workspace_id;
    });

    it('should find workspace by platform ID', async () => {
      const workspace = await db.workspaces.findByPlatformId('slack', 'T12345678');
      expect(workspace).not.toBeNull();
      expect(workspace?.workspace_id).toBe(testWorkspaceId);
    });

    it('should update workspace', async () => {
      const updated = await db.workspaces.update(testWorkspaceId, {
        name: 'Updated Workspace',
      });
      expect(updated.name).toBe('Updated Workspace');
    });

    it('should create a player', async () => {
      const player = await db.players.create({
        workspace_id: testWorkspaceId,
        platform_user_id: 'U12345678',
        display_name: 'Test Player',
        is_admin: true,
        joined_week_id: null,
      });
      expect(player.player_id).toBeDefined();
      testPlayerId = player.player_id;
    });

    it('should find player by workspace and platform user ID', async () => {
      const player = await db.players.findByWorkspaceAndPlatformUserId(
        testWorkspaceId,
        'U12345678'
      );
      expect(player).not.toBeNull();
      expect(player?.player_id).toBe(testPlayerId);
    });

    it('should find players by workspace', async () => {
      const players = await db.players.findByWorkspace(testWorkspaceId);
      expect(players.length).toBeGreaterThan(0);
    });

    it('should update player', async () => {
      const updated = await db.players.update(testPlayerId, {
        display_name: 'Updated Player',
      });
      expect(updated.display_name).toBe('Updated Player');
    });

    afterAll(async () => {
      await db.query('DELETE FROM players WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM workspaces WHERE workspace_id = $1', [testWorkspaceId]);
    });
  });

  describe('Picks', () => {
    let testWorkspaceId: number;
    let testPlayerId: number;
    let testSeasonId: number;
    let testWeekId: number;
    let testPickId: number;
    let testTeamId: number;

    beforeAll(async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T99999999',
        name: 'Pick Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      testWorkspaceId = workspace.workspace_id;

      const player = await db.players.create({
        workspace_id: testWorkspaceId,
        platform_user_id: 'U99999999',
        display_name: 'Pick Tester',
        is_admin: false,
        joined_week_id: null,
      });
      testPlayerId = player.player_id;

      const season = await db.seasons.create({ year: 2022, weeks_count: 18, state: 'active' });
      testSeasonId = season.season_id;

      const week = await db.weeks.create({
        season_id: testSeasonId,
        week_number: 1,
        state: 'open',
        open_at: new Date(),
        close_at: null,
      });
      testWeekId = week.week_id;

      const teams = await db.teams.findAll();
      testTeamId = teams[0].team_id;
    });

    it('should create a pick', async () => {
      const pick = await db.picks.create({
        week_id: testWeekId,
        player_id: testPlayerId,
        team_id: testTeamId,
        source: 'manual',
        locked_at: null,
        outcome: null,
      });
      expect(pick.pick_id).toBeDefined();
      testPickId = pick.pick_id;
    });

    it('should find pick by week and player', async () => {
      const pick = await db.picks.findByWeekAndPlayer(testWeekId, testPlayerId);
      expect(pick).not.toBeNull();
      expect(pick?.pick_id).toBe(testPickId);
    });

    it('should find picks by player', async () => {
      const picks = await db.picks.findByPlayer(testPlayerId);
      expect(picks.length).toBeGreaterThan(0);
    });

    it('should find picks by season', async () => {
      const picks = await db.picks.findBySeason(testSeasonId, testPlayerId);
      expect(picks.length).toBeGreaterThan(0);
    });

    it('should update pick', async () => {
      const updated = await db.picks.update(testPickId, {
        locked_at: new Date(),
        outcome: 'win',
      });
      expect(updated.outcome).toBe('win');
      expect(updated.locked_at).not.toBeNull();
    });

    it('should delete pick', async () => {
      await db.picks.delete(testPickId);
      const pick = await db.picks.findById(testPickId);
      expect(pick).toBeNull();
    });

    afterAll(async () => {
      await db.query('DELETE FROM picks WHERE player_id = $1', [testPlayerId]);
      await db.query('DELETE FROM players WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM workspaces WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM weeks WHERE season_id = $1', [testSeasonId]);
      await db.query('DELETE FROM seasons WHERE season_id = $1', [testSeasonId]);
    });
  });

  describe('Standings', () => {
    let testWorkspaceId: number;
    let testPlayerId: number;
    let testSeasonId: number;
    let testStandingId: number;

    beforeAll(async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T88888888',
        name: 'Standings Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      testWorkspaceId = workspace.workspace_id;

      const player = await db.players.create({
        workspace_id: testWorkspaceId,
        platform_user_id: 'U88888888',
        display_name: 'Standings Tester',
        is_admin: false,
        joined_week_id: null,
      });
      testPlayerId = player.player_id;

      const season = await db.seasons.create({ year: 2021, weeks_count: 18, state: 'active' });
      testSeasonId = season.season_id;
    });

    it('should create standings', async () => {
      const standing = await db.standings.create({
        season_id: testSeasonId,
        player_id: testPlayerId,
        wins: 5,
        losses: 3,
      });
      expect(standing.standing_id).toBeDefined();
      testStandingId = standing.standing_id;
    });

    it('should find standings by season and player', async () => {
      const standing = await db.standings.findBySeasonAndPlayer(testSeasonId, testPlayerId);
      expect(standing).not.toBeNull();
      expect(standing?.wins).toBe(5);
    });

    it('should find standings by season', async () => {
      const standings = await db.standings.findBySeason(testSeasonId);
      expect(standings.length).toBeGreaterThan(0);
    });

    it('should update standings', async () => {
      const updated = await db.standings.update(testStandingId, {
        wins: 6,
        losses: 3,
      });
      expect(updated.wins).toBe(6);
    });

    afterAll(async () => {
      await db.query('DELETE FROM standings WHERE season_id = $1', [testSeasonId]);
      await db.query('DELETE FROM players WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM workspaces WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM seasons WHERE season_id = $1', [testSeasonId]);
    });
  });

  describe('Audit Log', () => {
    let testWorkspaceId: number;
    let testPlayerId: number;

    beforeAll(async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T77777777',
        name: 'Audit Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      testWorkspaceId = workspace.workspace_id;

      const player = await db.players.create({
        workspace_id: testWorkspaceId,
        platform_user_id: 'U77777777',
        display_name: 'Audit Tester',
        is_admin: false,
        joined_week_id: null,
      });
      testPlayerId = player.player_id;
    });

    it('should create audit log entry', async () => {
      const log = await db.auditLog.create({
        workspace_id: testWorkspaceId,
        actor_type: 'player',
        actor_id: testPlayerId,
        action: 'pick_created',
        entity_type: 'pick',
        entity_id: 123,
        payload: { team: 'chiefs', week: 1 },
      });
      expect(log.log_id).toBeDefined();
    });

    it('should find audit logs by workspace', async () => {
      const logs = await db.auditLog.findByWorkspace(testWorkspaceId);
      expect(logs.length).toBeGreaterThan(0);
    });

    afterAll(async () => {
      await db.query('DELETE FROM audit_log WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM players WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM workspaces WHERE workspace_id = $1', [testWorkspaceId]);
    });
  });

  describe('Transactions', () => {
    let testWorkspaceId: number;
    let testPlayerId: number;
    let testSeasonId: number;

    beforeAll(async () => {
      const workspace = await db.workspaces.create({
        platform: 'slack',
        platform_workspace_id: 'T66666666',
        name: 'Transaction Test Workspace',
        reminder_friday_enabled: true,
        reminder_sunday_enabled: true,
      });
      testWorkspaceId = workspace.workspace_id;

      const player = await db.players.create({
        workspace_id: testWorkspaceId,
        platform_user_id: 'U66666666',
        display_name: 'Transaction Tester',
        is_admin: false,
        joined_week_id: null,
      });
      testPlayerId = player.player_id;

      const season = await db.seasons.create({ year: 2020, weeks_count: 18, state: 'active' });
      testSeasonId = season.season_id;
    });

    it('should commit transaction on success', async () => {
      const result = await db.transaction(async (client) => {
        const standingResult = await client.query(
          `INSERT INTO standings (season_id, player_id, wins, losses)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [testSeasonId, testPlayerId, 10, 5]
        );
        return standingResult.rows[0];
      });

      expect(result.wins).toBe(10);

      const standing = await db.standings.findBySeasonAndPlayer(testSeasonId, testPlayerId);
      expect(standing).not.toBeNull();
      expect(standing?.wins).toBe(10);
    });

    it('should rollback transaction on error', async () => {
      try {
        await db.transaction(async (client) => {
          await client.query(
            `UPDATE standings SET wins = $1 WHERE season_id = $2 AND player_id = $3`,
            [999, testSeasonId, testPlayerId]
          );
          throw new Error('Intentional error');
        });
      } catch (error) {
        // Expected error
      }

      const standing = await db.standings.findBySeasonAndPlayer(testSeasonId, testPlayerId);
      expect(standing?.wins).toBe(10); // Should still be 10, not 999
    });

    afterAll(async () => {
      await db.query('DELETE FROM standings WHERE season_id = $1', [testSeasonId]);
      await db.query('DELETE FROM players WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM workspaces WHERE workspace_id = $1', [testWorkspaceId]);
      await db.query('DELETE FROM seasons WHERE season_id = $1', [testSeasonId]);
    });
  });
});
