// Utilities for generating and working with a large in-memory dataset of customers

/**
 * Returns a deterministic pseudo-random number generator seeded by an integer.
 * This avoids heavy deps and keeps the dataset stable across refreshes.
 */
export function createPrng(seed) {
  let state = seed >>> 0;
  return function next() {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    // Convert to [0,1)
    return (state >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Mohammad', 'Kabir', 'Krishna',
  'Isha', 'Ananya', 'Diya', 'Aadhya', 'Pari', 'Sara', 'Aarohi', 'Anika', 'Navya', 'Meera',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Nair', 'Das', 'Mishra',
  'Agarwal', 'Bose', 'Chopra', 'Dutta', 'Iyengar', 'Jain', 'Kapoor', 'Lal', 'Malhotra', 'Pillai',
];

const ADDED_BY = [
  'Kartikey Mishra', 'Aishwarya Rao', 'Rohan Mehta', 'Kavya Iyer', 'Ankur Jain', 'Nisha Verma',
  'Arvind Menon', 'Deepa Nair', 'Pooja Patel', 'Aman Gupta',
];

const AVATARS = [
  '/public/test_user-3 3.svg',
  '/public/test_Search-3.svg',
  '/public/test_Filter.svg',
  '/public/vite.svg',
];

/**
 * Generates an array of customer objects of the specified size. Designed to be fast and memory-friendly.
 * Each record also carries a `searchIndex` which is a lower-cased composite string for quick includes() checks.
 */
export function generateCustomers(count = 1_000_000, seed = 12345) {
  const rand = createPrng(seed);
  const customers = new Array(count);
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[(rand() * FIRST_NAMES.length) | 0];
    const last = LAST_NAMES[(rand() * LAST_NAMES.length) | 0];
    const fullName = `${first} ${last}`;
    const score = 1 + ((rand() * 100) | 0);
    const phone = `+91${String(7000000000 + ((rand() * 2999999999) | 0))}`;
    const emailLocal = `${first}.${last}${(rand() * 999) | 0}`.toLowerCase();
    const email = `${emailLocal}@gmail.com`;
    const daysAgo = (rand() * 365) | 0;
    const minutes = (rand() * (24 * 60)) | 0;
    const lastMessageAt = new Date(now - (daysAgo * 86400000 + minutes * 60000)).toISOString();
    const addedBy = ADDED_BY[(rand() * ADDED_BY.length) | 0];
    const avatar = AVATARS[(rand() * AVATARS.length) | 0];

    const record = {
      id: i + 1,
      name: fullName,
      phone,
      email,
      score,
      lastMessageAt,
      addedBy,
      avatar,
    };
    // Precompute a search index for quick case-insensitive contains checks
    record.searchIndex = `${fullName}|${email}|${phone}`.toLowerCase();
    customers[i] = record;
  }

  return customers;
}

/**
 * Chunked filter over a large array to avoid long main-thread blocks.
 * Processes the input array in time-sliced chunks and resolves with matches.
 */
export function chunkedFilter(sourceArray, predicate, options) {
  const {
    chunkSize = 50000,
    frameBudgetMs = 12, // try to keep well under a frame (~16ms)
  } = options || {};

  return new Promise((resolve) => {
    const result = [];
    let index = 0;

    function step() {
      const start = performance.now();
      let processed = 0;
      while (index < sourceArray.length && processed < chunkSize) {
        const item = sourceArray[index++];
        if (predicate(item)) result.push(item);
        processed++;
        if (performance.now() - start > frameBudgetMs) break;
      }
      if (index < sourceArray.length) {
        setTimeout(step, 0);
      } else {
        resolve(result);
      }
    }
    step();
  });
}

export function formatDateTime(isoString) {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(d);
}


