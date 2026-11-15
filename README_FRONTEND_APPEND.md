## Frontend — run locally

The three-page static client lives in [`stargazing-frontend/`](stargazing-frontend/). It requires Python 3 and a modern browser; no npm install/build is needed.

```bash
cd stargazing-frontend
python -m http.server 8000
```

Open **http://localhost:8000**. On Windows, use `py -m http.server 8000` if needed. Set the deployed API Gateway stage URL in `stargazing-frontend/config.js` before running or deploying.

For the full file structure, location/address autocomplete, Plan and Nearby API contracts, time conversion, S3 deployment, and CORS troubleshooting, see **[Frontend README](stargazing-frontend/README.md)**.
