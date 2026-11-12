// Background image

// Background: random gradient, with colors that follow the time of day

const TIME_OF_DAY_COLORS = {
    // Hue ranges on the color wheel (0-360; numbers past 360 wrap around to reds, oranges, yellows)
    dawn:  { hues: [300, 420], lightness: 38 },  // magentas, pinks, corals, golds
    day:   { hues: [90, 260],  lightness: 36 },  // greens, teals, blues, indigo
    dusk:  { hues: [260, 410], lightness: 32 },  // purples, reds, oranges
    night: { hues: [200, 300], lightness: 22 }   // deep blues, indigo, purples
}

function getRandomBackground() {
    document.body.style.backgroundImage = generateGradient(getTimeOfDay())
}

function getTimeOfDay() {
    // Use today's saved sunrise and sunset if we have them, otherwise typical times
    const sundata = loadFromCache("moon")?.moonData?.sundata
    const sunrise = sundata?.find(item => item.phen === "Rise")
    const sunset = sundata?.find(item => item.phen === "Set")

    const sunriseMinutes = sunrise ? timeToMinutes(sunrise.time) : 6 * 60 + 45
    const sunsetMinutes = sunset ? timeToMinutes(sunset.time) : 17 * 60

    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    // Within an hour of sunrise or sunset counts as dawn or dusk
    if (Math.abs(nowMinutes - sunriseMinutes) <= 60) return "dawn"
    if (Math.abs(nowMinutes - sunsetMinutes) <= 60) return "dusk"
    if (nowMinutes > sunriseMinutes && nowMinutes < sunsetMinutes) return "day"
    return "night"
}

function timeToMinutes(time) {
    // "17:06" becomes 1026 (minutes since midnight)
    const [hours, minutes] = time.split(":").map(Number)
    return hours * 60 + minutes
}

function generateGradient(timeOfDay) {
    const { hues, lightness } = TIME_OF_DAY_COLORS[timeOfDay]
    const [lowest, highest] = hues

    // First color: anywhere in this time's range
    const hue1 = randomBetween(lowest, highest)

    // Second color: 45-100° away, in a random direction, so the gradient visibly shifts
    const direction = Math.random() < 0.5 ? -1 : 1
    const hue2 = hue1 + direction * randomBetween(45, 100)

    const color1 = makeColor(hue1, lightness)
    const color2 = makeColor(hue2, lightness)

    const linearGradient = `linear-gradient(to right, ${color1}, ${color2})`
    const radialGradient = `radial-gradient(circle at center, ${color1} 0, ${color2} 100%)`
    return Math.random() < 0.5 ? linearGradient : radialGradient
}

function makeColor(hue, lightness) {
    // Wrap the hue into 0-360, and vary saturation and lightness slightly for more variety
    const wrappedHue = ((Math.round(hue) % 360) + 360) % 360
    const saturation = randomBetween(50, 75)
    const finalLightness = lightness + randomBetween(-4, 4)
    return `hsl(${wrappedHue}, ${Math.round(saturation)}%, ${Math.round(finalLightness)}%)`
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min)
}

// Cache helpers
function saveToCache(key, value) {
    const entry = { savedAt: Date.now(), value }
    localStorage.setItem(key, JSON.stringify(entry))
}

function loadFromCache(key, maxAgeMs) {
    const saved = localStorage.getItem(key)
    if (!saved) return null

    try {
        const entry = JSON.parse(saved)
        if (maxAgeMs && Date.now() - entry.savedAt > maxAgeMs) return null
        return entry.value
    } catch {
        return null
    }
}

// Current location section

function getLocationFromLocalStorage() {
    const savedLocation = loadFromCache("location")
    if (savedLocation) {
        showLocation(savedLocation)
        return
    }

    const storedZipCode = localStorage.getItem("zipCode")
    if (storedZipCode) getZipCodeProperties(storedZipCode)
}

// Zip code form

document.getElementById("zip-code-form").addEventListener("submit", handleZipCodeInput)

