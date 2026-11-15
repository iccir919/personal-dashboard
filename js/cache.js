// Cache helpers: save data to localStorage with the time it was saved,
// and load it back (or null if it's missing, broken, or too old)

export function saveToCache(key, value) {
    const entry = { savedAt: Date.now(), value }
    localStorage.setItem(key, JSON.stringify(entry))
}

export function loadFromCache(key, maxAgeMs) {
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