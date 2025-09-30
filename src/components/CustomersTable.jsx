// all imports here
import { useEffect, useMemo, useRef, useState } from 'react'
import { chunkedFilter, formatDateTime, generateCustomers } from '../data/data.js'
import './customers.css'


// pagination of 30 items at a time
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
  const [loadedRows, setLoadedRows] = useState(PAGE_SIZE * 2)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 250)

  const [sortState, setSortState] = useState({ key: 'name', dir: 'asc' })

  const containerRef = useRef(null)
  const sentinelRef = useRef(null)


  // update pagination on scroll
  useEffect(() => {
    let cancelled = false

    async function updateVisibleData() {
      const q = debouncedQuery.toLowerCase().trim()
      let dataToDisplay

      if (!q) {
        dataToDisplay = allData
      } else {
        const matches = await chunkedFilter(
          allData,
          (item) => item.searchIndex.includes(q),
          { chunkSize: 50000 }
        )
        if (cancelled) return
        dataToDisplay = matches
      }

      setLoadedRows(PAGE_SIZE * 2)
      setVisibleData(dataToDisplay)
    }

    updateVisibleData()
    return () => { cancelled = true }
  }, [debouncedQuery, allData])


  // sorting the data (ascending, descending)
  const sortedData = useMemo(() => {
    const arr = visibleData.slice()
    const { key, dir } = sortState
    const factor = dir === 'asc' ? 1 : -1

    arr.sort((a, b) => {
      let valA = a[key]
      let valB = b[key]

      if (key === 'lastMessageAt') {
        valA = new Date(valA).getTime()
        valB = new Date(valB).getTime()
      }

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return -1 * factor
      if (valA > valB) return 1 * factor
      return 0
    })
    return arr
  }, [visibleData, sortState])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver((entries) => {
      const isIntersecting = entries[0]?.isIntersecting
      const hasMoreData = loadedRows < visibleData.length

      if (isIntersecting && hasMoreData) {
        setLoadedRows((prev) => Math.min(prev + PAGE_SIZE, visibleData.length))
      }
    }, {
      root: containerRef.current,
      // rootMargin: '0px 0px 200px 0px',
      threshold: 0,
    })

    observer.observe(sentinel)
    return () => {
      if (sentinel) observer.unobserve(sentinel)
    }
  }, [loadedRows, visibleData.length])

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
        <button
          className={`th-btn ${active ? 'active' : ''}`}
          onClick={() => toggleSort(columnKey)}
        >
          <span>{children}</span>
          <span className="sort-caret">
            {active ? (sortState.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  const rowsToRender = sortedData.slice(0, loadedRows)
  const dataCount = debouncedQuery ? visibleData.length : allData.length

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <img src="/public/logo.png" alt="DoubleTick" />
        </div>
      </header>

      <div className="content">
        <div className="title-row">
          <div className="title">
            All Customers <span className="badge">{dataCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="controls">
          <div className="search-wrapper">
            <div className="search">
              <img className="avatar" src="/public/search.svg" alt="avatar" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Customers"
              />
            </div>
          </div>
          <div className="filters">
            <button className="filter-btn">
              <img src="/public/filter.svg" alt="filter" className="filter-icon" />
              Add Filters
            </button>
            <div className="filter-menu">
              <div>Filter by Score</div>
              <div>Filter by Added By</div>
              <div>Filter by Last Message Date</div>
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

          {loadedRows < dataCount && (
            <div ref={sentinelRef} className="loading-sentinel">
              Loading more customers...
            </div>
          )}

          {dataCount === 0 && (
            <div className="loading-sentinel" style={{ border: 'none' }}>
              No customers match your search query.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
