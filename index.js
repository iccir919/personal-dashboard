

// Background image

function getRandomBackground() {
      document.body.style.backgroundImage = generateRandomLinearGradient();
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function generateRandomLinearGradient() {
    const color1 = getRandomColor();
    const color2 = getRandomColor();
    const linearGradient = `linear-gradient(to right, ${color1}, ${color2})`;
    const radialGradient = `radial-gradient(circle at center, ${color1} 0, ${color2} 100%)`
    return Math.random() < 0.5 ? linearGradient : radialGradient;
}

// Current location section


function getLocationFromLocalStorage() {
    const storedZipCode = localStorage.getItem("zipCode")

    if (storedZipCode) getZipCodeProperties(storedZipCode)
}

// Zip code form


document.getElementById("zip-code-form").addEventListener("submit", handleZipCodeInput)

function handleZipCodeInput(e) {
    e.preventDefault()
    
    const zipCodeInput = document.getElementById("zipcode-input")
    const zipCode = zipCodeInput.value
    zipCode.value = ""
    getZipCodeProperties(zipCode)
}

function getZipCodeProperties(zipCode) {
    const currentLocationResultDiv = document.getElementById("current-location-result")
    currentLocationResultDiv.innerHTML = "<p>Loading location...</p>";

    fetch(`https://api.zippopotam.us/us/${zipCode}`)
        .then(res => {

            if(!res.ok) {
                if (res.status === 404) {
                    throw new Error(`Zip code ${zipCode} not found`)
                } else {
                    throw new Error(`Error: ${res.status}`)
                }
            }

            return res.json()
        })
        .then(data => {
            const zipCode = data["post code"]
            localStorage.setItem("zipCode", zipCode)
            document.getElementById("zipcode-input").placeholder = zipCode

            document.getElementById("current-location-heading").textContent = "Current Location:"
            const place = data.places[0]
            currentLocationResultDiv.innerHTML = `<h2>${place["place name"]}, ${place["state abbreviation"]}</h2>`

            const { longitude, latitude }  = place

            getCurrentLocationWeatherProperties(latitude, longitude)
            document.getElementById("weather-section").style.display = "block"
            getMoonInformation(latitude, longitude)
            document.getElementById("moon-section").style.display = "flex"
        })
        .catch(err => {
            currentLocationResultDiv.innerHTML = `<p>${err.message}</p>`
        })
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

function getCurrentLocationWeatherProperties(latitude, longitude) {
    let forecastTimeOfDay = "day"

    fetch(`https://api.weather.gov/points/${latitude},${longitude}`)
        .then(res => res.json())
        .then(data => {
            const forecastUrl = data.properties.forecast
            get7DayWeatherForecast(forecastUrl, forecastTimeOfDay)    
            
            const forecastTimeRadios = document.querySelectorAll("input[name='forecast-time']")

            forecastTimeRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    if (radio.checked) forecastTimeOfDay = radio.value
                    get7DayWeatherForecast(forecastUrl, forecastTimeOfDay)
                })
            })
        })
}

function get7DayWeatherForecast(forecastUrl, forecastTimeOfDay) {

    fetch(forecastUrl)
        .then(res => res.json())
        .then(data => {
            render7DayWeatherForecast(data.properties, forecastTimeOfDay)
        })

}

function render7DayWeatherForecast(forecast, forecastTimeOfDay) {
    const forecastGenerationDatetime = new Date(forecast.generatedAt)

    document.getElementById("weather-last-updated").innerText = `
        Forecast generated: ${forecastGenerationDatetime.toLocaleDateString()} at ${forecastGenerationDatetime.toLocaleTimeString()}
    `

    const [current, ...rest] = forecast.periods
    const displayedForecast = [...rest.filter(period => forecastTimeOfDay === "day" ? period.isDaytime : !period.isDaytime )]
    if (forecastTimeOfDay === "night") displayedForecast.pop()

    document.getElementById("current-forecast-container").innerHTML = renderWeatherPeriod(current)

    document.getElementById("future-forecast-container").innerHTML = displayedForecast.map(period => renderWeatherPeriod(period)).join('')

    function renderWeatherPeriod(period) {
        return `
            <div class="weather-period-container">
                <img class="weather-period-icon" src="${period.icon}" />
                <h4 class="weather-period-name">${period.name}</h4>
                <p class="weather-period-temperature-text">${period.temperature}</p>
            </div>
        `
    }

    const forecastTimeRadios = document.querySelectorAll("input[name='forecast-time']")

    forecastTimeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) forecastTimePeriod = radio.value
        })
    })
    
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

    chrome.history.search({ text: "",  maxResults: 500, startTime: sevenDaysAgo.getTime() }, getMostVistedSites)
}

function getMostVistedSites(history) {
    const websiteVisitCounts = {}

    history.forEach(siteVisit => {
        const website = new URL(siteVisit.url).hostname

        websiteVisitCounts[website] = (websiteVisitCounts[website] || 0) + 1
    })

    const websiteVisitsSorted = Object.entries(websiteVisitCounts)
        .sort(([, countA], [, countB] ) => countB - countA)

    const top10VisitedWebsites = websiteVisitsSorted.slice(0, 10);

    renderMostVisitedSites(top10VisitedWebsites)
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
        listItem.appendChild(link)
        frequentWebsitesList.appendChild(listItem)
    }
}

// Moon phase

function getMoonInformation(latitude, longitude) {
    const illuminationSpan = document.getElementById("illumination")
    const currentPhaseSpan = document.getElementById("current-phase")

    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const day = today.getDate()
    const formattedDate = `${year}-${month}-${day}`

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
            console.log(moonData)
            
            // fracillum is a percentage (0-100), so we divide by 100 to get a 0-1 fraction for calculations
            const fracIllumInt = parseInt(moonData.fracillum)
            const fracIllum = fracIllumInt / 100
            const curPhase = moonData.curphase

            illuminationSpan.textContent = moonData.fracillum
            currentPhaseSpan.textContent = curPhase

            updateMoonPhase(fracIllum, curPhase)

        })
        .catch(err => {
            console.error("Error fetching moon data", err)
            illuminationSpan.textContent = "Error loading data"
            currentPhaseSpan.textContent = "N/A"
        })
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
    getBrowsingHistory()
    getRandomBackground()
    getCurrentTime()
}

initDashboard()



