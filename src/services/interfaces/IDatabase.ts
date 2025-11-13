import { 
  Team, Season, Week, Game, Workspace, Player, Pick, Standing, AuditLog 
} from '../../types';

/**
 * Generic transaction client interface
 * Can be PostgreSQL PoolClient or D1 batch collector
 */
export interface ITransactionClient {
  query<T = any>(text: string, params?: any[]): Promise<T[]>;
}

export interface IDatabase {
  query<T = any>(text: string, params?: any[]): Promise<T[]>;
  transaction<T>(callback: (client: ITransactionClient) => Promise<T>): Promise<T>;
  
  // Team operations
  teams: {
    findAll(): Promise<Team[]>;
    findById(id: number): Promise<Team | null>;
    findBySlug(slug: string): Promise<Team | null>;
  };
  
  // Season operations
  seasons: {
    findByYear(year: number): Promise<Season | null>;
    create(data: Partial<Season>): Promise<Season>;
    update(id: number, data: Partial<Season>): Promise<Season>;
  };
  
  // Week operations
  weeks: {
    findById(id: number): Promise<Week | null>;
    findBySeason(seasonId: number): Promise<Week[]>;
    findBySeasonAndNumber(seasonId: number, weekNumber: number): Promise<Week | null>;
    create(data: Partial<Week>): Promise<Week>;
    update(id: number, data: Partial<Week>): Promise<Week>;
  };
  
  // Game operations
  games: {
    findById(id: number): Promise<Game | null>;
    findByWeek(weekId: number): Promise<Game[]>;
    findByExternalId(externalId: string): Promise<Game | null>;
    create(data: Partial<Game>): Promise<Game>;
    update(id: number, data: Partial<Game>): Promise<Game>;
    allFinalForWeek(weekId: number): Promise<boolean>;
  };
  
  // Workspace operations
  workspaces: {
    findById(id: number): Promise<Workspace | null>;
    findByPlatformId(platform: string, platformWorkspaceId: string): Promise<Workspace | null>;
    create(data: Partial<Workspace>): Promise<Workspace>;
    update(id: number, data: Partial<Workspace>): Promise<Workspace>;
  };
  
  // Player operations
  players: {
    findById(id: number): Promise<Player | null>;
    findByWorkspaceAndPlatformUserId(workspaceId: number, platformUserId: string): Promise<Player | null>;
    findByWorkspace(workspaceId: number): Promise<Player[]>;
    create(data: Partial<Player>): Promise<Player>;
    update(id: number, data: Partial<Player>): Promise<Player>;
  };
  
  // Pick operations
  picks: {
    findById(id: number): Promise<Pick | null>;
    findByWeekAndPlayer(weekId: number, playerId: number): Promise<Pick | null>;
    findByPlayer(playerId: number): Promise<Pick[]>;
    findByWeek(weekId: number): Promise<Pick[]>;
    findBySeason(seasonId: number, playerId: number): Promise<Pick[]>;
    create(data: Partial<Pick>): Promise<Pick>;
    update(id: number, data: Partial<Pick>): Promise<Pick>;
    delete(id: number): Promise<void>;
  };
  
  // Standing operations
  standings: {
    findBySeasonAndPlayer(seasonId: number, playerId: number): Promise<Standing | null>;
    findBySeason(seasonId: number): Promise<Standing[]>;
    create(data: Partial<Standing>): Promise<Standing>;
    update(id: number, data: Partial<Standing>): Promise<Standing>;
  };
  
  // Audit log operations
  auditLog: {
    create(data: Partial<AuditLog>): Promise<AuditLog>;
    findByWorkspace(workspaceId: number, limit?: number): Promise<AuditLog[]>;
  };
}
