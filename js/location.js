import { saveToCache, loadFromCache } from "./cache.js"
import { getCurrentLocationWeatherProperties } from "./weather.js"
import { getMoonInformation } from "./moon.js"

// Current location section

export function getLocationFromLocalStorage() {
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
    document.body.classList.remove("needs-location")
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

export function updatePinnedLocation(location) {
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