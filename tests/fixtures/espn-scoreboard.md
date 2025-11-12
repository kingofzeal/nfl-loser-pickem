# Sample ESPN API responses for testing

## Scoreboard Response (Week 1, 2024)

```json
{
  "leagues": [
    {
      "id": "28",
      "name": "National Football League",
      "abbreviation": "NFL"
    }
  ],
  "season": {
    "year": 2024,
    "type": 2
  },
  "week": {
    "number": 1
  },
  "events": [
    {
      "id": "401547417",
      "uid": "s:20~l:28~e:401547417",
      "date": "2024-09-05T23:20Z",
      "name": "Kansas City Chiefs at Baltimore Ravens",
      "shortName": "KC @ BAL",
      "season": {
        "year": 2024,
        "type": 2
      },
      "week": {
        "number": 1
      },
      "competitions": [
        {
          "id": "401547417",
          "uid": "s:20~l:28~e:401547417~c:401547417",
          "date": "2024-09-05T23:20Z",
          "attendance": 70000,
          "type": {
            "id": "1",
            "abbreviation": "STD"
          },
          "timeValid": true,
          "neutralSite": false,
          "conferenceCompetition": false,
          "recent": false,
          "venue": {
            "id": "3738",
            "fullName": "M&T Bank Stadium",
            "address": {
              "city": "Baltimore",
              "state": "MD"
            }
          },
          "competitors": [
            {
              "id": "33",
              "uid": "s:20~l:28~t:33",
              "type": "team",
              "order": 0,
              "homeAway": "home",
              "team": {
                "id": "33",
                "uid": "s:20~l:28~t:33",
                "location": "Baltimore",
                "name": "Ravens",
                "abbreviation": "BAL",
                "displayName": "Baltimore Ravens",
                "shortDisplayName": "Ravens",
                "color": "241773",
                "alternateColor": "000000",
                "isActive": true,
                "logo": "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png"
              },
              "score": "20",
              "records": [
                {
                  "name": "overall",
                  "abbreviation": "Total",
                  "type": "total",
                  "summary": "0-1"
                }
              ]
            },
            {
              "id": "12",
              "uid": "s:20~l:28~t:12",
              "type": "team",
              "order": 1,
              "homeAway": "away",
              "winner": true,
              "team": {
                "id": "12",
                "uid": "s:20~l:28~t:12",
                "location": "Kansas City",
                "name": "Chiefs",
                "abbreviation": "KC",
                "displayName": "Kansas City Chiefs",
                "shortDisplayName": "Chiefs",
                "color": "e31837",
                "alternateColor": "ffb612",
                "isActive": true,
                "logo": "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png"
              },
              "score": "27",
              "records": [
                {
                  "name": "overall",
                  "abbreviation": "Total",
                  "type": "total",
                  "summary": "1-0"
                }
              ]
            }
          ],
          "status": {
            "clock": 0,
            "displayClock": "0:00",
            "period": 4,
            "type": {
              "id": "3",
              "name": "STATUS_FINAL",
              "state": "post",
              "completed": true,
              "description": "Final",
              "detail": "Final",
              "shortDetail": "Final"
            }
          }
        }
      ],
      "status": {
        "clock": 0,
        "displayClock": "0:00",
        "period": 4,
        "type": {
          "id": "3",
          "name": "STATUS_FINAL",
          "state": "post",
          "completed": true,
          "description": "Final",
          "detail": "Final",
          "shortDetail": "Final"
        }
      }
    }
  ]
}
```

## Scheduled Game Example

```json
{
  "id": "401547418",
  "date": "2024-09-08T17:00Z",
  "name": "Green Bay Packers at Philadelphia Eagles",
  "status": {
    "type": {
      "name": "STATUS_SCHEDULED",
      "state": "pre",
      "completed": false,
      "description": "Scheduled",
      "detail": "9/8 - 1:00 PM EDT",
      "shortDetail": "9/8"
    }
  },
  "competitions": [
    {
      "competitors": [
        {
          "homeAway": "home",
          "team": {
            "id": "21",
            "abbreviation": "PHI",
            "displayName": "Philadelphia Eagles"
          }
        },
        {
          "homeAway": "away",
          "team": {
            "id": "9",
            "abbreviation": "GB",
            "displayName": "Green Bay Packers"
          }
        }
      ]
    }
  ]
}
```
