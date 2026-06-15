import { useState } from 'react';
import { fetchProviderInfo, fetchClaimsMetrics, fetchAllAverages } from './utils/cmsApi';
import { generatePDF } from './utils/pdfExport';
import { generateDocx } from './utils/docxExport';
import infiniteLogo from './assets/infinite-logo.png';

const NAVY = '#152F59';
const LIGHT_NAVY = '#253C7A';

function StarDisplay({ rating }) {
  const n = parseInt(rating) || 0;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className="w-4 h-4" fill={i <= n ? '#FBBF24' : '#D1D5DB'} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1.5 text-sm font-semibold text-gray-700">{n}/5</span>
    </span>
  );
}

function Field({ label, value, children }) {
  return (
    <div className="flex border-b border-gray-100 last:border-0">
      <div className="w-60 shrink-0 py-2.5 px-3 bg-slate-50 text-xs font-semibold text-slate-600 border-r border-gray-100">
        {label}
      </div>
      <div className="flex-1 py-2.5 px-3 text-sm text-gray-800">
        {children ?? (value != null && value !== '' ? value : <span className="text-gray-400">—</span>)}
      </div>
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="px-3 py-2 text-white text-xs font-bold tracking-wide uppercase" style={{ background: NAVY }}>
      {title}
    </div>
  );
}

