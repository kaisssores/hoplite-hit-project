import { endpoint, official, query } from "../dsl.ts";

export const geo = official({
  id: "geo",
  name: "Geo",
  summary: "Geocoding, reverse lookup, address autocomplete and time zones",
  description:
    "Geo turns addresses into coordinates and back, completes addresses as people type, and resolves the time zone for a point. Results are cached for 24 hours, so repeated lookups are cheap.",
  category: "Data",
  owner: "Location services",
  adapter: "rest",
  version: "2.0.1",
  stability: "stable",
  baseUrl: "https://api.tether.dev/geo",
  auth: "api_key",
  rateLimit: 900,
  registeredAt: "2024-11-18T15:00:00Z",
  scopes: [
    { name: "geocode.read", description: "Geocode, reverse geocode and autocomplete" },
    { name: "timezone.read", description: "Resolve time zones for coordinates" },
  ],
  endpoints: [
    endpoint("geo.geocode", "GET", "/v2/geocode", "Geocode an address", {
      description: "Returns the best matches for a free-text address, most confident first.",
      scope: "geocode.read",
      params: [query("address", "string", "Address to look up", { required: true, example: "Keizersgracht 123, Amsterdam" }), query("country", "string", "ISO 3166 country code to bias results", { example: "NL" })],
      response: {
        results: [{ formatted: "Keizersgracht 123, 1015 CJ Amsterdam, Netherlands", lat: 52.3748, lon: 4.8847, confidence: 0.97, type: "building" }],
      },
    }),
    endpoint("geo.reverse", "GET", "/v2/reverse", "Reverse geocode", {
      description: "Returns the address nearest to a coordinate pair.",
      scope: "geocode.read",
      params: [query("lat", "number", "Latitude in decimal degrees", { required: true, example: "52.3748" }), query("lon", "number", "Longitude in decimal degrees", { required: true, example: "4.8847" })],
      response: { formatted: "Keizersgracht 123, 1015 CJ Amsterdam, Netherlands", lat: 52.3748, lon: 4.8847, distance_m: 6 },
    }),
    endpoint("geo.autocomplete", "GET", "/v2/autocomplete", "Autocomplete an address", {
      description: "Returns address completions for a partial string. Meant to be called on every keystroke after a short debounce.",
      scope: "geocode.read",
      params: [query("q", "string", "Partial address", { required: true, example: "keizersg" }), query("limit", "integer", "Number of completions", { example: "3" })],
      response: {
        data: [
          { id: "place_Ks81", text: "Keizersgracht, Amsterdam" },
          { id: "place_Ks82", text: "Keizersgracht, Hilversum" },
          { id: "place_Ks83", text: "Keizerstraat, Rotterdam" },
        ],
      },
    }),
    endpoint("geo.timezone", "GET", "/v2/timezone", "Look up a time zone", {
      description: "Returns the IANA time zone at a point and its current UTC offset, including daylight saving.",
      scope: "timezone.read",
      params: [query("lat", "number", "Latitude in decimal degrees", { required: true, example: "52.3748" }), query("lon", "number", "Longitude in decimal degrees", { required: true, example: "4.8847" })],
      response: { zone: "Europe/Amsterdam", abbreviation: "CET", utc_offset_seconds: 3600, dst: false },
    }),
  ],
  changelog: [
    { version: "2.0.1", date: "2026-09-23", note: "Autocomplete no longer returns duplicate streets across postcodes" },
    { version: "2.0.0", date: "2026-05-12", note: "Responses use lat and lon instead of a coordinates array" },
    { version: "1.9.0", date: "2026-02-18", note: "Added the time zone endpoint" },
  ],
});
