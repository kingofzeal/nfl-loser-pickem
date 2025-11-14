/**
 * TheSportsDB Data Provider
 * 
 * Fetches NFL game data from TheSportsDB API
 * Note: Requires API key for production usage
 */

import { IDataProvider, GameData } from '../interfaces/IDataProvider';
import { logger } from '../../utils/logger';

interface TheSportsDBEvent {
  idEvent: string;
  strEvent: string;
  dateEvent: string; // YYYY-MM-DD
  strTime: string;   // HH:mm:ss (UTC)
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore?: string;
  intAwayScore?: string;
  strStatus?: string; // e.g., FT, NS, LIVE
}

export class TheSportsDBProvider implements IDataProvider {
  readonly name = 'TheSportsDB';
  private readonly API_BASE = 'https://www.thesportsdb.com/api/v1/json';
  private readonly NFL_LEAGUE_ID = '4391';

  constructor(private apiKey: string | undefined) {}

  async fetchGamesForWeek(weekNumber: number, seasonYear: number): Promise<GameData[]> {
    // TheSportsDB doesn't have direct NFL week endpoints for free tier.
    // Strategy: fetch season events and filter by approximate week ranges or dates.
    const url = `${this.API_BASE}/${this.apiKey || '1'}/eventsseason.php?id=${this.NFL_LEAGUE_ID}&s=${seasonYear}`;
    logger.debug('Fetching from TheSportsDB', { url, weekNumber, seasonYear });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TheSportsDB API request failed: ${response.status} ${response.statusText}`);
    }

  const data: any = await response.json();
  const events: TheSportsDBEvent[] = Array.isArray(data?.events) ? data.events : [];

    const games: GameData[] = [];

    for (const event of events) {
      try {
        const game = this.parseEvent(event);
        if (game) {
          // Optional: filter by date ranges approximating weeks
          games.push(game);
        }
      } catch (error) {
        logger.warn('Failed to parse TheSportsDB event', { error, idEvent: event?.idEvent });
      }
    }

    logger.info('TheSportsDB games fetched', { weekNumber, count: games.length });
    return games;
  }

  mapTeamToSlug(name: string): string | null {
    // Basic normalization; expand with aliases as needed
    const normalized = name.toLowerCase();
    const map: Record<string, string> = {
      'arizona cardinals': 'cardinals',
      'atlanta falcons': 'falcons',
      'baltimore ravens': 'ravens',
      'buffalo bills': 'bills',
      'carolina panthers': 'panthers',
      'chicago bears': 'bears',
      'cincinnati bengals': 'bengals',
      'cleveland browns': 'browns',
      'dallas cowboys': 'cowboys',
      'denver broncos': 'broncos',
      'detroit lions': 'lions',
      'green bay packers': 'packers',
      'houston texans': 'texans',
      'indianapolis colts': 'colts',
      'jacksonville jaguars': 'jaguars',
      'kansas city chiefs': 'chiefs',
      'las vegas raiders': 'raiders',
      'los angeles chargers': 'chargers',
      'los angeles rams': 'rams',
      'miami dolphins': 'dolphins',
      'minnesota vikings': 'vikings',
      'new england patriots': 'patriots',
      'new orleans saints': 'saints',
      'new york giants': 'giants',
      'new york jets': 'jets',
      'philadelphia eagles': 'eagles',
      'pittsburgh steelers': 'steelers',
      'san francisco 49ers': '49ers',
      'seattle seahawks': 'seahawks',
      'tampa bay buccaneers': 'buccaneers',
      'tennessee titans': 'titans',
      'washington commanders': 'commanders',
    };
    return map[normalized] || null;
  }

  private parseEvent(event: TheSportsDBEvent): GameData | null {
    if (!event?.idEvent || !event?.dateEvent || !event?.strHomeTeam || !event?.strAwayTeam) {
      return null;
    }

    const homeSlug = this.mapTeamToSlug(event.strHomeTeam);
    const awaySlug = this.mapTeamToSlug(event.strAwayTeam);
    if (!homeSlug || !awaySlug) return null;

    // Combine date and time (assume UTC)
    const iso = `${event.dateEvent}T${event.strTime || '00:00:00'}Z`;
    const kickoffTime = new Date(iso);
    if (isNaN(kickoffTime.getTime())) return null;

    const status = this.mapStatus(event.strStatus);

    const homeScore = event.intHomeScore ? parseInt(event.intHomeScore, 10) : null;
    const awayScore = event.intAwayScore ? parseInt(event.intAwayScore, 10) : null;

    return {
      externalId: event.idEvent,
      homeTeamSlug: homeSlug,
      awayTeamSlug: awaySlug,
      kickoffTime,
      status,
      homeScore: Number.isFinite(homeScore!) ? homeScore : null,
      awayScore: Number.isFinite(awayScore!) ? awayScore : null,
    };
  }

  private mapStatus(status?: string): 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled' {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'NS': // Not Started
        return 'scheduled';
      case 'LIVE':
        return 'in_progress';
      case 'FT': // Full Time
        return 'final';
      case 'POSTPONED':
        return 'postponed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'in_progress';
    }
  }
}
