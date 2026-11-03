# Personal Dashboard

A Chrome extension that replaces the new tab page with a personal dashboard.

Started as practice for async JavaScript during Scrimba's Frontend Career Path, and now my everyday new tab.

## Features

- **Clock** that updates every second
- **Location** from a ZIP code, saved so you only enter it once
- **Weather**: current conditions and a 7 day forecast, with a Day/Night toggle
- **Moon phase**: today's illumination and phase, drawn as a little moon
- **Top 10 sites** you visited in the last 7 days, pulled from your Chrome history
- **Random gradient background** on every new tab

## Install

This extension isn't on the Chrome Web Store. Load it yourself:

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose this folder.
5. Open a new tab and enter your ZIP code.

After changing any file, click the reload icon on the extension's card in `chrome://extensions`, then open a new tab.

## Permissions

| Permission | Why |
| --- | --- |
| `history` | Reads the last 7 days of browsing history to find your most visited sites. This stays in your browser and is never sent anywhere. |

## Data sources

All free and no API keys needed:

- [Zippopotam.us](https://api.zippopotam.us): ZIP code to city and coordinates
- [National Weather Service API](https://www.weather.gov/documentation/services-web-api): forecast (US only)
- [U.S. Naval Observatory API](https://aa.usno.navy.mil/data/api): moon phase and illumination

## Files

```
personal_dashboard/
├── manifest.json   extension settings and permissions
├── index.html      page layout
├── index.css       styles
├── index.js        all the logic
└── icon.png        extension icon
```