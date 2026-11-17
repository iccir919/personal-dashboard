import { getRandomBackground } from "./background.js"
import { getCurrentTime } from "./clock.js"
import { getBrowsingHistory } from "./top_sites.js"
import { getMoonPhases } from "./moon.js"
import { getLocationFromLocalStorage } from "./location.js"

const REFRESH_INTERVAL_MS = 30 * 60 * 1000

// Initialization

function initDashboard() {
    refreshDashboard()
    getCurrentTime()
}

// Everything that can go stale while the tab stays open.
// The cache decides whether anything actually gets fetched.
function refreshDashboard() {
    getLocationFromLocalStorage()
    getMoonPhases()
    getBrowsingHistory()
    getRandomBackground()
}

// Coming back to the tab
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshDashboard()
})

// Tab left open and visible for a long time
setInterval(() => {
    if (document.visibilityState === "visible") refreshDashboard()
}, REFRESH_INTERVAL_MS)

initDashboard()