document.getElementById("change-location-btn").addEventListener("click", () => {
    document.getElementById("location-row").hidden = true
    document.getElementById("zip-code-form").hidden = false
    document.getElementById("cancel-zip-btn").hidden = false
    document.getElementById("zipcode-input").focus()
})

document.getElementById("cancel-zip-btn").addEventListener("click", () => {
    document.getElementById("zip-code-form").hidden = true
    document.getElementById("location-row").hidden = false
})

function handleZipCodeInput(e) {
    e.preventDefault()

    const zipCodeInput = document.getElementById("zipcode-input")
    const zipCode = zipCodeInput.value
    zipCodeInput.value = ""
    getZipCodeProperties(zipCode)
}

async function getZipCodeProperties(zipCode) {
    const currentLocationResultDiv = document.getElementById("current-location-result")
    currentLocationResultDiv.textContent = "Loading location..."

    try {
        const res = await fetch(`https://api.zippopotam.us/us/${zipCode}`)
        if (!res.ok) {
            if (res.status === 404) throw new Error(`Zip code ${zipCode} not found`)
            throw new Error(`Error: ${res.status}`)
        }

        const data = await res.json()
        const place = data.places[0]
        const location = {
            zipCode: data["post code"],
            city: place["place name"],
            state: place["state abbreviation"],
            latitude: place.latitude,
            longitude: place.longitude
        }

        saveToCache("location", location)
        pinLocation(location)
        showLocation(location)
    } catch (err) {
        currentLocationResultDiv.textContent = err.message
    }
}

function showLocation(location) {
    document.getElementById("zip-code-form").hidden = true
    document.getElementById("location-row").hidden = false
    document.getElementById("current-location-heading").textContent = "Location"
    document.getElementById("current-location-result").textContent = ""

    renderLocationSwitcher(location)

    getCurrentLocationWeatherProperties(location)
    document.getElementById("weather-section").style.display = "block"
    getMoonInformation(location.latitude, location.longitude)
    document.getElementById("moon-section").style.display = "flex"
}

// Pinned locations

function getPinnedLocations() {
    return loadFromCache("pinnedLocations") || []
}

function updatePinnedLocation(location) {
    // Replace the pinned copy of this place with the updated one
    const pinned = getPinnedLocations().map(place =>
        place.zipCode === location.zipCode ? location : place
    )
    saveToCache("pinnedLocations", pinned)
}

function renderLocationSwitcher(current) {
    const switcher = document.getElementById("location-switcher")
    switcher.innerHTML = ""

    const pinned = getPinnedLocations()
    const currentIsPinned = pinned.some(place => place.zipCode === current.zipCode)

    // Show every pinned place, plus the current one at the end if it isn't pinned
    const places = currentIsPinned ? pinned : [...pinned, current]

    for (const place of places) {
        const item = document.createElement("span")
        item.className = "pinned-location"

        const switchButton = document.createElement("button")
        switchButton.type = "button"
        switchButton.className = "pinned-location-btn"
        switchButton.textContent = place.city
        if (place.zipCode === current.zipCode) switchButton.classList.add("is-current")
        switchButton.addEventListener("click", () => switchLocation(place))
        item.appendChild(switchButton)

        // Only pinned places get an unpin ✕
        const placeIsPinned = pinned.some(p => p.zipCode === place.zipCode)
        if (placeIsPinned) {
            const unpinButton = document.createElement("button")
            unpinButton.type = "button"
            unpinButton.className = "unpin-btn"
            unpinButton.textContent = "✕"
            unpinButton.title = `Unpin ${place.city}`
            unpinButton.setAttribute("aria-label", `Unpin ${place.city}`)
            unpinButton.addEventListener("click", () => unpinLocation(place.zipCode))
            item.appendChild(unpinButton)
        }

        switcher.appendChild(item)
    }
}

function pinLocation(location) {
    const pinned = getPinnedLocations()
    // Don't add the same place twice
    if (pinned.some(place => place.zipCode === location.zipCode)) return

    pinned.push(location)
    saveToCache("pinnedLocations", pinned)
}

