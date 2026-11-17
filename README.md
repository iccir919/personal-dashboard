# Personal Dashboard

A Chrome extension that replaces the new tab page with a personal dashboard: local weather, the moon, a clock, and the sites you visit most.

Started as practice for async JavaScript during Scrimba's Frontend Career Path, and now my everyday new tab.

**[Try the live demo](https://iccir919.github.io/personal-dashboard/)**. The demo runs as a regular web page, so it shows sample top sites instead of your browsing history.

## Features

- **Weather**: a 7 day forecast with emoji, chance of rain, and wind speed and direction. Click any day to see its hours.
- **Saved locations**: add places by ZIP code and switch between them with one click (home, work, family).
- **Moon**: today's phase drawn as a little moon, a timeline of recent and upcoming phases, sunrise and sunset, and moonrise and moonset on hover.
- **Clock** with the date, updated every second
- **Top sites**: your 10 most visited sites from the last 7 days. Hide any site with its ✕.
- **Background** that follows the time of day: warm at dawn and dusk, bright during the day, deep blues at night
- **Stays fresh**: data refreshes when you come back to the tab, and every 30 minutes while it's open
- **Works on any screen size**, from a wide monitor down to a narrow window

## Install

This extension isn't on the Chrome Web Store yet. Load it yourself:

1. On this page, click **Code** → **Download ZIP**, then unzip it. (Or clone the repo.)
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder.
5. Open a new tab and enter your ZIP code.

To update later, download the new version, replace the folder, and click the reload icon on the extension's card in `chrome://extensions`.

## Permissions

| Permission | Why |
| --- | --- |
| `history` | Reads the last 7 days of browsing history to find your most visited sites. This stays in your browser and is never sent anywhere. |
| `favicon` | Shows each site's icon next to it in the top sites list. |

## Data sources

All free, with no API keys or accounts needed:

- [Zippopotam.us](https://api.zippopotam.us): ZIP code to city and coordinates
- [National Weather Service API](https://www.weather.gov/documentation/services-web-api): daily and hourly forecasts (US only)
- [U.S. Naval Observatory API](https://aa.usno.navy.mil/data/api): moon phase, illumination, sunrise and sunset, and upcoming phases
- [DuckDuckGo icons](https://duckduckgo.com): site icons on the live demo only

Responses are cached in your browser (the forecast for 30 minutes, moon data for the day), so opening lots of tabs doesn't mean lots of requests.

## Files

```
personal_dashboard/
├── manifest.json        extension settings and permissions
├── index.html           page layout
├── index.css            styles
├── icon.png             extension icon
└── js/
    ├── main.js          starts everything and handles refreshing
    ├── cache.js         save and load from localStorage
    ├── background.js    time-of-day gradient
    ├── clock.js         time and date
    ├── top_sites.js     most visited sites (sample sites on the demo)
    ├── moon.js          moon phase, timeline, sunrise and sunset
    ├── location.js      ZIP code form and saved locations
    └── weather.js       daily and hourly forecast
```