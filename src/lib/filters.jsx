// Returns { from: Date|null, to: Date|null } for a given preset.
// null/null means "all time" (no filtering).
export function presetToRange(preset, customFrom, customTo) {
  const now = new Date()
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const endOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  switch (preset) {
    case 'today': {
      const s = startOfDay(now)
      return { from: s, to: endOfDay(now) }
    }
    case '7d': {
      const from = new Date(now.getTime() - 6 * 86400000)
      return { from: startOfDay(from), to: endOfDay(now) }
    }
    case '30d': {
      const from = new Date(now.getTime() - 29 * 86400000)
      return { from: startOfDay(from), to: endOfDay(now) }
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from, to: endOfDay(now) }
    }
    case 'custom': {
      const from = customFrom ? startOfDay(new Date(customFrom)) : null
      const to = customTo ? endOfDay(new Date(customTo)) : null
      return { from, to }
    }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

export function inRange(dateStr, range) {
  if (!range || (!range.from && !range.to)) return true
  const d = new Date(dateStr)
  if (range.from && d < range.from) return false
  if (range.to && d > range.to) return false
  return true
}

export function DateFilterBar({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={preset} onChange={e => setPreset(e.target.value)}>
        <option value="all">All time</option>
        <option value="today">Today</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="month">This month</option>
        <option value="custom">Custom range</option>
      </select>
      {preset === 'custom' && (
        <>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          <span style={{ fontSize: 12, color: '#888' }}>to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
        </>
      )}
    </div>
  )
}
