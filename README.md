<div align="center">
  <img src="public/infinite-logo.png" alt="INFINITE — Managed by MEDELITE" width="240" />

  <h2>Facility Assessment Report Generator</h2>

  <p>Type a nursing home's ID number. Get a complete, data-rich report in seconds.</p>

  <a href="https://medelite-assessment-khaki.vercel.app">
    <img src="https://img.shields.io/badge/Live%20Demo-Open%20App-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>

  <br /><br />

  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Deployed-Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
  <img src="https://img.shields.io/badge/Data-CMS%20Provider%20API-005EA2?style=flat-square" />

</div>

---

## What This Does

Before a Medelite director reaches out to a nursing home, they need to know the facility inside and out — star ratings, hospitalization rates, how it compares to state and national benchmarks. Right now, that means digging through several government databases and copying numbers into a Word doc by hand.

This tool replaces that process entirely. Enter the facility's 6-digit government ID (CCN) and within a few seconds you have a fully-formatted **Facility Assessment Snapshot** — pulled live from the CMS database, ready to download as a PDF or Word doc.

---

## Features

### Core Functionality
- **CCN Lookup** — fetches live data for any of the 14,700+ US nursing homes by their CMS Certification Number
- **Auto-populated fields** — facility name, full address, bed count, and all 4 CMS star ratings load instantly
- **Manual operational inputs** — 7 internal fields (EMR system, current census, patient type, Medelite coverage history, etc.)
- **Facility name override** — use Medelite's internal name without touching the INFINITE brand header
- **PDF export** — polished, print-ready document with the INFINITE brand logo, state code, and a live Medicare hyperlink
- **Word (.docx) export** — same layout, fully editable

### Bonus Features (All 3 Implemented)
- **All 12 hospitalization/ED metrics** — short-stay and long-stay rates for hospitalizations and ED visits, each with the facility's score plus state and national averages computed in real time
- **Word document export** — branded .docx matching the PDF layout
- **Advanced error handling** — clean messages for invalid CCNs, missing API data, network failures

---

## How It Works

```
User types a CCN (e.g. 686123)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│                  Two parallel API calls                  │
│                                                          │
│  CMS Provider Dataset (4pq5-n9py)                        │
│  → Name, address, beds, star ratings                     │
│                                                          │
│  CMS Claims Dataset (ijh5-nb2v)                          │
│  → STR/LT hospitalization & ED visit rates               │
└─────────────────────────────────────────────────────────┘
        │
        ▼
  Report preview renders immediately
        │
        ▼  (in background — ~2–3 seconds)
┌─────────────────────────────────────────────────────────┐
│  8 parallel average computations                         │
│  (4 measures × national + state)                         │
│  → Fetch raw records, average in JS                      │
│  → State + national benchmarks fill in automatically     │
└─────────────────────────────────────────────────────────┘
        │
        ▼
  User fills in manual fields
        │
        ▼
  Download PDF  or  Download Word (.docx)
```

> All API calls go through a server-side proxy (Vite in dev, Vercel rewrites in production) — the CMS government API has no CORS headers, so the browser never contacts `data.cms.gov` directly.

---

## Quick Start — Try It Now

