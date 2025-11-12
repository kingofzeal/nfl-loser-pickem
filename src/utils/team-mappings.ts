/**
 * Mapping of ESPN team IDs to internal team slugs
 */
export const ESPN_TEAM_MAP: Record<string, string> = {
  '1': 'falcons',       // Atlanta Falcons
  '2': 'bills',         // Buffalo Bills
  '3': 'bears',         // Chicago Bears
  '4': 'bengals',       // Cincinnati Bengals
  '5': 'browns',        // Cleveland Browns
  '6': 'cowboys',       // Dallas Cowboys
  '7': 'broncos',       // Denver Broncos
  '8': 'lions',         // Detroit Lions
  '9': 'packers',       // Green Bay Packers
  '10': 'titans',       // Tennessee Titans
  '11': 'colts',        // Indianapolis Colts
  '12': 'chiefs',       // Kansas City Chiefs
  '13': 'raiders',      // Las Vegas Raiders
  '14': 'rams',         // Los Angeles Rams
  '15': 'dolphins',     // Miami Dolphins
  '16': 'vikings',      // Minnesota Vikings
  '17': 'patriots',     // New England Patriots
  '18': 'saints',       // New Orleans Saints
  '19': 'giants',       // New York Giants
  '20': 'jets',         // New York Jets
  '21': 'eagles',       // Philadelphia Eagles
  '22': 'cardinals',    // Arizona Cardinals
  '23': 'steelers',     // Pittsburgh Steelers
  '24': 'chargers',     // Los Angeles Chargers
  '25': '49ers',        // San Francisco 49ers
  '26': 'seahawks',     // Seattle Seahawks
  '27': 'buccaneers',   // Tampa Bay Buccaneers
  '28': 'commanders',   // Washington Commanders
  '29': 'panthers',     // Carolina Panthers
  '30': 'jaguars',      // Jacksonville Jaguars
  '33': 'ravens',       // Baltimore Ravens
  '34': 'texans',       // Houston Texans
};

/**
 * Map ESPN team abbreviation to slug
 */
export const ESPN_ABBR_MAP: Record<string, string> = {
  'ARI': 'cardinals',
  'ATL': 'falcons',
  'BAL': 'ravens',
  'BUF': 'bills',
  'CAR': 'panthers',
  'CHI': 'bears',
  'CIN': 'bengals',
  'CLE': 'browns',
  'DAL': 'cowboys',
  'DEN': 'broncos',
  'DET': 'lions',
  'GB': 'packers',
  'HOU': 'texans',
  'IND': 'colts',
  'JAX': 'jaguars',
  'KC': 'chiefs',
  'LV': 'raiders',
  'LAC': 'chargers',
  'LAR': 'rams',
  'MIA': 'dolphins',
  'MIN': 'vikings',
  'NE': 'patriots',
  'NO': 'saints',
  'NYG': 'giants',
  'NYJ': 'jets',
  'PHI': 'eagles',
  'PIT': 'steelers',
  'SF': '49ers',
  'SEA': 'seahawks',
  'TB': 'buccaneers',
  'TEN': 'titans',
  'WSH': 'commanders',
};

/**
 * Common alternative names for teams (for user input parsing)
 */
export const TEAM_ALIASES: Record<string, string> = {
  // Full names
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
  
  // City only
  'arizona': 'cardinals',
  'atlanta': 'falcons',
  'baltimore': 'ravens',
  'buffalo': 'bills',
  'carolina': 'panthers',
  'chicago': 'bears',
  'cincinnati': 'bengals',
  'cleveland': 'browns',
  'dallas': 'cowboys',
  'denver': 'broncos',
  'detroit': 'lions',
  'green bay': 'packers',
  'houston': 'texans',
  'indianapolis': 'colts',
  'jacksonville': 'jaguars',
  'kansas city': 'chiefs',
  'las vegas': 'raiders',
  'la chargers': 'chargers',
  'la rams': 'rams',
  'miami': 'dolphins',
  'minnesota': 'vikings',
  'new england': 'patriots',
  'new orleans': 'saints',
  'ny giants': 'giants',
  'ny jets': 'jets',
  'philadelphia': 'eagles',
  'pittsburgh': 'steelers',
  'san francisco': '49ers',
  'seattle': 'seahawks',
  'tampa bay': 'buccaneers',
  'tampa': 'buccaneers',
  'tennessee': 'titans',
  'washington': 'commanders',
  
  // Abbreviations (lowercase)
  'ari': 'cardinals',
  'atl': 'falcons',
  'bal': 'ravens',
  'buf': 'bills',
  'car': 'panthers',
  'chi': 'bears',
  'cin': 'bengals',
  'cle': 'browns',
  'dal': 'cowboys',
  'den': 'broncos',
  'det': 'lions',
  'gb': 'packers',
  'hou': 'texans',
  'ind': 'colts',
  'jax': 'jaguars',
  'kc': 'chiefs',
  'lv': 'raiders',
  'lac': 'chargers',
  'lar': 'rams',
  'mia': 'dolphins',
  'min': 'vikings',
  'ne': 'patriots',
  'no': 'saints',
  'nyg': 'giants',
  'nyj': 'jets',
  'phi': 'eagles',
  'pit': 'steelers',
  'sf': '49ers',
  'sea': 'seahawks',
  'tb': 'buccaneers',
  'ten': 'titans',
  'wsh': 'commanders',
};
