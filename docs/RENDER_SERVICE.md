# RenderService Documentation

## Overview

The `RenderService` implementation uses [Satori](https://github.com/vercel/satori) by Vercel to generate weekly summary images. Satori converts HTML/JSX-like structures into SVG, which can then be converted to PNG using `@resvg/resvg-js`.

## Why Satori?

### ✅ Cloudflare Workers Compatible
- **No native dependencies**: Unlike `node-canvas` or `puppeteer`, Satori is pure JavaScript
- **WebAssembly based**: The `@resvg/resvg-js` converter uses WASM for PNG generation
- **Zero cold start penalty**: No native modules to load

### ✅ Performance Benefits
- **Lightweight**: Much smaller bundle size than headless browsers
- **Fast**: Direct HTML → SVG → PNG conversion without browser overhead
- **Memory efficient**: No need to spawn browser processes

### ✅ Developer Experience
- **JSX-like syntax**: Familiar React-style component structure
- **Flexbox support**: Modern CSS layout with `display: flex`
- **Easy styling**: Inline styles with full CSS support
- **Type safe**: Full TypeScript support

## Alternative Considered: canvas-table

**Status**: ❌ Not Feasible for Cloudflare Workers

`canvas-table` depends on `node-canvas`, which requires native Cairo bindings. This makes it:
- ❌ Not compatible with Cloudflare Workers
- ❌ Requires native compilation on Windows (problematic)
- ❌ Heavy runtime dependencies
- ❌ Larger bundle size

## Installation

Already installed in this project:

```bash
npm install satori @resvg/resvg-js
```

## Usage

### Basic Setup

```typescript
import { RenderService } from './services/RenderService';

const renderService = new RenderService();

// Optional: Initialize with custom font
// For Cloudflare Workers, load font from R2 or bundle as asset
const fontResponse = await fetch('https://your-r2-bucket.com/fonts/Inter-Regular.ttf');
const fontData = await fontResponse.arrayBuffer();
await renderService.initialize(fontData);
```

### Generating Weekly Summary Image

```typescript
// Get standings and picks data
const standings = await standingsService.getStandings(seasonId);
const allPicks = await pickService.getPicksForWeek(weekId);

// Generate PNG image
const imageBuffer = await renderService.generateWeeklySummaryImage(
  2025,           // Season year
  8,              // Week number
  standings,      // StandingWithPlayer[]
  allPicks        // Record<number, PickWithDetails[]>
);

// Upload to R2 or return as response
// Example: Upload to R2
await env.R2_BUCKET.put(
  `summaries/2025-week-8.png`,
  imageBuffer,
  {
    httpMetadata: {
      contentType: 'image/png',
    },
  }
);

// Or return directly in HTTP response
return new Response(imageBuffer, {
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=3600',
  },
});
```

### Using Other Methods (Embed Messages)

```typescript
// Pick confirmation
const confirmMessage = renderService.generatePickConfirmation(
  pick,
  'Dallas Cowboys',
  8
);

// Player summary
const summary = renderService.generateMySummary(
  playerId,
  seasonId,
  picks,
  standing
);

// Leaderboard
const board = renderService.generateBoard(
  standings,
  2025,
  8 // optional week number
);

// Help message
const help = renderService.generateHelp();

// Week open announcement
const announcement = renderService.generateWeekOpenAnnouncement(week, 2025);

// Error message
const error = renderService.generateError('Something went wrong!');
```

## Cloudflare Workers Integration

### 1. Loading Fonts

For production use with Cloudflare Workers, you need to provide a font. Options:

#### Option A: Bundle Font as Asset (Recommended)

```typescript
// In your wrangler.toml
[rules]
globs = ["**/*.ttf", "**/*.otf"]
type = "CompiledWasm"

// In your worker
import InterFont from './assets/Inter-Regular.ttf';

const renderService = new RenderService();
await renderService.initialize(InterFont);
```

#### Option B: Load from R2

```typescript
const fontData = await env.R2_FONTS.get('Inter-Regular.ttf');
if (fontData) {
  const buffer = await fontData.arrayBuffer();
  await renderService.initialize(buffer);
}
```

#### Option C: Use CDN (Slower)

```typescript
const response = await fetch('https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff');
const fontData = await response.arrayBuffer();
await renderService.initialize(fontData);
```

### 2. Storing Generated Images

Recommended approach: Store in R2 and return public URL

```typescript
// Generate image
const imageBuffer = await renderService.generateWeeklySummaryImage(
  seasonYear,
  weekNumber,
  standings,
  allPicks
);

// Store in R2
const key = `summaries/${seasonYear}-week-${weekNumber}.png`;
await env.R2_BUCKET.put(key, imageBuffer, {
  httpMetadata: {
    contentType: 'image/png',
  },
});

// Return public URL
const publicUrl = `https://your-r2-public-domain.com/${key}`;
return publicUrl;
```

### 3. Example Worker Endpoint

```typescript
import { RenderService } from './services/RenderService';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/summary/image') {
      const weekNumber = parseInt(url.searchParams.get('week') || '1');
      const seasonYear = parseInt(url.searchParams.get('year') || '2025');
      
      // Get data
      const standings = await getStandings(env.DB, seasonYear);
      const allPicks = await getAllPicks(env.DB, seasonYear, weekNumber);
      
      // Generate image
      const renderService = new RenderService();
      const imageBuffer = await renderService.generateWeeklySummaryImage(
        seasonYear,
        weekNumber,
        standings,
        allPicks
      );
      
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    return new Response('Not found', { status: 404 });
  },
};
```

## Output Example

The generated image will show:

```
🏈 Week 8 - 2025
NFL Loser Pick'em Summary
─────────────────────────────────────────────────────────
Rank | Player       | Pick              | Result    | Record
─────────────────────────────────────────────────────────
🥇   | John Doe     | Dallas Cowboys    | ✅ Win    | 6-2
🥈   | Jane Smith   | Giants            | ❌ Loss   | 5-3
🥉   | Bob Wilson   | Patriots          | ⏳ Pending| 5-3
4.   | Alice Brown  | Commanders        | ✅ Win    | 4-4
```

### Styling

The image uses:
- **Dark theme**: Background `#1a1a1a`, text `#ffffff`
- **Color coding**:
  - Green (`#00ff00`): Wins
  - Red (`#ff0000`): Losses
  - Gray (`#888888`): Pending
