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

function getZipCodeProperties(zipCode) {
    const currentLocationResultDiv = document.getElementById("current-location-result")
    currentLocationResultDiv.innerHTML = "<p>Loading location...</p>"

    fetch(`https://api.zippopotam.us/us/${zipCode}`)
        .then(res => {
            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error(`Zip code ${zipCode} not found`)
                } else {
                    throw new Error(`Error: ${res.status}`)
                }
            }
            return res.json()
        })
        .then(data => {
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
        })
        .catch(err => {
            currentLocationResultDiv.innerHTML = `<p>${err.message}</p>`
        })
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

// Shared weather state. The Day/Night toggle and the ZIP form both read
// and update these, so there is only ever one "current" forecast.
let currentForecastUrl = null
let forecastTimeOfDay = "day"
let currentForecast = null
const FORECAST_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

// Runs once at startup. The toggle just re-draws the saved forecast, no fetch needed.
function setupForecastTimeToggle() {
    const forecastTimeRadios = document.querySelectorAll("input[name='forecast-time']")

    forecastTimeRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            forecastTimeOfDay = radio.value
            if (currentForecast) render7DayWeatherForecast(currentForecast, forecastTimeOfDay)
        })
    })
}

function showWeatherError(err) {
    console.error("Error loading weather", err)

    document.getElementById("current-forecast-container").innerHTML =
        "<p>Couldn't load the weather right now. Try a new tab in a few minutes.</p>"
    
    document.getElementById("future-forecast-container").innerHTML = ""
    document.getElementById("future-forecast-heading").style.display = "none"

    document.getElementById("weather-last-updated").innerText = ""
}

function getCurrentLocationWeatherProperties(location) {
    // Already know this location's forecast area? Skip the lookup.
    if (location.forecastUrl) {
        currentForecastUrl = location.forecastUrl
        get7DayWeatherForecast(currentForecastUrl)
        return
    }

    fetch(`https://api.weather.gov/points/${location.latitude},${location.longitude}`)
        .then(res => {
            if (!res.ok) throw new Error(`Couldn't look up the forecast area for this location (status ${res.status})`)
            return res.json()
        })
        .then(data => {
            currentForecastUrl = data.properties.forecast

            // Save it with the location so next time we can skip the lookup
            location.forecastUrl = currentForecastUrl
            saveToCache("location", location)

            get7DayWeatherForecast(currentForecastUrl)
        })
        .catch(err => showWeatherError(err))
}

function get7DayWeatherForecast(forecastUrl) {
    // Use the saved forecast if it's recent and for this same location
    const savedForecast = loadFromCache("forecast", FORECAST_MAX_AGE_MS)
    if (savedForecast && savedForecast.forecastUrl === forecastUrl) {
        currentForecast = savedForecast.properties
        render7DayWeatherForecast(currentForecast, forecastTimeOfDay)
        return
    }

    fetch(forecastUrl)
        .then(res => {
            if (!res.ok) throw new Error(`Couldn't load the forecast (status ${res.status})`)
            return res.json()
        })
        .then(data => {
            // If the ZIP changed while this request was in flight, a newer
            // forecast is on its way. Skip this old one so it can't overwrite it.
            if (forecastUrl !== currentForecastUrl) return

            currentForecast = data.properties
            saveToCache("forecast", { forecastUrl, properties: data.properties })
            render7DayWeatherForecast(currentForecast, forecastTimeOfDay)
        })
        .catch(err => {
            if (forecastUrl === currentForecastUrl) showWeatherError(err)
        })
}

function render7DayWeatherForecast(forecast, forecastTimeOfDay) {
    const forecastGenerationDatetime = new Date(forecast.generatedAt)

    document.getElementById("weather-last-updated").innerText = `Forecast generated: ${forecastGenerationDatetime.toLocaleDateString()} at ${forecastGenerationDatetime.toLocaleTimeString()}`

    const [current, ...rest] = forecast.periods
    const displayedForecast = rest
        .filter(period => forecastTimeOfDay === "day" ? period.isDaytime : !period.isDaytime)
        .slice(0, 6) // Limit to 6 future periods

    document.getElementById("current-forecast-container").innerHTML = renderWeatherPeriod(current)

    document.getElementById("future-forecast-heading").style.display = ""
    document.getElementById("future-forecast-heading").innerText = forecastTimeOfDay === "day" ? "Next 6 Days" : "Next 6 Nights"
    document.getElementById("future-forecast-container").innerHTML = displayedForecast.map(period => renderWeatherPeriod(period)).join('')

    function renderWeatherPeriod(period) {
        return `
            <div class="weather-period-container">
                <img class="weather-period-icon" src="${period.icon}" />
                <h4 class="weather-period-name">${period.name}</h4>
                <p class="weather-period-temperature-text">${period.temperature}°${period.temperatureUnit}</p>
            </div>
        `
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

function getMoonInformation(latitude, longitude) {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const day = today.getDate()
    const formattedDate = `${year}-${month}-${day}`

    // The moon only changes once a day, so reuse today's data if we have it
    const savedMoon = loadFromCache("moon")
    if (savedMoon && savedMoon.date === formattedDate) {
        showMoon(savedMoon.moonData)
        return
    }

    const moonIlluminationUrl = `https://aa.usno.navy.mil/api/rstt/oneday?date=${formattedDate}&coords=${latitude},${longitude}`

    fetch(moonIlluminationUrl)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! Response status: ${res.status}`)
            }
            return res.json()
        })
        .then(json => {
            const moonData = json.properties.data
            saveToCache("moon", { date: formattedDate, moonData })
            showMoon(moonData)
        })
        .catch(err => {
            console.error("Error fetching moon data", err)
            document.getElementById("illumination").textContent = "Error loading data"
            document.getElementById("current-phase").textContent = "N/A"
        })
}

function showMoon(moonData) {
    // fracillum is a percentage string like "92%", so parseInt gives 92 and we divide by 100 to get 0.92
    const fracIllum = parseInt(moonData.fracillum) / 100
    const curPhase = moonData.curphase

    document.getElementById("illumination").textContent = moonData.fracillum
    document.getElementById("current-phase").textContent = curPhase

    updateMoonPhase(fracIllum, curPhase)
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
    setupForecastTimeToggle()
    getLocationFromLocalStorage()
    getBrowsingHistory()
    getRandomBackground()
    getCurrentTime()
}

initDashboard()