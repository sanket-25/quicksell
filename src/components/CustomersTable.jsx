import { useEffect, useMemo, useRef, useState } from 'react'
import { chunkedFilter, formatDateTime, generateCustomers } from '../data/data.js'
import './customers.css'

const PAGE_SIZE = 30
const TOTAL_RECORDS = 1_000_000

// Custom hook to debounce a value
function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export default function CustomersTable() {
  const [allData] = useState(() => generateCustomers(TOTAL_RECORDS))
  const [visibleData, setVisibleData] = useState(() => allData.slice(0, PAGE_SIZE * 2))
  const [loadedRows, setLoadedRows] = useState(PAGE_SIZE * 2)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 250)

  const [sortState, setSortState] = useState({ key: 'name', dir: 'asc' })

  const containerRef = useRef(null)
  const sentinelRef = useRef(null) // Used for Intersection Observer

  // --- Search and Data Visibility Management ---
  useEffect(() => {
    let cancelled = false

    async function updateVisibleData() {
      const q = debouncedQuery.toLowerCase().trim()
      let dataToDisplay

      if (!q) {
        // No query: show initial data up to loadedRows
        dataToDisplay = allData
      } else {
        // Query exists: perform chunked filtering
        const matches = await chunkedFilter(allData, (item) => item.searchIndex.includes(q), { chunkSize: 50000 })
        if (cancelled) return
        dataToDisplay = matches
      }

      // Update the visible data, respecting the current loadedRows count
      setVisibleData(dataToDisplay.slice(0, loadedRows))
    }

    updateVisibleData()

    return () => { cancelled = true }
  }, [debouncedQuery, allData, loadedRows])


  // --- Sorting Logic ---
  const sortedData = useMemo(() => {
    // Only sort the currently visible data array
    const arr = visibleData.slice()
    const { key, dir } = sortState
    const factor = dir === 'asc' ? 1 : -1

    arr.sort((a, b) => {
      let valA = a[key]
      let valB = b[key]

      // Handle date comparison for 'lastMessageAt'
      if (key === 'lastMessageAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime()
      }

      // Ensure case-insensitive string comparison
      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return -1 * factor
      if (valA > valB) return 1 * factor
      return 0
    })
    return arr
  }, [visibleData, sortState])


  // --- Infinite Scroll with Intersection Observer ---
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && loadedRows < TOTAL_RECORDS && loadedRows < visibleData.length) {
        // The sentinel is visible and there are more rows to load in the current filtered/full dataset
        setLoadedRows((prev) => Math.min(prev + PAGE_SIZE, TOTAL_RECORDS))
      }
    }, {
      root: containerRef.current, // Observe relative to the scrollable table container
      rootMargin: '0px 0px 200px 0px', // Start observing 200px before the sentinel is visible
      threshold: 0,
    })

    observer.observe(sentinel)

    return () => {
      if (sentinel) observer.unobserve(sentinel)
    }
  }, [loadedRows, visibleData.length])


  // --- Helper Functions ---
  function toggleSort(key) {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'asc' } // Default to ascending when changing columns
    })
  }

  function SortHeader({ columnKey, children, width }) {
    const active = sortState.key === columnKey
    return (
      <th style={{ width }}>
        <button className={`th-btn ${active ? 'active' : ''}`} onClick={() => toggleSort(columnKey)}>
          <span>{children}</span>
          <span className="sort-caret">{active ? (sortState.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    )
  }

  // Determine the number of rows to actually render
  const rowsToRender = sortedData.slice(0, loadedRows)
  const dataCount = debouncedQuery ? visibleData.length : allData.length

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <img src="/public/Doubletick Logo.png" alt="DoubleTick" />
          <span>DoubleTick</span>
        </div>
      </header>

      <div className="content">
        <div className="title-row">
          <div className="title">All Customers <span className="badge">{dataCount.toLocaleString()}</span></div>
        </div>

        <div className="controls">
          <div className="search">
            <span className="icon">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Customers"
            />
          </div>
          <div className="filters">
            <button className="filter-btn">Add Filters ▾</button>
            <div className="filter-menu">
              <div>Filter 1</div>
              <div>Filter 2</div>
              <div>Filter 3</div>
              <div>Filter 4</div>
            </div>
          </div>
        </div>

        <div className="table-container" ref={containerRef}>
          <table className="customers-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <SortHeader columnKey="name" width={360}>Customer</SortHeader>
                <SortHeader columnKey="score" width={80}>Score</SortHeader>
                <SortHeader columnKey="email" width={260}>Email</SortHeader>
                <SortHeader columnKey="lastMessageAt" width={220}>Last message sent at</SortHeader>
                <SortHeader columnKey="addedBy" width={180}>Added by</SortHeader>
              </tr>
            </thead>
            <tbody>
              {/* Render only the currently loaded and sorted rows */}
              {rowsToRender.map((c) => (
                <tr key={c.id} className="row">
                  <td><input type="checkbox" /></td>
                  <td>
                    <div className="cell-customer">
                      <img className="avatar" src="/public/profile.webp" alt="avatar" />
                      <div className="customer-texts">
                        <div className="name">{c.name}</div>
                        <div className="phone">{c.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td>{c.score}</td>
                  <td>{c.email}</td>
                  <td>{formatDateTime(c.lastMessageAt)}</td>
                  <td className="added-by">
                    <img className="avatar" src="/public/addedBy.svg" alt="avatar" />
                    {c.addedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Sentinel for Intersection Observer to trigger next load */}
          {loadedRows < dataCount && (
            <div ref={sentinelRef} className="loading-sentinel">
              Loading more customers...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}