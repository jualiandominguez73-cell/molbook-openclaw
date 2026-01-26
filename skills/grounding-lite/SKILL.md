---
name: grounding-lite
description: Google Maps Grounding Lite MCP for AI-powered location search, weather, and routes via mcporter.
homepage: https://developers.google.com/maps/ai/grounding-lite
metadata: {"clawdbot":{"emoji":"🗺️","requires":{"bins":["mcporter"],"env":["GOOGLE_MAPS_API_KEY"]},"primaryEnv":"GOOGLE_MAPS_API_KEY"}}
---

# Grounding Lite

Google Maps Grounding Lite provides AI-grounded location data via MCP. Use `mcporter` to call tools directly.

**Status**: Experimental (pre-GA), free during preview.

**Rate limits**: search_places (100 QPM, 1K QPD), lookup_weather (300 QPM), compute_routes (300 QPM).

## Setup

1. Install mcporter: `npm install -g mcporter`
2. Set `GOOGLE_MAPS_API_KEY` environment variable
3. Configure the MCP server (one-time):

```bash
mcporter config add grounding-lite \
  --url https://mapstools.googleapis.com/mcp \
  --header "X-Goog-Api-Key=$GOOGLE_MAPS_API_KEY"
```

### API Key Security

1. **Restrict your API key** in Google Cloud Console:
   - API restrictions: Allow only `mapstools.googleapis.com`
   - Application restrictions: Use IP restriction if on a fixed server

2. **Never hardcode keys** - use environment variables

3. **For production**: Consider OAuth 2.0 (better audit trails)

See: https://developers.google.com/maps/api-security-best-practices

## Search Places

Find places by text query with AI summaries:

```bash
mcporter call grounding-lite.search_places text_query="coffee shops near Central Park"
```

With location bias:

```bash
mcporter call grounding-lite.search_places \
  text_query="pizza" \
  location_bias='{"center":{"latitude":40.7829,"longitude":-73.9654},"radius":2000}'
```

JSON output:

```bash
mcporter call grounding-lite.search_places text_query="sushi in Tokyo" --output json
```

Response includes: place IDs, names, addresses, coordinates, Google Maps links, and AI summary.

## Lookup Weather

Get current weather:

```bash
mcporter call grounding-lite.lookup_weather location='{"address":"San Francisco, CA"}' units_system=IMPERIAL
```

By coordinates:

```bash
mcporter call grounding-lite.lookup_weather \
  location='{"lat_lng":{"latitude":35.6762,"longitude":139.6503}}'
```

By place ID:

```bash
mcporter call grounding-lite.lookup_weather location='{"place_id":"ChIJ..."}'
```

Forecast for a specific date/hour:

```bash
mcporter call grounding-lite.lookup_weather \
  location='{"address":"New York, NY"}' \
  date='{"year":2026,"month":1,"day":28}' \
  hour=14
```

Units: `METRIC` (Celsius, km/h) or `IMPERIAL` (Fahrenheit, mph).

## Compute Routes

Calculate distance and duration:

```bash
mcporter call grounding-lite.compute_routes \
  origin='{"address":"San Francisco, CA"}' \
  destination='{"address":"Los Angeles, CA"}' \
  travel_mode=DRIVE
```

Walking route:

```bash
mcporter call grounding-lite.compute_routes \
  origin='{"address":"Times Square, NYC"}' \
  destination='{"address":"Central Park, NYC"}' \
  travel_mode=WALK
```

Travel modes: `DRIVE` (default) or `WALK`.

Note: Returns distance/duration only. No step-by-step directions or real-time traffic.

## Ad-hoc Usage (without config)

Call directly without configuring first:

```bash
mcporter call "https://mapstools.googleapis.com/mcp.search_places" \
  --header "X-Goog-Api-Key=$GOOGLE_MAPS_API_KEY" \
  text_query="restaurants near me"
```

## List Available Tools

```bash
mcporter list grounding-lite --schema
```

## Notes

- Free during preview; pricing TBD after GA
- Weather lookup has regional restrictions (US locations work; some international locations may not)
- Attribution required per Google Maps Platform ToS
- Responses contain Google Maps links - include in user-facing output
