import { useEffect, useMemo, useRef, useState } from 'react'
import { chunkedFilter, formatDateTime, generateCustomers } from '../data/data.js'
import './customers.css'

const PAGE_SIZE = 30
const TOTAL_RECORDS = 1_000_000

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
  const [loadedRows, setLoadedRows] = useState(visibleData.length)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 250)

  const [sortState, setSortState] = useState({ key: 'name', dir: 'asc' })

  const containerRef = useRef(null)
  const sentinelRef = useRef(null)

  // Apply search
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!debouncedQuery) {
        const base = allData.slice(0, Math.max(loadedRows, PAGE_SIZE * 2))
        setVisibleData(base)
        return
      }
      const q = debouncedQuery.toLowerCase().trim()
      const matches = await chunkedFilter(allData, (item) => item.searchIndex.includes(q))
      if (cancelled) return
      setVisibleData(matches.slice(0, Math.max(loadedRows, PAGE_SIZE * 2)))
    }
    run()
    return () => { cancelled = true }
  }, [debouncedQuery, allData, loadedRows])

  // Apply sort when sort changes or data set changes
  const sortedData = useMemo(() => {
    const arr = visibleData.slice()
    const { key, dir } = sortState
    const factor = dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      let aa = a[key]
      let bb = b[key]
      if (key === 'lastMessageAt') {
        aa = new Date(aa).getTime(); bb = new Date(bb).getTime()
      }
      if (typeof aa === 'string') aa = aa.toLowerCase()
      if (typeof bb === 'string') bb = bb.toLowerCase()
      if (aa < bb) return -1 * factor
      if (aa > bb) return 1 * factor
      return 0
    })
    return arr
  }, [visibleData, sortState])

  // Infinite scroll loader
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onScroll() {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 200
      if (nearBottom) {
        setLoadedRows((prev) => {
          const next = Math.min(prev + PAGE_SIZE, allData.length)
          return next
        })
      }
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [allData.length])

  useEffect(() => {
    if (!debouncedQuery) {
      setVisibleData(allData.slice(0, loadedRows))
    } else {
      const q = debouncedQuery.toLowerCase().trim()
      chunkedFilter(allData, (item) => item.searchIndex.includes(q), { chunkSize: 50000 }).then((matches) => {
        setVisibleData(matches.slice(0, loadedRows))
      })
    }
  }, [loadedRows, allData, debouncedQuery])

  function toggleSort(key) {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'asc' }
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
          <div className="title">All Customers <span className="badge">{allData.length.toLocaleString()}</span></div>
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
              {sortedData.slice(0, loadedRows).map((c) => (
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
          <div ref={sentinelRef} />
        </div>
      </div>
    </div>
  )
}




