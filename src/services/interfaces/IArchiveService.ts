export interface IArchiveService {
  /**
   * Export season data to JSON/CSV format
   */
  exportSeason(seasonId: number, workspaceId: number, format: 'json' | 'csv'): Promise<string>;

  /**
   * Purge season data after export
   * Archives picks, standings, and audit logs for a specific workspace
   */
  purgeSeason(seasonId: number, workspaceId: number): Promise<void>;

  /**
   * Get list of archived seasons
   */
  listArchivedSeasons(workspaceId: number): Promise<Array<{
    season_id: number;
    year: number;
    archived_at: Date;
    export_path: string;
  }>>;

  /**
   * Restore season from archive
   */
  restoreSeason(seasonId: number, workspaceId: number, archivePath: string): Promise<void>;
}
