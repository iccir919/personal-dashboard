// Background image

function getRandomBackground() {
      document.body.style.backgroundImage = generateRandomLinearGradient();
}

function getRandomColor() {
    const hue = Math.floor(Math.random() * 360)
    return `hsl(${hue}, 60%, 35%)`
}

function generateRandomLinearGradient() {
    const color1 = getRandomColor();
    const color2 = getRandomColor();
    const linearGradient = `linear-gradient(to right, ${color1}, ${color2})`;
    const radialGradient = `radial-gradient(circle at center, ${color1} 0, ${color2} 100%)`
    return Math.random() < 0.5 ? linearGradient : radialGradient;
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

function handleZipCodeInput(e) {
    e.preventDefault()

    const zipCodeInput = document.getElementById("zipcode-input")
    const zipCode = zipCodeInput.value
    zipCodeInput.value = ""
    getZipCodeProperties(zipCode)
}

async function getZipCodeProperties(zipCode) {
    const currentLocationResultDiv = document.getElementById("current-location-result")
    currentLocationResultDiv.innerHTML = "<p>Loading location...</p>"

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
        showLocation(location)
    } catch (err) {
        currentLocationResultDiv.innerHTML = `<p>${err.message}</p>`
    }
}

function showLocation(location) {
    document.getElementById("zipcode-input").placeholder = location.zipCode
    document.getElementById("current-location-heading").textContent = "Current Location:"
    document.getElementById("current-location-result").innerHTML = `<h2>${location.city}, ${location.state}</h2>`

    getCurrentLocationWeatherProperties(location)
    document.getElementById("weather-section").style.display = "block"
    getMoonInformation(location.latitude, location.longitude)
    document.getElementById("moon-section").style.display = "flex"
}

// Time section

function getCurrentTime() {
    const date = new Date()
    document.getElementById("time-text").textContent = date.toLocaleTimeString("en-us")
    setInterval(() => {
        const now = new Date();
        const timeEl = document.getElementById("time-text");
        const formattedTime = now.toLocaleTimeString("en-us");
        if (timeEl.textContent !== formattedTime) timeEl.textContent = formattedTime;
    }, 1000)
}


// Weather section

// Shared weather state
let currentForecastUrl = null
const FORECAST_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

function showWeatherError(err) {
    console.error("Error loading weather", err)

    document.getElementById("current-forecast-container").innerHTML =
        "<p>Couldn't load the weather right now. Try a new tab in a few minutes.</p>"
    
    document.getElementById("future-forecast-container").innerHTML = ""
    document.getElementById("future-forecast-heading").style.display = "none"

    document.getElementById("weather-last-updated").innerText = ""
}

async function getCurrentLocationWeatherProperties(location) {
    // Already know this location's forecast area? Skip the lookup.
    if (location.forecastUrl) {
        currentForecastUrl = location.forecastUrl
        get7DayWeatherForecast(currentForecastUrl)
        return
    }

    try {
        const res = await fetch(`https://api.weather.gov/points/${location.latitude},${location.longitude}`)
        if (!res.ok) throw new Error(`Couldn't look up the forecast area for this location (status ${res.status})`)

        const data = await res.json()
        currentForecastUrl = data.properties.forecast

        // Save it with the location so next time we can skip the lookup
        location.forecastUrl = currentForecastUrl
        saveToCache("location", location)

        get7DayWeatherForecast(currentForecastUrl)
    } catch (err) {
        showWeatherError(err)
    }
}

async function get7DayWeatherForecast(forecastUrl) {
    // Use the saved forecast if it's recent and for this same location
    const savedForecast = loadFromCache("forecast", FORECAST_MAX_AGE_MS)
    if (savedForecast && savedForecast.forecastUrl === forecastUrl) {
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

        saveToCache("forecast", { forecastUrl, properties: data.properties })
        render7DayWeatherForecast(data.properties)
    } catch (err) {
        if (forecastUrl === currentForecastUrl) showWeatherError(err)
    }
}

