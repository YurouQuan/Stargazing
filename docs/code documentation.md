## Shared location assessment

`assess_location(*, latitude: float, longitude: float, start_utc: datetime, end_utc: datetime, duration_minutes: int = 60) -> LocationAssessment`

The function assesses one location over one time range. Latitude and longitude are passed by name in decimal degrees. `start_utc` and `end_utc` are timezone-aware UTC timestamps. The caller converts the user's local date and times to UTC before calling the function.

### Return value

`LocationAssessment` is a JSON-serializable Python dictionary.

| Field | Type and meaning |
| --- | --- |
| `status` | `scored`, `no_eligible_window`, or `insufficient_data` |
| `sky_background` | Object with `sqm` (number, mag/arcsec²) and `bortle_class` (integer, 1–9), or `null` if the background estimate is unavailable. Use SQM in scoring and Bortle for display. |
| `best_window` | Object with the fields below, or `null` when no window can be scored |
| `warnings` | List of strings. Use an empty list when there are no warnings. |

| `best_window` field | Type and meaning |
| --- | --- |
| `start_utc`, `end_utc` | ISO 8601 UTC strings ending in `Z` |
| `score` | Number from 0–100. Our score combines forecast cloud cover, moonlight, and SQM for this window. The UI labels it **Observing Quality**. |
| `mean_cloud_cover_pct` | Mean forecast cloud cover across the samples used for this window, from 0–100 |
| `sun_altitude_midpoint_deg`, `moon_altitude_midpoint_deg` | Sun and Moon angles relative to the horizon at the window midpoint, in degrees |
| `lunar_illumination_midpoint_pct` | Percentage of the Moon’s visible disc illuminated at the window midpoint, from 0–100 |

##### output example
```json
{
  "status": "scored",
  "sky_background": {
    "sqm": 20.8,
    "bortle_class": 4
  },
  "best_window": {
    "start_utc": "2026-11-21T03:00:00Z",
    "end_utc": "2026-11-21T04:00:00Z",
    "score": 84.2,
    "mean_cloud_cover_pct": 12,
    "sun_altitude_midpoint_deg": -28,
    "moon_altitude_midpoint_deg": -5,
    "lunar_illumination_midpoint_pct": 67
  },
  "warnings": []
}
```
**Plan** calls the function once after geocoding. **Nearby** calls it once per shortlisted site and uses `best_window.score` to rank scorable candidates. Both Lambda handlers add their own HTTP `statusCode`.
