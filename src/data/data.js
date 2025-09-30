// Simple PRNG (xorshift32) I found from docs/examples
export function createPrng(seed) {
  let state = seed >>> 0; // force to unsigned

  return function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    // divide by 2^32 to get 0..1
    return (state >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Sanket", "Ankit", "Aditya", "Rajat", "Arjun",
  "Sai", "Shreyas", "Mohammad", "Pranav", "Krishna",
  "Shriya", "Ananya", "Diya", "Aadhya", "Pari",
  "Sara", "Aarohi", "Anika", "Navya", "Meera",
];

const SURNAMES = [
  "Dhuri", "Verma", "Gupta", "Patel", "Kumar",
  "Singh", "Karve", "Nair", "Jha", "Mishra",
  "Agarwal", "Bose", "Chopra", "Dutta", "Iyengar",
  "Jain", "Kapoor", "Lal", "Malhotra", "Pillai",
];

const ADDED_BY = [
  "Kartikey Mishra", "Aishwarya Rao", "Rohan Mehta", "Kavya Iyer",
  "Ankur Jain", "Nisha Verma", "Arvind Menon", "Deepa Nair",
  "Pooja Patel", "Aman Gupta",
];

const AVATARS = [
  "/public/test_user-3 3.svg",
  "/public/test_Search-3.svg",
  "/public/test_Filter.svg",
  "/public/vite.svg",
];

export function generateCustomers(total = 1_000_000, seed = 12345) {
  const rand = createPrng(seed);
  const customers = [];
  const now = Date.now();

  for (let i = 0; i < total; i++) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = SURNAMES[Math.floor(rand() * SURNAMES.length)];
    const fullName = `${first} ${last}`;

    const score = Math.floor(rand() * 100) + 1;
    const phoneNumber = "+91" + (1000000000 + Math.floor(rand() * 9999999999));

    const emailUser = `${first}.${last}${Math.floor(rand() * 1000)}`.toLowerCase();
    const email = `${emailUser}@gmail.com`;

    const daysAgo = Math.floor(rand() * 365);
    const minutesAgo = Math.floor(rand() * (24 * 60));
    const lastMessageAt = new Date(
      now - daysAgo * 86400000 - minutesAgo * 60000
    ).toISOString();

    const addedBy = ADDED_BY[Math.floor(rand() * ADDED_BY.length)];
    const avatar = AVATARS[Math.floor(rand() * AVATARS.length)];

    customers.push({
      id: i + 1,
      name: fullName,
      phone: phoneNumber,
      email,
      score,
      lastMessageAt,
      addedBy,
      avatar,
      searchIndex: `${fullName}|${email}|${phoneNumber}`.toLowerCase(),
    });
  }

  return customers;
}

export function chunkedFilter(list, checkFn, opts) {
  const chunkSize = opts?.chunkSize ?? 50000;
  const frameBudget = opts?.frameBudgetMs ?? 12;

  return new Promise((resolve) => {
    const result = [];
    let index = 0;

    function step() {
      const start = performance.now();
      let count = 0;

      while (index < list.length && count < chunkSize) {
        const item = list[index];
        if (checkFn(item)) {
          result.push(item);
        }
        index++;
        count++;

        if (performance.now() - start > frameBudget) {
          break; // give control back
        }
      }

      if (index < list.length) {
        setTimeout(step, 0);
      } else {
        resolve(result);
      }
    }

    step();
  });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
