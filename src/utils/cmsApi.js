// In dev: Vite proxies /api/cms → https://data.cms.gov/provider-data/api/1/datastore/query
// In prod: Vercel rewrites /api/cms → same destination (see vercel.json)
const BASE = '/api/cms';

function qs(obj) {
  return new URLSearchParams(obj).toString();
}

export async function fetchProviderInfo(ccn) {
  const params = qs({
    'conditions[0][property]': 'cms_certification_number_ccn',
    'conditions[0][value]': ccn,
    'conditions[0][operator]': '=',
    limit: 1,
  });
  const res = await fetch(`${BASE}/4pq5-n9py/0?${params}`);
  if (!res.ok) throw new Error(`CMS API error ${res.status}`);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`No facility found for CCN: ${ccn}`);
  return data.results[0];
}

export async function fetchClaimsMetrics(ccn) {
  const params = qs({
    'conditions[0][property]': 'cms_certification_number_ccn',
    'conditions[0][value]': ccn,
    'conditions[0][operator]': '=',
    limit: 20,
  });
  const res = await fetch(`${BASE}/ijh5-nb2v/0?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// CMS DKAN API doesn't support aggregate functions — compute averages client-side.
// National avg: sample 600 records (representative cross-section, ~4% of all NH).
// State avg: fetch up to 1000 records (covers any state exactly).
async function computeAvg(measureCode, state = null) {
  const obj = {
    'conditions[0][property]': 'measure_code',
    'conditions[0][value]': measureCode,
    'conditions[0][operator]': '=',
    limit: state ? 1000 : 600,
  };
  if (state) {
    obj['conditions[1][property]'] = 'state';
    obj['conditions[1][value]'] = state;
    obj['conditions[1][operator]'] = '=';
  }
  try {
    const res = await fetch(`${BASE}/ijh5-nb2v/0?${qs(obj)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const scores = (data.results || [])
      .map(r => parseFloat(r.adjusted_score))
      .filter(n => !isNaN(n));
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  } catch {
    return null;
  }
}

export async function fetchAllAverages(state) {
  const [nat521, st521, nat522, st522, nat551, st551, nat552, st552] = await Promise.all([
    computeAvg('521'),      computeAvg('521', state),
    computeAvg('522'),      computeAvg('522', state),
    computeAvg('551'),      computeAvg('551', state),
    computeAvg('552'),      computeAvg('552', state),
  ]);
  return { nat521, st521, nat522, st522, nat551, st551, nat552, st552 };
}
