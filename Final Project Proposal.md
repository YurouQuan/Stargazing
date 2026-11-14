# Final Project Proposal
### Introduction

In this final project, we would like to build up a web application for helping people decide when and where to go stargazing. Users simply enter a street address or city name with the date and time range they would like to observe the universe. Our application would firstly assess user's selected location, then lists several official observatories within a 50km radius, sorted by priority. 

Our serverless web service will use Amazon API Gateway to receive requests, and use AWS Lambda to execute the planning logics. Amazon S3 will be used to store a verified directory of observation sites. The service will perform 3 distinct operations: 
1. geocode the requested location and evaluate observing conditions by taking the following data into account to explain the key influencing factors: a) Open-Meteo's cloud cover forecasts, b) background sky brightness simulated by DarkSkySites, and c) calculated positions of the sun and moon. 
2. search for the continuous time period within the user-specified timeframe that best matches the user's desired duration. Exclude windows with insufficient light, rate the remaining window based on cloud coverage, moonlight, and background sky brightness, and return the window with the highest rating. If no windows could be rated, return a message with explanation.
3. filter the observation sites in the directory based on distance, evaluating the forecast conditions at these sites during the qualifying time period, and rank those sites that offer better conditions than user's selected location.

<div class="page-break" style="page-break-before: always;"></div>

#### Sequence Diagram
Here is a brief walkthrough of our project:
```mermaid
---
config:
 useMaxWidth: true
---
sequenceDiagram
    actor U as User
    participant B as Browser
    participant G as API Gateway
    participant L as Python Lambda
    participant A as Geocoding API
    participant D as DarkSkySites
    participant W as Open-Meteo
    participant S as S3 Site Catalog

    U->>B: Enter address, date, time range, <br> duration, and search radius
    B->>G: POST /stargazing/plan <br>with a JSON request body
    G->>L: Invoke Lambda with the <br>request body in event.body
    L->>L: Parse JSON and validate inputs
    L->>A: Look up the <br>street address
    A-->>L: Return the matched <br>address and coordinates

    rect rgba(70, 130, 180, 0.12)
        Note over L,W: 1. Assess the requested address
        L->>D: Look up background sky brightness at the coordinates
        D-->>L: Return SQM, dataset month, and data quality
        L->>W: Request hourly cloud cover at the coordinates
        W-->>L: Return cloud cover and forecast timestamps
        L->>L: Align times and calculate Sun altitude, <br>Moon altitude, and lunar illumination
        L->>L: Find the best continuous 60-minute <br>window using SQM, clouds, and moonlight
    end

    rect rgba(70, 130, 180, 0.12)
        Note over L,S: 2. Find nearby alternatives
        L->>S: Read the stargazing site catalog
        S-->>L: Return site names, coordinates, <br> and stored SQM values
        L->>L: Keep sites within 50 km by <br>straight-line distance
        alt Eligible sites found
            L->>W: Request hourly cloud cover at each candidate site
            W-->>L: Return the forecasts for those sites
            L->>L: Calculate Sun and Moon conditions
            L->>L: Compare each site with the original <br>address and rank better alternatives
        else No sites meet the distance
            L->>L: Keep the address assessment and <br>return an empty alternatives list
        end
    end

    L-->>G: Return statusCode 200 and a JSON body c<br>ontaining requested_location and alternatives
    G-->>B: HTTP 200 with the requested location assessment <br> and a ranked list of alternatives within 50 km
    B-->>U: Show your selected location first, then nearby <br> alternatives or "No eligible alternatives within 50 km"
```