**Live:** [medelite-assessment-khaki.vercel.app](https://medelite-assessment-khaki.vercel.app)

Enter CCN **`686123`** to test with Kendall Lakes Healthcare and Rehab Center (Miami, FL) — the reference facility from the case materials.

---

## Data Mapping

Every field in the report and where it comes from:

| Report Field | Source | API Field / Notes |
|---|---|---|
| Name of Facility | CMS API (overridable) | `provider_name` |
| Location | CMS API | `provider_address`, `citytown`, `state`, `zip_code` |
| Census Capacity | CMS API | `number_of_certified_beds` |
| EMR | Manual input | e.g. "PCC", "MatrixCare" |
| Current Census | Manual input | numeric |
| Type of Patient | Manual input | e.g. "Long-term & Short-term" |
| Previous Coverage from Medelite | Manual dropdown | Yes / No |
| Previous Provider Performance | Manual input | e.g. "About 30 patients/day" |
| Medical Coverage | Manual input | e.g. "Optometry, PCP, Podiatry" |
| Overall Star Rating | CMS API | `overall_rating` |
| Health Inspection | CMS API | `health_inspection_rating` |
| Staffing | CMS API | `staffing_rating` |
| Quality of Resident Care | CMS API | `qm_rating` |
| Short Term Hospitalization | CMS Claims `ijh5-nb2v` | measure `521` → `adjusted_score` |
| STR ED Visit | CMS Claims `ijh5-nb2v` | measure `522` → `adjusted_score` |
| LT Hospitalization | CMS Claims `ijh5-nb2v` | measure `551` → `adjusted_score` |
| ED Visit (LT) | CMS Claims `ijh5-nb2v` | measure `552` → `adjusted_score` |
| State & National Averages | CMS Claims `ijh5-nb2v` | computed client-side (see below) |

---

## Engineering Decisions

### Problem: The CMS API blocks browser requests (CORS)

`data.cms.gov` is a public government database but it doesn't include `Access-Control-Allow-Origin` headers, which means every direct browser fetch is blocked by the browser's security policy.

**Solution:** Route all API calls through a server-side proxy.

- In **development**: Vite's dev server acts as the proxy (`/api/cms/*` → CMS API)
- In **production**: Vercel's edge network rewrites the requests (configured in `vercel.json`)

The browser always calls `/api/cms/...` — same origin, no CORS issue. The actual CMS fetch happens server-side.

```json
// vercel.json
{
  "rewrites": [
    { "source": "/api/cms/:path*", "destination": "https://data.cms.gov/provider-data/api/1/datastore/query/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

### Problem: The CMS API doesn't support averaging

The CMS DKAN API completely ignores `GROUP BY` and `AVG()` aggregate parameters — it returns the first row's data as if no aggregation was requested.

**Solution:** Fetch raw records and compute averages in JavaScript.

- **State average** — fetch all records for that state + measure code, average the `adjusted_score`. Exact, covers any US state.
- **National average** — fetch 600 records (a ~4% cross-section of all 14,700 facilities) and average them. Statistically representative for benchmarking.

These 8 requests (4 measures × national + state) run in parallel after the main data loads, so the user sees the report immediately and the benchmarks fill in within a few seconds.

---

### Why live data won't match the reference PDF

The sample file in the case materials (Kendall Lakes, CCN `686123`) was generated from older CMS data. CMS updates its database monthly. The live API returns current values — star ratings and metrics have changed since the reference was made. This is by design: the app always shows the most current data available.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + Vite 8 | Fast dev server, modern build pipeline |
| Styling | Tailwind CSS v4 | Utility-first, responsive without any CSS files |
| PDF Export | jsPDF + jspdf-autotable | Client-side, no server required |
| Word Export | docx + file-saver | Generates real .docx (not HTML-renamed) |
| Hosting & Proxy | Vercel | Edge rewrites solve the CORS problem in production |
| Data | CMS Provider Data Catalog | Public US government nursing home database |

---

## Run Locally

```bash
git clone https://github.com/SriramLakumarapu/medelite-facility-assessment.git
cd medelite-facility-assessment
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and test with CCN **`686123`**.

The Vite dev server automatically proxies `/api/cms/*` to the CMS API, so no environment variables or API keys are needed — the CMS database is fully public.

---

## Deploy Your Own

```bash
npm install -g vercel
vercel --prod
```

The `vercel.json` rewrite rules handle both the CORS proxy and React SPA routing automatically.

---

<div align="center">
  <sub>Built for the Medelite Healthcare Data Automation & QA Analytics internship assessment · June 2026</sub>
</div>
