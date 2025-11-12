// Type definitions for the NFL Loser Pick'em Bot

export interface Team {
  team_id: number;
  slug: string;
  name: string;
  conference: 'AFC' | 'NFC';
  division: 'North' | 'South' | 'East' | 'West';
}

export interface Season {
  season_id: number;
  year: number;
  weeks_count: number;
  state: 'upcoming' | 'active' | 'completed';
}

export interface Week {
  week_id: number;
  season_id: number;
  week_number: number;
  state: 'scheduled' | 'open' | 'in_progress' | 'finalized';
  open_at: Date | null;
  close_at: Date | null;
}

export interface Game {
  game_id: number;
  week_id: number;
  home_team_id: number;
  away_team_id: number;
  kickoff_time: Date;
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';
  home_score: number | null;
  away_score: number | null;
  winner_team_id: number | null;
  external_id: string | null;
  updated_at: Date;
}

export interface Workspace {
  workspace_id: number;
  platform: 'slack' | 'discord';
  platform_workspace_id: string;
  name: string;
  announcement_channel_id: string | null;
  timezone: string;
  reminder_enabled: boolean;
  reminder_friday_enabled: boolean;
  reminder_sunday_enabled: boolean;
  created_at: Date;
}

export interface Player {
  player_id: number;
  workspace_id: number;
  platform_user_id: string;
  display_name: string;
  is_admin: boolean;
  joined_week_id: number | null;
  created_at: Date;
}

export interface Pick {
  pick_id: number;
  week_id: number;
  player_id: number;
  team_id: number;
  source: 'manual' | 'auto_assigned';
  locked_at: Date | null;
  outcome: 'win' | 'loss' | null;
  created_at: Date;
  updated_at: Date;
}

export interface Standing {
  standing_id: number;
  season_id: number;
  player_id: number;
  wins: number;
  losses: number;
}

export interface AuditLog {
  log_id: number;
  workspace_id: number;
  actor_type: 'player' | 'admin' | 'system';
  actor_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  payload: Record<string, any> | null;
  created_at: Date;
}

// Extended types with joined data
export interface PickWithDetails extends Pick {
  team?: Team;
  player?: Player;
  week?: Week;
}

export interface StandingWithPlayer extends Standing {
  player: Player;
}

export interface GameWithTeams extends Game {
  home_team: Team;
  away_team: Team;
  winner_team?: Team | null;
}

// Command types
export interface CommandContext {
  workspace_id: number;
  player_id: number;
  platform: 'slack' | 'discord';
  channel_id: string;
  is_admin: boolean;
}

export interface CommandResponse {
  type: 'ephemeral' | 'public' | 'dm';
  content: string | EmbedMessage | BlockMessage;
}

// Platform-agnostic message types
export interface EmbedMessage {
  title: string;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: string;
  color?: string;
  thumbnail?: string;
  image?: string;
}

export interface BlockMessage {
  blocks: Array<any>; // Platform-specific block types
  text?: string; // Fallback text
}

// Validation result types
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// External API types
export interface ESPNGame {
  id: string;
  date: string;
  name: string;
  week: number;
  status: {
    type: {
      name: string;
    };
  };
  competitions: Array<{
    competitors: Array<{
      homeAway: 'home' | 'away';
      team: {
        id: string;
        abbreviation: string;
        displayName: string;
      };
      score?: string;
    }>;
  }>;
}

export interface ESPNScoreboardResponse {
  week: {
    number: number;
  };
  events: ESPNGame[];
}