function unpinLocation(zipCode) {
    const pinned = getPinnedLocations().filter(place => place.zipCode !== zipCode)
    saveToCache("pinnedLocations", pinned)
    renderLocationSwitcher(loadFromCache("location"))
}

function switchLocation(place) {
    saveToCache("location", place)
    showLocation(place)
}

// Time section

function getCurrentTime() {
    updateClock()
    setInterval(updateClock, 1000)
}

function updateClock() {
    const now = new Date()
    const time = now.toLocaleTimeString("en-US")
    const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

    const timeEl = document.getElementById("time-text")
    const dateEl = document.getElementById("date-text")

    // Only touch the page when something actually changed
    if (timeEl.textContent !== time) timeEl.textContent = time
    if (dateEl.textContent !== date) dateEl.textContent = date
}


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

async function getCurrentLocationWeatherProperties(location) {
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

// Most frequently visited websites

function getBrowsingHistory() {
    if ( !chrome.history ) {
        document.getElementById("most-frequent-websites-section").style.display = "none"
        return
    } 

    const today = new Date()
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7)

    chrome.history.search({ text: "",  maxResults: 500, startTime: sevenDaysAgo.getTime() }, getMostVisitedSites)
}

function getMostVisitedSites(history) {
    const sites = {}
    const hiddenSites = loadFromCache("hiddenSites") || []

    history.forEach(historyItem => {
        const url = new URL(historyItem.url)

        // Skip chrome:// pages, extension pages, and other non-website URLs
        if (!url.protocol.startsWith("http")) return

        // host includes the port, so localhost:3000 and localhost:5173 stay separate
        const site = url.host
        if (hiddenSites.includes(site)) return

        // First time seeing this site: start its entry
        if (!sites[site]) {
            sites[site] = { host: site, totalVisits: 0, topPage: historyItem }
        }

        sites[site].totalVisits += historyItem.visitCount

        // Remember whichever page on this site you've visited the most
        if (historyItem.visitCount > sites[site].topPage.visitCount) {
            sites[site].topPage = historyItem
        }
    })

    const top10Sites = Object.values(sites)
        .sort((a, b) => b.totalVisits - a.totalVisits)
        .slice(0, 10)

    renderMostVisitedSites(top10Sites)
}

function getFaviconUrl(pageUrl) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"))
    url.searchParams.set("pageUrl", pageUrl)
    url.searchParams.set("size", "32")
    return url.toString()
}

function renderMostVisitedSites(top10Sites) {
    const frequentWebsitesList = document.getElementById("frequent-websites-container")
    frequentWebsitesList.innerHTML = ""

    for (const site of top10Sites) {
        const page = site.topPage

        const listItem = document.createElement("li")
        listItem.className = "frequent-website-list-item"

        const link = document.createElement("a")
        link.href = page.url
        link.className = "frequent-website-link"
        link.title = page.url

        const icon = document.createElement("img")
        icon.className = "frequent-website-icon"
        icon.src = getFaviconUrl(page.url)
        icon.alt = ""

        const title = document.createElement("span")
        title.className = "frequent-website-title"
        // Some pages have no title, so fall back to the site's address
        title.textContent = page.title || new URL(page.url).host

        link.append(icon, title)
        
        const hideButton = document.createElement("button")
        hideButton.type = "button"
        hideButton.className = "hide-site-btn"
        hideButton.textContent = "✕"
        hideButton.title = `Hide ${site.host}`
        hideButton.setAttribute("aria-label", `Hide ${site.host}`)
        hideButton.addEventListener("click", () => hideSite(site.host))

        listItem.append(link, hideButton)

        frequentWebsitesList.appendChild(listItem)
    }

    // Show the "show hidden" link only when something is hidden
    const hiddenCount = (loadFromCache("hiddenSites") || []).length
    const unhideButton = document.getElementById("unhide-sites-btn")
    unhideButton.hidden = hiddenCount === 0
    unhideButton.textContent = `Show ${hiddenCount} hidden site${hiddenCount === 1 ? "" : "s"}`
}

