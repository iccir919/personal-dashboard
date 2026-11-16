import { getRandomBackground } from "./background.js"
import { getCurrentTime } from "./clock.js"
import { getBrowsingHistory } from "./top_sites.js"
import { getMoonPhases } from "./moon.js"
import { getLocationFromLocalStorage } from "./location.js"

// Initialization

function initDashboard() {
    getLocationFromLocalStorage()
    getMoonPhases()
    getBrowsingHistory()
    getRandomBackground()
    getCurrentTime()
}

initDashboard()