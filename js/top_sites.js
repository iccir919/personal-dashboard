import { saveToCache, loadFromCache } from "./cache.js"
// Most frequently visited websites

// Shown on the live demo, where a web page can't read browsing history
const DEMO_HISTORY = [
    { url: "https://github.com/iccir919", title: "GitHub", visitCount: 42 },
    { url: "https://developer.mozilla.org/en-US/", title: "MDN Web Docs", visitCount: 35 },
    { url: "https://scrimba.com/", title: "Scrimba", visitCount: 28 },
    { url: "https://stackoverflow.com/", title: "Stack Overflow", visitCount: 21 },
    { url: "https://www.youtube.com/", title: "YouTube", visitCount: 18 },
    { url: "https://news.ycombinator.com/", title: "Hacker News", visitCount: 12 },
    { url: "https://www.weather.gov/", title: "National Weather Service", visitCount: 9 },
    { url: "https://en.wikipedia.org/", title: "Wikipedia", visitCount: 7 }
]

// True inside the extension, false on a normal web page
const isExtension = Boolean(globalThis.chrome?.history)

export function getBrowsingHistory() {
    if (!isExtension) {
        getMostVisitedSites(DEMO_HISTORY)
        return
    }

    const today = new Date()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 7)

    chrome.history.search({ text: "", maxResults: 500, startTime: sevenDaysAgo.getTime() }, getMostVisitedSites)
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
    // The demo can't use the extension's favicon service, so it uses Google's instead
    if (!isExtension) {
        const host = new URL(pageUrl).host
        return `https://icons.duckduckgo.com/ip3/${host}.ico`
    }

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