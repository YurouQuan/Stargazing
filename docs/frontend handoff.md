## Stargazing Planner · Frontend handoff

**API base URL**  
`https://rtjjaqk68j.execute-api.us-east-2.amazonaws.com/test`

Both endpoints use `POST` with `Content-Type: application/json`. Read the HTTP response directly as JSON. The deployed API already unwraps the Lambda proxy response.

1. **Submit the form to `/stargazing/plan`.** Send `location_type` (`city` or `address`), `location`, `state`, `date` (`YYYY-MM-DD`), `start_time`, and `end_time` (`HH:MM`, local to the selected location). For example, use `city`, `Evanston`, `IL`, a date in the forecast range, and `20:00` to `00:00`.
2. **Render the selected location first.** Use `requested_location.display_name` as the title and `requested_location.assessment` for SQM, Bortle, and the best window. Convert UTC timestamps to `requested_location.timezone` for display. If `best_window` is `null`, still show the location and explain its assessment status.
3. **Call `/stargazing/nearby`.** Copy `latitude`, `longitude`, and `timezone` from `requested_location`, and `start_utc` and `end_utc` from `interval`. If Plan has a `best_window`, send its unrounded `score` as `baseline_score` to get only higher-scoring alternatives. Omit the baseline when Plan has no score.
4. **Render `alternatives` below the selected location.** Each item already has `display_name`, `distance_km`, coordinates, and an `assessment`. Keep the selected location visible while Nearby loads and if Nearby fails or returns an empty list.

**Integration status.** Both POST endpoints have passed live testing. Use fixtures for UI development until CORS is enabled for the agreed frontend origin. The handoff is complete once the form runs both requests from a browser and renders the two result sections.
