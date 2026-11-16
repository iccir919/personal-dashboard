import { saveToCache, loadFromCache } from "./cache.js"
import { updatePinnedLocation } from "./location.js"

// Weather section

// Shared weather state
let currentForecastUrl = null
let currentHourlyPeriods = null
const FORECAST_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

function showWeatherError(err) {
    console.error("Error loading weather", err)

    document.getElementById("future-forecast-container").innerHTML =
        "<p>Couldn't load the weather right now. Try a new tab in a few minutes.</p>"

    document.getElementById("weather-last-updated").innerText = ""
}

export async function getCurrentLocationWeatherProperties(location) {
    // Already know this location's forecast area? Skip the lookup.
    if (location.forecastUrl) {
        currentForecastUrl = location.forecastUrl
        currentHourlyPeriods = null
        get7DayWeatherForecast(currentForecastUrl)
        getHourlyForecast(currentForecastUrl)
        return
    }

    try {
        const res = await fetch(`https://api.weather.gov/points/${location.latitude},${location.longitude}`)
        if (!res.ok) throw new Error(`Couldn't look up the forecast area for this location (status ${res.status})`)

        const data = await res.json()
        currentForecastUrl = data.properties.forecast
        currentHourlyPeriods = null

        // Save it with the location so next time we can skip the lookup
        location.forecastUrl = currentForecastUrl
        saveToCache("location", location)
        updatePinnedLocation(location)

        get7DayWeatherForecast(currentForecastUrl)
        getHourlyForecast(currentForecastUrl)
    } catch (err) {
        showWeatherError(err)
    }
}

async function get7DayWeatherForecast(forecastUrl) {
    // Each place gets its own saved forecast, named after its forecast URL
    const cacheKey = `forecast-${forecastUrl}`

    const savedForecast = loadFromCache(cacheKey, FORECAST_MAX_AGE_MS)
    if (savedForecast) {
        render7DayWeatherForecast(savedForecast.properties)
        return
    }

    try {
        const res = await fetch(forecastUrl)
        if (!res.ok) throw new Error(`Couldn't load the forecast (status ${res.status})`)

        const data = await res.json()

        // If the ZIP changed while this request was in flight, a newer
        // forecast is on its way. Skip this old one so it can't overwrite it.
        if (forecastUrl !== currentForecastUrl) return

        saveToCache(cacheKey, { properties: data.properties })
        render7DayWeatherForecast(data.properties)
    } catch (err) {
        if (forecastUrl === currentForecastUrl) showWeatherError(err)
    }
}

function render7DayWeatherForecast(forecast) {
    const forecastGenerationDatetime = new Date(forecast.generatedAt)

    document.getElementById("weather-last-updated").innerText = `Forecast generated: ${forecastGenerationDatetime.toLocaleDateString()} at ${forecastGenerationDatetime.toLocaleTimeString()}`

    const [current, ...rest] = forecast.periods

    // Today: during the day it's today plus tonight; at night it's just tonight
    const today = current.isDaytime
        ? { day: current, night: rest[0] }
        : { day: current, night: null }

    // The next 6 days: each day paired with the night right after it, which has that day's low
    const nextDays = rest
        .map((period, index) => ({ day: period, night: rest[index + 1] }))
        .filter(({ day }) => day.isDaytime)
        .slice(0, 6)

    document.getElementById("future-forecast-container").innerHTML =
        [today, ...nextDays].map((row, index) => renderDayRow(row, index === 0)).join("")

    // Fill in each day's hours (if the hourly forecast has already loaded)
    renderAllHourlyStrips()

    function renderDayRow({ day, night }, isToday) {
        const low = night ? ` / ${night.temperature}°` : ""
        const details = night
            ? `${day.name}: ${day.detailedForecast}\n\n${night.name}: ${night.detailedForecast}`
            : day.detailedForecast

        // <details> opens and closes when its <summary> is clicked.
        // Sharing a name means only one can be open at a time. Today starts open.
        return `
            <details class="day-row" name="forecast-days" ${isToday ? "open" : ""}>
                <summary class="weather-period-container" title="${toTitle(details)}">
                    <h4 class="weather-period-name">${day.name}</h4>
                    ${renderIcon(day)}
                    <span class="weather-wind">${getWind(day)}</span>
                    <p class="weather-period-temperature-text">${day.temperature}°${low}</p>
                </summary>
                <div class="hourly-strip" data-today="${isToday}" data-day-start="${day.startTime}"></div>
            </details>
        `
    }

    function renderIcon(period) {
        const emoji = getWeatherEmoji(period)
        const isWet = ["🌧️", "⛈️", "❄️"].some(wet => emoji.includes(wet))
        const chance = period.probabilityOfPrecipitation?.value
        const chanceText = isWet && chance ? `<span class="weather-rain-chance">${chance}%</span>` : ""

        return `<span class="weather-period-icon">${emoji}${chanceText}</span>`
    }

    function toTitle(text) {
        // A " inside the text would end the title="..." early, so swap it for the HTML-safe version
        return text.replaceAll('"', "&quot;")
    }

    function getWind(period) {
        if (!period.windSpeed) return ""
        const speed = period.windSpeed.replace(" to ", "-")

        // The 16 compass directions, in order, each 22.5° apart (360 / 16)
        const compass = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                         "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        const index = compass.indexOf(period.windDirection)

        // Unknown direction? Fall back to the letters
        if (index === -1) return `${period.windDirection} ${speed}`

        // Wind is reported as where it comes FROM, so turn the arrow around (+180°)
        const degrees = index * 22.5 + 180

        return `<span class="wind-arrow" style="transform: rotate(${degrees}deg)">↑</span>${speed}`
    }
}

