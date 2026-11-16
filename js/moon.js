import { saveToCache, loadFromCache } from "./cache.js"


// Moon phase

export async function getMoonInformation(latitude, longitude) {
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

export async function getMoonPhases() {
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