function render7DayWeatherForecast(forecast) {
    const forecastGenerationDatetime = new Date(forecast.generatedAt)

    document.getElementById("weather-last-updated").innerText = `Forecast generated: ${forecastGenerationDatetime.toLocaleDateString()} at ${forecastGenerationDatetime.toLocaleTimeString()}`

    const [current, ...rest] = forecast.periods
    // Pair each day with the night right after it, which has that day's low
    const nextDays = rest
        .map((period, index) => ({ day: period, night: rest[index + 1] }))
        .filter(({ day }) => day.isDaytime)
        .slice(0, 6)

    document.getElementById("current-forecast-container").innerHTML = renderWeatherPeriod(current)

    document.getElementById("future-forecast-heading").style.display = ""
    document.getElementById("future-forecast-container").innerHTML = nextDays.map(renderDayRow).join("")

    function renderWeatherPeriod(period) {
        return `
            <div class="weather-period-container" title="${toTitle(period.detailedForecast)}">                ${renderIcon(period)}
                <h4 class="weather-period-name">${period.name}</h4>
                <span class="weather-wind">${getWind(period)}</span>
                <p class="weather-period-temperature-text">${period.temperature}°${period.temperatureUnit}</p>            
            </div>
        `
    }

    function renderDayRow({ day, night }) {
        const low = night ? ` / ${night.temperature}°` : ""
        const details = night
            ? `${day.name}: ${day.detailedForecast}\n\n${night.name}: ${night.detailedForecast}`
            : day.detailedForecast

        return `
            <div class="weather-period-container" title="${toTitle(details)}">
                ${renderIcon(day)}
                <h4 class="weather-period-name">${day.name}</h4>
                <span class="weather-wind">${getWind(day)}</span>
                <p class="weather-period-temperature-text">${day.temperature}°${low}</p>
            </div>
        `
    }

    function renderIcon(period) {
        const emoji = getWeatherEmoji(period)
        const isWet = ["🌧️", "⛈️", "❄️"].includes(emoji)
        const chance = period.probabilityOfPrecipitation?.value
        const chanceText = isWet && chance ? `<span class="weather-rain-chance">${chance}%</span>` : ""

        return `<span class="weather-period-icon">${emoji}${chanceText}</span>`
    }

    function getWeatherEmoji(period) {
        const forecast = period.shortForecast.toLowerCase()

        // Weather that matters most comes first
        if (forecast.includes("thunder")) return "⛈️"
        if (forecast.includes("snow")) return "❄️"
        if (forecast.includes("rain") || forecast.includes("showers") || forecast.includes("drizzle")) return "🌧️"

        // Only show fog when it's the whole forecast, not "Partly Cloudy then Patchy Fog"
        if (forecast.includes("fog") && !forecast.includes("then")) return "🌫️"

        // Night: no sun emoji
        if (!period.isDaytime) {
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

    function toTitle(text) {
        // A " inside the text would end the title="..." early, so swap it for the HTML-safe version
        return text.replaceAll('"', "&quot;")
    }    

    function getWind(period) {
        if (!period.windSpeed) return ""
        const speed = period.windSpeed.replace(" to ", "-")
        return `${period.windDirection} ${speed}`
    }
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
    const websiteVisitCounts = {}

    history.forEach(historyItem => {
        const website = new URL(historyItem.url).hostname

        websiteVisitCounts[website] = (websiteVisitCounts[website] || 0) + historyItem.visitCount
    })

    const websiteVisitsSorted = Object.entries(websiteVisitCounts)
        .sort(([, countA], [, countB] ) => countB - countA)

    const top10VisitedWebsites = websiteVisitsSorted.slice(0, 10);

    renderMostVisitedSites(top10VisitedWebsites)
}

function getFaviconUrl(pageUrl) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"))
    url.searchParams.set("pageUrl", pageUrl)
    url.searchParams.set("size", "32")
    return url.toString()
}

function renderMostVisitedSites(top10VisitedWebsites) {

    const frequentWebsitesList = document.getElementById("frequent-websites-container")
    frequentWebsitesList.innerHTML = ""

    for (let [websiteURL, count] of top10VisitedWebsites) {
        const listItem = document.createElement("li")
        listItem.className = "frequent-website-list-item"
        const link = document.createElement("a")
        link.href = `https://${websiteURL}`
        link.target = "_blank"
        link.className = "frequent-website-link"
        link.textContent = websiteURL

        const icon = document.createElement("img")
        icon.className = "frequent-website-icon"
        icon.src = getFaviconUrl(`https://${websiteURL}`)
        icon.alt = ""
        link.prepend(icon)

        listItem.appendChild(link)
        frequentWebsitesList.appendChild(listItem)
    }
}

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
            <span class="moon-timeline-emoji">${PHASE_EMOJI[phase.name]}</span>
            <span class="moon-timeline-date">${label}</span>
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