function MetricRow({ label, value, pct }) {
  const display = value != null
    ? pct ? parseFloat(value).toFixed(1) + '%' : parseFloat(value).toFixed(2)
    : null;
  return (
    <div className="flex border-b border-gray-100 last:border-0">
      <div className="w-60 shrink-0 py-2 px-3 bg-slate-50 text-xs font-semibold text-slate-600 border-r border-gray-100">
        {label}
      </div>
      <div className="flex-1 py-2 px-3 text-sm font-medium text-gray-800">
        {display ?? <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

function buildReportData(facilityData, claimsData, avgs, manualInputs) {
  if (!facilityData) return null;
  const f = facilityData;
  const addr = [f.provider_address, f.citytown, f.state, f.zip_code].filter(Boolean).join(', ');
  const claimsMap = {};
  claimsData.forEach(m => { claimsMap[m.measure_code] = m; });

  return {
    facilityName: manualInputs.facilityNameOverride || f.provider_name,
    location: addr,
    state: f.state,
    emr: manualInputs.emr,
    censusCap: f.number_of_certified_beds,
    currentCensus: manualInputs.currentCensus,
    patientType: manualInputs.patientType,
    previousCoverage: manualInputs.previousCoverage,
    previousPerformance: manualInputs.previousPerformance,
    medicalCoverage: manualInputs.medicalCoverage,
    overallRating: f.overall_rating,
    healthInspectionRating: f.health_inspection_rating,
    staffingRating: f.staffing_rating,
    qualityRating: f.qm_rating,
    claims: {
      str_hosp: claimsMap['521']?.adjusted_score,
      nat_str_hosp: avgs?.nat521,
      st_str_hosp: avgs?.st521,
      str_ed: claimsMap['522']?.adjusted_score,
      nat_str_ed: avgs?.nat522,
      st_str_ed: avgs?.st522,
      lt_hosp: claimsMap['551']?.adjusted_score,
      nat_lt_hosp: avgs?.nat551,
      st_lt_hosp: avgs?.st551,
      lt_ed: claimsMap['552']?.adjusted_score,
      nat_lt_ed: avgs?.nat552,
      st_lt_ed: avgs?.st552,
    },
  };
}

export default function App() {
  const [ccn, setCcn] = useState('');
  const [facilityData, setFacilityData] = useState(null);
  const [claimsData, setClaimsData] = useState([]);
  const [avgs, setAvgs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avgsLoading, setAvgsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [manualInputs, setManualInputs] = useState({
    facilityNameOverride: '',
    emr: '',
    currentCensus: '',
    patientType: '',
    previousCoverage: 'No',
    previousPerformance: '',
    medicalCoverage: '',
  });

  function setInput(key, val) {
    setManualInputs(prev => ({ ...prev, [key]: val }));
  }

  async function handleSearch(e) {
    e.preventDefault();
    const trimmed = ccn.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setFacilityData(null);
    setClaimsData([]);
    setAvgs(null);
    try {
      const [provider, claims] = await Promise.all([
        fetchProviderInfo(trimmed),
        fetchClaimsMetrics(trimmed),
      ]);
      setFacilityData(provider);
      setClaimsData(claims);
      if (claims.length > 0) {
        setAvgsLoading(true);
        fetchAllAverages(provider.state)
          .then(a => { setAvgs(a); setAvgsLoading(false); })
          .catch(() => setAvgsLoading(false));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const reportData = buildReportData(facilityData, claimsData, avgs, manualInputs);
  const claimsMap = {};
  claimsData.forEach(m => { claimsMap[m.measure_code] = m; });
  const medicareUrl = ccn.trim()
    ? `https://www.medicare.gov/care-compare/details/nursing-home/${ccn.trim()}`
    : null;

  async function handlePDF() {
    if (!reportData) return;
    setPdfLoading(true);
    try { generatePDF(reportData, ccn.trim()); }
    catch (e) { alert('PDF error: ' + e.message); }
    finally { setPdfLoading(false); }
  }

  async function handleDocx() {
    if (!reportData) return;
    setDocxLoading(true);
    try { await generateDocx(reportData, ccn.trim()); }
    catch (e) { alert('Word export error: ' + e.message); }
    finally { setDocxLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eef2f7' }}>
      {/* ── Branding Header ── */}
      <header>
        <div className="bg-white border-b border-gray-200 px-5 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <img src={infiniteLogo} alt="INFINITE — Managed by MEDELITE" className="h-10" />
            <div className="hidden sm:block text-right">
              <div className="text-gray-500 text-xs">Facility Assessment Tool</div>
              <div className="text-gray-400 text-xs mt-0.5">Powered by CMS Provider Data</div>
            </div>
          </div>
        </div>
        <div style={{ background: NAVY }} className="px-5 py-2">
          <div className="max-w-5xl mx-auto flex items-baseline gap-3">
            <span className="text-white font-bold text-sm tracking-widest">FACILITY ASSESSMENT SNAPSHOT</span>
            {facilityData?.state && (
              <span className="font-bold text-base" style={{ color: '#FCD34D' }}>{facilityData.state}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* ── Search Box ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Search Facility by CCN</h2>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={ccn}
              onChange={e => setCcn(e.target.value)}
              placeholder="Enter CMS Certification Number (e.g. 686123)"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={10}
            />
            <button
              type="submit"
              disabled={loading || !ccn.trim()}
              className="px-6 py-2.5 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-all"
              style={{ background: NAVY }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Fetching…
                </span>
              ) : 'Fetch Data'}
            </button>
          </form>
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Test with CCN{' '}
            <button
              type="button"
              onClick={() => setCcn('686123')}
              className="text-blue-500 hover:underline font-mono"
            >
              686123
            </button>
            {' '}— Kendall Lakes Healthcare and Rehab Center, FL
          </p>
        </div>

        {facilityData && (
          <>
            {/* ── Manual Inputs ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-slate-50">
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Manual Operational Inputs</h2>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'facilityNameOverride', label: 'Facility Name Override', placeholder: facilityData.provider_name, note: 'optional — overrides API name on report' },
                  { key: 'emr', label: 'EMR', placeholder: 'e.g. PCC, MatrixCare' },
                  { key: 'currentCensus', label: 'Current Census', placeholder: 'e.g. 112', type: 'number' },
                  { key: 'patientType', label: 'Type of Patient', placeholder: 'e.g. Long-term & Short-term' },
                  { key: 'previousPerformance', label: 'Previous Provider Performance', placeholder: 'e.g. About 30 patients/day' },
                  { key: 'medicalCoverage', label: 'Medical Coverage', placeholder: 'e.g. Optometry, PCP, Podiatry', span: true },
                ].map(f => (
                  <div key={f.key} className={f.span ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {f.label}{' '}
                      {f.note && <span className="text-gray-400 font-normal">({f.note})</span>}
                    </label>
                    <input
                      type={f.type || 'text'}
                      value={manualInputs[f.key]}
                      onChange={e => setInput(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Previous Coverage from Medelite</label>
                  <select
                    value={manualInputs.previousCoverage}
                    onChange={e => setInput('previousCoverage', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Report Preview ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Report Preview</h2>
                {medicareUrl && (
                  <a href={medicareUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    View on Medicare Care Compare ↗
                  </a>
                )}
              </div>

              <Field label="Name of Facility" value={reportData?.facilityName} />
              <Field label="Location" value={reportData?.location} />
              <Field label="EMR" value={reportData?.emr} />
              <Field label="Census Capacity" value={reportData?.censusCap} />
              <Field label="Current Census" value={reportData?.currentCensus} />
              <Field label="Type of Patient" value={reportData?.patientType} />
              <Field label="Previous Coverage from Medelite" value={reportData?.previousCoverage} />
              <Field label="Previous Provider Performance" value={reportData?.previousPerformance} />
              <Field label="Medical Coverage" value={reportData?.medicalCoverage} />

              <SectionHeader title="Star Ratings" />
              <Field label="Overall Star Rating">
                <StarDisplay rating={facilityData.overall_rating} />
              </Field>
              <Field label="Health Inspection">
                <StarDisplay rating={facilityData.health_inspection_rating} />
              </Field>
              <Field label="Staffing">
                <StarDisplay rating={facilityData.staffing_rating} />
              </Field>
              <Field label="Quality of Resident Care">
                <StarDisplay rating={facilityData.qm_rating} />
              </Field>

              {claimsData.length > 0 && (
                <>
                  <SectionHeader title={`Hospitalization & ED Metrics${avgsLoading ? ' · computing state/national averages…' : ''}`} />
                  <MetricRow label="Short Term Hospitalization" value={claimsMap['521']?.adjusted_score} pct />
                  <MetricRow label="STR National Avg. for Hospitalization" value={avgs?.nat521} pct />
                  <MetricRow label="STR State National Avg. for Hospitalization" value={avgs?.st521} pct />
                  <MetricRow label="STR ED Visit" value={claimsMap['522']?.adjusted_score} pct />
                  <MetricRow label="STR ED Visits National Avg." value={avgs?.nat522} pct />
                  <MetricRow label="STR ED Visits State Avg." value={avgs?.st522} pct />
                  <MetricRow label="LT Hospitalization" value={claimsMap['551']?.adjusted_score} />
                  <MetricRow label="LT National Avg. for Hospitalization" value={avgs?.nat551} />
                  <MetricRow label="LT State National Avg. for Hospitalization" value={avgs?.st551} />
                  <MetricRow label="ED Visit" value={claimsMap['552']?.adjusted_score} />
                  <MetricRow label="LT ED Visits National Avg." value={avgs?.nat552} />
                  <MetricRow label="LT ED Visits State Avg." value={avgs?.st552} />
                </>
              )}

              {medicareUrl && (
                <div className="px-3 py-2.5 bg-blue-50 border-t border-blue-100 text-xs">
                  <span className="text-gray-500">Medicare Source: </span>
                  <a href={medicareUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all">{medicareUrl}</a>
                </div>
              )}
            </div>

            {/* ── Export Buttons ── */}
            <div className="flex flex-wrap gap-3 pb-8">
              <button
                onClick={handlePDF}
                disabled={pdfLoading}
                className="flex items-center gap-2 px-7 py-3 text-white text-sm font-semibold rounded-lg shadow-sm transition-opacity disabled:opacity-60"
                style={{ background: NAVY }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {pdfLoading ? 'Generating PDF…' : 'Download PDF'}
              </button>
              <button
                onClick={handleDocx}
                disabled={docxLoading}
                className="flex items-center gap-2 px-7 py-3 text-sm font-semibold rounded-lg shadow-sm border transition-opacity disabled:opacity-60"
                style={{ background: '#fff', color: NAVY, borderColor: NAVY }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {docxLoading ? 'Generating .docx…' : 'Download Word (.docx)'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
