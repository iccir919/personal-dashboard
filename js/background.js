import { loadFromCache } from "./cache.js"

// Background: random gradient, with colors that follow the time of day

const TIME_OF_DAY_COLORS = {
    // Hue ranges on the color wheel (0-360; numbers past 360 wrap around to reds, oranges, yellows)
    dawn:  { hues: [300, 420], lightness: 38 },  // magentas, pinks, corals, golds
    day:   { hues: [90, 260],  lightness: 36 },  // greens, teals, blues, indigo
    dusk:  { hues: [260, 410], lightness: 32 },  // purples, reds, oranges
    night: { hues: [200, 300], lightness: 22 }   // deep blues, indigo, purples
}

// Remember which time of day is showing, so we only repaint when it changes
let currentTimeOfDay = null

export function getRandomBackground() {
    const timeOfDay = getTimeOfDay()
    if (timeOfDay === currentTimeOfDay) return

    currentTimeOfDay = timeOfDay
    document.body.style.backgroundImage = generateGradient(timeOfDay)
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