- **Dynamic height**: Automatically adjusts based on player count
- **Fixed width**: 1200px for consistency

## Customization

### Changing the Layout

Edit the `buildWeeklySummaryJSX` method in `RenderService.ts`:

```typescript
private buildWeeklySummaryJSX(...) {
  return {
    type: 'div',
    props: {
      style: {
        // Your custom styles here
        backgroundColor: '#ffffff', // Light theme
        color: '#000000',
        // ... more styles
      },
      children: [
        // Your custom layout here
      ],
    },
  };
}
```

### Adding Team Logos

You can include images in the JSX:

```typescript
{
  type: 'img',
  props: {
    src: 'https://your-cdn.com/logos/cowboys.png',
    style: {
      width: 32,
      height: 32,
    },
  },
}
```

**Note**: Images must be accessible via URL. For Workers, pre-load and convert to data URLs or use R2 public URLs.

## Performance Considerations

### Benchmarks (approximate)

- **Image generation time**: 100-300ms (depending on player count)
- **Memory usage**: ~5-10MB per image
- **Bundle size impact**: +2MB for Satori + resvg WASM

### Optimization Tips

1. **Cache generated images**: Store in R2 and serve from cache
2. **Use Workers KV for metadata**: Cache which images have been generated
3. **Lazy load fonts**: Only load font when needed
4. **Set appropriate cache headers**: Reduce regeneration frequency

```typescript
// Example caching strategy
const cacheKey = `summary-${seasonYear}-week-${weekNumber}`;
const cached = await env.KV.get(cacheKey, { type: 'arrayBuffer' });

if (cached) {
  return new Response(cached, {
    headers: { 'Content-Type': 'image/png', 'X-Cache': 'HIT' },
  });
}

// Generate and cache
const imageBuffer = await renderService.generateWeeklySummaryImage(...);
await env.KV.put(cacheKey, imageBuffer, { expirationTtl: 3600 });

return new Response(imageBuffer, {
  headers: { 'Content-Type': 'image/png', 'X-Cache': 'MISS' },
});
```

## Testing

### Unit Test Example

```typescript
import { RenderService } from '../services/RenderService';

describe('RenderService', () => {
  let renderService: RenderService;

  beforeEach(() => {
    renderService = new RenderService();
  });

  it('should generate weekly summary image', async () => {
    const standings = [
      {
        standing_id: 1,
        season_id: 1,
        player_id: 1,
        wins: 6,
        losses: 2,
        player: {
          player_id: 1,
          display_name: 'Test Player',
          // ... other fields
        },
      },
    ];

    const allPicks = {
      1: [
        {
          pick_id: 1,
          team_id: 1,
          outcome: 'win',
          team: { name: 'Cowboys', /* ... */ },
          week: { week_number: 8, /* ... */ },
          // ... other fields
        },
      ],
    };

    const buffer = await renderService.generateWeeklySummaryImage(
      2025,
      8,
      standings,
      allPicks
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
```

## Troubleshooting

### Issue: Font rendering problems

**Solution**: Make sure you're providing a valid TrueType or OpenType font. Test locally first:

```typescript
import fs from 'fs';
const fontData = fs.readFileSync('./fonts/Inter-Regular.ttf');
await renderService.initialize(fontData);
```

### Issue: Images are blank or corrupted

**Solution**: Check that all text strings are valid UTF-8. Some emojis may not render without proper font support.

### Issue: Workers deployment fails

**Solution**: Check that WASM is enabled in your wrangler.toml:

```toml
compatibility_flags = ["nodejs_compat"]
```

### Issue: Out of memory in Workers

**Solution**: Reduce image dimensions or optimize the JSX structure. Consider generating images asynchronously and storing in R2.

## References

- [Satori Documentation](https://github.com/vercel/satori)
- [Resvg Documentation](https://github.com/yisibl/resvg-js)
- [Cloudflare Workers WASM](https://developers.cloudflare.com/workers/runtime-apis/webassembly/)
- [Cloudflare R2 Storage](https://developers.cloudflare.com/r2/)

## Migration from Placeholder RenderService

The previous `RenderService.ts` had only placeholder implementations. The new production version uses Satori for actual image generation.

1. **No import changes needed** - still `RenderService`
   
2. **Add initialization**:
   ```typescript
   // New requirement
   await renderService.initialize(fontData);
   ```

3. **Update image handling**:
   ```typescript
   // Old (placeholder returned string)
   const summary: string = await renderService.generateWeeklySummaryImage(...);
   
   // New (returns Buffer)
   const summary: Buffer = await renderService.generateWeeklySummaryImage(...);
   ```

All other methods remain compatible with the `IRenderService` interface.