// Weather emoji (used by both the daily rows and the hourly strip)

function getWeatherEmoji(period) {
    // "Patchy Fog then Mostly Sunny" becomes ["patchy fog", "mostly sunny"]
    const parts = period.shortForecast.toLowerCase().split(" then ")

    const first = getEmojiForText(parts[0], period.isDaytime)
    if (parts.length === 1) return first

    const second = getEmojiForText(parts[1], period.isDaytime)

    // "Sunny then Mostly Sunny" would give ☀️→☀️, so just show one
    if (first === second) return first

    return `${first}<span class="weather-arrow">→</span>${second}`
}

function getEmojiForText(forecast, isDaytime) {
    // Weather that matters most comes first
    if (forecast.includes("thunder")) return "⛈️"
    if (forecast.includes("snow")) return "❄️"
    if (forecast.includes("rain") || forecast.includes("showers") || forecast.includes("drizzle")) return "🌧️"
    if (forecast.includes("fog")) return "🌁"

    // Night: no sun emoji
    if (!isDaytime) {
        if (forecast.includes("cloudy")) return "☁️"
        return "🌙"
    }

    // Day: from sunny to cloudy
    if (forecast.includes("mostly sunny")) return "🌤️"
    if (forecast.includes("partly")) return "⛅"
    if (forecast.includes("mostly cloudy")) return "🌥️"
    if (forecast.includes("cloudy")) return "☁️"
    return "☀️"
}

// Hourly strip (next 12 hours, every 3 hours)

async function getHourlyForecast(forecastUrl) {
    const hourlyUrl = `${forecastUrl}/hourly`
    const cacheKey = `hourly-${hourlyUrl}`

    const saved = loadFromCache(cacheKey, FORECAST_MAX_AGE_MS)
    if (saved) {
        currentHourlyPeriods = saved.periods
        renderAllHourlyStrips()
        return
    }

    try {
        const res = await fetch(hourlyUrl)
        if (!res.ok) throw new Error(`Couldn't load the hourly forecast (status ${res.status})`)

        const data = await res.json()

        // A newer place was chosen while this was loading, so skip it
        if (forecastUrl !== currentForecastUrl) return

        // Keep every hour, but only the fields we use, so the saved data stays small
        const periods = data.properties.periods.map(period => ({
            startTime: period.startTime,
            endTime: period.endTime,
            temperature: period.temperature,
            shortForecast: period.shortForecast,
            isDaytime: period.isDaytime,
            probabilityOfPrecipitation: period.probabilityOfPrecipitation
        }))
        saveToCache(cacheKey, { periods })
        currentHourlyPeriods = periods
        renderAllHourlyStrips()
    } catch (err) {
        console.error("Error loading hourly forecast", err)
    }
}

function renderAllHourlyStrips() {
    // The daily rows and the hourly forecast load separately; whichever finishes
    // second fills in the hours. If the hours aren't here yet, there's nothing to do.
    if (!currentHourlyPeriods) return

    document.querySelectorAll(".day-row .hourly-strip").forEach(strip => {
        const isToday = strip.dataset.today === "true"
        const stops = isToday
            ? getNext12Hours(currentHourlyPeriods)
            : getDayHours(currentHourlyPeriods, strip.dataset.dayStart)

        strip.innerHTML = stops
            .map((period, index) => renderHourlyStop(period, isToday && index === 0))
            .join("")
    })
}

function getNext12Hours(periods) {
    const now = new Date()

    // Saved hours can be up to 30 minutes old, so drop any that are already over
    const upcoming = periods.filter(period => new Date(period.endTime) > now)

    // Now, then 3, 6, 9, and 12 hours from now
    return [0, 3, 6, 9, 12]
        .map(hoursAhead => upcoming[hoursAhead])
        .filter(Boolean)
}

function getDayHours(periods, dayStart) {
    // A day row starts at 6 AM. Show every 3 hours from then until 3 AM the next morning.
    const start = new Date(dayStart).getTime()
    const ONE_HOUR_MS = 60 * 60 * 1000

    return [0, 3, 6, 9, 12, 15, 18, 21]
        .map(hoursAfter => start + hoursAfter * ONE_HOUR_MS)
        .map(time => periods.find(period => new Date(period.startTime).getTime() === time))
        .filter(Boolean)
}

function renderHourlyStop(period, isNow) {
    const label = isNow
        ? "Now"
        : new Date(period.startTime).toLocaleTimeString("en-US", { hour: "numeric" })

    const emoji = getWeatherEmoji(period)
    const isWet = ["🌧️", "⛈️", "❄️"].some(wet => emoji.includes(wet))
    const chance = period.probabilityOfPrecipitation?.value
    const chanceText = isWet && chance ? `<span class="weather-rain-chance">${chance}%</span>` : ""

    return `
        <div class="hourly-stop${isNow ? " is-now" : ""}">
            <span class="hourly-time">${label}</span>
            <span class="hourly-emoji">${emoji}</span>
            <span class="hourly-temp">${period.temperature}°</span>
            ${chanceText}
        </div>
    `
}