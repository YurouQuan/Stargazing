## Shared location assessment

**Signature**  
`assess_location(*, latitude, longitude, start_utc, end_utc, duration_minutes=60) -> LocationAssessment`

The function evaluates **one coordinate pair over one time range**. Latitude and longitude are named inputs to avoid swapping them. Both timestamps include the full date and time in UTC. The caller converts the user's local date and time range before calling the function, including ranges that cross midnight.

The function fetches hourly cloud cover from Open-Meteo, looks up modeled background sky brightness from DarkSkySites, and calculates Sun altitude, Moon altitude, and lunar illumination. It evaluates continuous windows of `duration_minutes` and returns a Python dictionary that can be serialized to JSON:

| Field | Contents |
| --- | --- |
| `status` | `scored`, `no_eligible_window`, or `insufficient_data` |
| `sky_background` | Modeled overhead SQM and estimated Bortle class, if available |
| `best_window` | Start and end in UTC, suitability score from 0–100, and a summary of cloud cover, Sun altitude, Moon altitude, and lunar illumination for that window. `null` if no window can be scored. |
| `warnings` | Missing data or provider issues the UI should explain |

DarkSkySites provides **estimated Bortle class (1–9)**. The **0–100 suitability score** is our own calculation for the observing window. [DarkSkySites API documentation](https://darkskysites.com/api-access)

### How the two features use it

1. **Selected location.** The Plan handler geocodes the user's address or city, converts the local time range to UTC, and calls the function once. It returns the location name, coordinates, and assessment as `requested_location`, which the browser displays first.
2. **Nearby alternatives.** The Nearby handler receives the coordinates and UTC range from Plan, reads the S3 catalog, and shortlists up to five candidate sites within 50 km. It calls the same function once per shortlisted site, adds each site's name and distance, and sorts scored results from highest to lowest. A candidate with missing data does not stop the remaining evaluations. Nearby can be developed with a fixture that returns the fields above.

Both Lambda handlers package the same shared Python module. Each handler adds its own HTTP `statusCode` and serializes its response for API Gateway. The shared function returns the assessment and its domain `status`.
