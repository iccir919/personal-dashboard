
// Time section

export function getCurrentTime() {
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
