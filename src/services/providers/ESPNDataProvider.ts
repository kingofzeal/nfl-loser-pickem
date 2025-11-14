/**
 * ESPN Data Provider
 * 
 * Fetches NFL game data from ESPN's public API
 */

import { IDataProvider, GameData } from '../interfaces/IDataProvider';
import { ESPN_TEAM_MAP } from '../../utils/team-mappings';
import { ESPNScoreboardResponse } from '../../types';
import { logger } from '../../utils/logger';

export class ESPNDataProvider implements IDataProvider {
  readonly name = 'ESPN';
  private readonly API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

  async fetchGamesForWeek(weekNumber: number, seasonYear: number): Promise<GameData[]> {
    const url = `${this.API_BASE}?week=${weekNumber}&seasontype=2&limit=100`;
    
    logger.debug('Fetching from ESPN', { url, weekNumber, seasonYear });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`);
    }

    const data: ESPNScoreboardResponse = await response.json();

    if (!data.events || !Array.isArray(data.events)) {
      throw new Error('Invalid ESPN API response: missing or invalid events array');
    }

    const games: GameData[] = [];

    for (const event of data.events) {
      try {
        const game = this.parseESPNGame(event);
        if (game) {
          games.push(game);
        }
      } catch (error) {
        logger.warn('Failed to parse ESPN game', { error, gameId: event?.id });
        // Continue processing other games
      }
    }

    logger.info('ESPN games fetched', { weekNumber, count: games.length });
    return games;
  }

  mapTeamToSlug(teamId: string): string | null {
    return ESPN_TEAM_MAP[teamId] || null;
  }

  private parseESPNGame(espnGame: any): GameData | null {
    // Validate basic structure
    if (!espnGame?.id || !espnGame?.competitions?.[0]) {
      return null;
    }

    const competition = espnGame.competitions[0];
    const competitors = competition.competitors;

    if (!Array.isArray(competitors) || competitors.length !== 2) {
      return null;
    }

    // Get home and away teams
    const homeCompetitor = competitors.find((c: any) => c.homeAway === 'home');
    const awayCompetitor = competitors.find((c: any) => c.homeAway === 'away');

    if (!homeCompetitor?.team?.id || !awayCompetitor?.team?.id) {
      return null;
    }

    // Map teams
    const homeTeamSlug = this.mapTeamToSlug(homeCompetitor.team.id);
    const awayTeamSlug = this.mapTeamToSlug(awayCompetitor.team.id);

    if (!homeTeamSlug || !awayTeamSlug) {
      logger.warn('Unknown ESPN team IDs', {
        gameId: espnGame.id,
        homeTeamId: homeCompetitor.team.id,
        awayTeamId: awayCompetitor.team.id,
      });
      return null;
    }

    // Parse status
    const status = this.mapESPNStatus(espnGame.status?.type?.name);

    // Parse date
    const kickoffTime = new Date(espnGame.date);
    if (isNaN(kickoffTime.getTime())) {
      logger.warn('Invalid date in ESPN game', { gameId: espnGame.id, date: espnGame.date });
      return null;
    }

    // Parse scores
    let homeScore: number | null = null;
    let awayScore: number | null = null;

    if (homeCompetitor.score) {
      const parsed = parseInt(homeCompetitor.score, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        homeScore = parsed;
      }
    }

    if (awayCompetitor.score) {
      const parsed = parseInt(awayCompetitor.score, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        awayScore = parsed;
      }
    }

    return {
      externalId: espnGame.id,
      homeTeamSlug,
      awayTeamSlug,
      kickoffTime,
      status,
      homeScore,
      awayScore,
    };
  }

  private mapESPNStatus(espnStatus: string): 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled' {
    const normalized = espnStatus?.toLowerCase() || '';
    
    if (normalized.includes('scheduled') || normalized.includes('pre')) {
      return 'scheduled';
    }
    if (normalized.includes('in progress') || normalized.includes('halftime')) {
      return 'in_progress';
    }
    if (normalized.includes('final')) {
      return 'final';
    }
    if (normalized.includes('postponed') || normalized.includes('delayed')) {
      return 'postponed';
    }
    if (normalized.includes('cancelled')) {
      return 'cancelled';
    }

    logger.warn('Unknown ESPN status, defaulting to in_progress', { espnStatus });
    return 'in_progress';
  }
}