function hideSite(host) {
    const hiddenSites = loadFromCache("hiddenSites") || []
    hiddenSites.push(host)
    saveToCache("hiddenSites", hiddenSites)

    // Rebuild the list so the next site moves up
    getBrowsingHistory()
}

document.getElementById("unhide-sites-btn").addEventListener("click", () => {
    localStorage.removeItem("hiddenSites")
    getBrowsingHistory()
})

// Moon phase

async function getMoonInformation(latitude, longitude) {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const day = today.getDate()
    const formattedDate = `${year}-${month}-${day}`
    // Hours from UTC, like -8 for Pacific Standard Time (already includes daylight saving)
    const timeZoneOffset = -today.getTimezoneOffset() / 60

    // The moon only changes once a day, so reuse today's data if we have it
    const savedMoon = loadFromCache("moon")
    if (savedMoon && savedMoon.date === formattedDate && savedMoon.timeZoneOffset === timeZoneOffset) {
        showMoon(savedMoon.moonData)
        return
    }

    const moonIlluminationUrl = `https://aa.usno.navy.mil/api/rstt/oneday?date=${formattedDate}&coords=${latitude},${longitude}&tz=${timeZoneOffset}&dst=false`

    try {
        const res = await fetch(moonIlluminationUrl)
        if (!res.ok) {
            throw new Error(`HTTP error! Response status: ${res.status}`)
        }
        const json = await res.json()
        const moonData = json.properties.data

        saveToCache("moon", { date: formattedDate, timeZoneOffset, moonData })
        showMoon(moonData)
    } catch (err) {
        console.error("Error fetching moon data", err)
        document.getElementById("illumination").textContent = "Error loading data"
        document.getElementById("current-phase").textContent = "N/A"
    }
}

function formatTime(time) {
    // "17:06" becomes "5:06 PM"
    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const hour12 = hours % 12 || 12
    return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`
}

function showMoon(moonData) {
    // fracillum is a percentage string like "92%", so parseInt gives 92 and we divide by 100 to get 0.92
    const fracIllum = parseInt(moonData.fracillum) / 100
    const curPhase = moonData.curphase

    document.getElementById("illumination").textContent = moonData.fracillum
    document.getElementById("current-phase").textContent = curPhase

    updateMoonPhase(fracIllum, curPhase)

    const sunrise = moonData.sundata.find(item => item.phen === "Rise")
    const sunset = moonData.sundata.find(item => item.phen === "Set")
    document.getElementById("sunrise").textContent = sunrise ? formatTime(sunrise.time) : "N/A"
    document.getElementById("sunset").textContent = sunset ? formatTime(sunset.time) : "N/A"

    // Moonrise and moonset go in a hover tooltip on the big moon
    const moonrise = moonData.moondata?.find(item => item.phen === "Rise")
    const moonset = moonData.moondata?.find(item => item.phen === "Set")

    const moonTimes = []
    if (moonrise) moonTimes.push(`Moonrise ${formatTime(moonrise.time)}`)
    if (moonset) moonTimes.push(`Moonset ${formatTime(moonset.time)}`)

    document.querySelector(".moon-container").title = moonTimes.join(" · ")
}

async function getMoonPhases() {
    // Phase times never change, so one fetch per day is plenty
    const todayKey = new Date().toDateString()
    const saved = loadFromCache("moonPhases")
    if (saved && saved.date === todayKey) {
        showMoonPhases(saved.phasedata)
        return
    }

    // Start about a month back so the list includes the previous new and full moon
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const startDate = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`

    try {
        const res = await fetch(`https://aa.usno.navy.mil/api/moon/phases/date?date=${startDate}&nump=10`)
        if (!res.ok) throw new Error(`Couldn't load moon phases (status ${res.status})`)

        const json = await res.json()
        saveToCache("moonPhases", { date: todayKey, phasedata: json.phasedata })
        showMoonPhases(json.phasedata)
    } catch (err) {
        console.error("Error loading moon phases", err)
        document.getElementById("moon-timeline").textContent = ""
    }
}

function phaseToDate(phase) {
    // The API gives UTC times, so build the date in UTC; JavaScript shows it in your local time
    const [hours, minutes] = phase.time.split(":").map(Number)
    return new Date(Date.UTC(phase.year, phase.month - 1, phase.day, hours, minutes))
}

const PHASE_EMOJI = {
    "New Moon": "🌑",
    "First Quarter": "🌓",
    "Full Moon": "🌕",
    "Last Quarter": "🌗"
}

function showMoonPhases(phasedata) {
    const now = new Date()
    const phases = phasedata.map(phase => ({ name: phase.phase, date: phaseToDate(phase) }))

    // Position of the first phase that hasn't happened yet
    const nextIndex = phases.findIndex(phase => phase.date > now)
    if (nextIndex === -1) return

    // Three before it, and it plus two more after
    const shown = phases.slice(Math.max(0, nextIndex - 3), nextIndex + 3)

    document.getElementById("moon-timeline").innerHTML = shown.map(renderTimelinePhase).join("")
}

function renderTimelinePhase(phase) {
    const isToday = phase.date.toDateString() === new Date().toDateString()
    const isPast = phase.date <= new Date()

    // Today's phase shows its time; the rest show their date
    const label = isToday
        ? phase.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : phase.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })

    const classes = ["moon-timeline-phase"]
    if (isPast) classes.push("is-past")
    if (isToday) classes.push("is-today")

    return `
        <div class="${classes.join(" ")}" title="${phase.name}">
            <span class="moon-timeline-date">${label}</span>
            <span class="moon-timeline-emoji">${PHASE_EMOJI[phase.name]}</span>
        </div>
    `
}

function updateMoonPhase(illumination, curPhase) {
    const moonShadow = document.getElementById("moon-shadow")
    // Reset properties to ensure proper rendering for each phase
    moonShadow.style.transform = ''
    moonShadow.style.borderRadius = "50%"
    moonShadow.style.left = "0"
    moonShadow.style.width = "100%"
    moonShadow.style.display = "block"

    switch(curPhase) {
        case "New Moon":
            // Shadow completely covers the moon
            moonShadow.style.transform = "translateX(0)"
            break
        case "Full Moon":
            // Shadow is completely off-screen (moon is fully lit)
            moonShadow.style.transform = "translateX(100%)"
            break
        case "First Quarter":
            // Right half is lit, left half is shadowed
            // The shadow covers the left half of the moon
            moonShadow.style.width = "50%"
            moonShadow.style.left = "0"
            moonShadow.style.borderRadius = "0" // Creates a semi-circle on the right edge
            moonShadow.style.transform = "translateX(0)"
            break
        case "Last Quarter":
            moonShadow.style.width = "50%"
            moonShadow.style.left = "50%"
            moonShadow.style.borderRadius = "0"
            moonShadow.style.transform = "translateX(0)"
            break
            case "Waxing Crescent":
            case "Waxing Gibbous":
                // Waxing: Shadow moves from right to left, uncovering light from the right.
                // As illumination increases (0 to 1), -((1-illumination)*100) goes from -100% to 0%.
                // Shadow starts fully off-left and moves right to reveal light.
                moonShadow.style.transform = `translateX(${-illumination * 100}%)`
                break;
            case "Waning Gibbous":
            case "Waning Crescent":
                // Waning: Shadow moves from left to right, covering light from the left.
                // As illumination decreases (1 to 0), (1-illumination)*100 goes from 0% to 100%.
                // Shadow starts fully off-right (or centered for full moon) and moves right to cover more.
                moonShadow.style.transform = `translateX(${illumination * 100}%)`
                break
        default:
            moonShadow.style.transform = `translateX(${illumination * 100}%)`
            break

    }

}

// Initialization

function initDashboard() {
    getLocationFromLocalStorage()
    getMoonPhases()
    getBrowsingHistory()
    getRandomBackground()
    getCurrentTime()
}

initDashboard()