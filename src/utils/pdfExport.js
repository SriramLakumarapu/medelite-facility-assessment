import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/infinite-logo.png';

const NAVY = [21, 47, 89];
const LIGHT_NAVY = [37, 75, 140];
const WHITE = [255, 255, 255];
const LIGHT = [245, 248, 252];
const BORDER = [210, 218, 230];
const DARK = [20, 30, 48];
const GRAY = [100, 110, 125];
const GOLD = [196, 150, 20];
const GREEN = [34, 139, 34];

function fmt(val) {
  if (val == null || val === '') return '—';
  return String(val);
}

function fmtPct(val) {
  const n = parseFloat(val);
  if (val == null || val === '' || isNaN(n)) return '—';
  return n.toFixed(1) + '%';
}

function fmtDec(val) {
  const n = parseFloat(val);
  if (val == null || val === '' || isNaN(n)) return '—';
  return n.toFixed(2);
}

function drawStars(doc, x, y, rating) {
  const r = parseInt(rating) || 0;
  const R = 2;
  for (let i = 0; i < 5; i++) {
    const cx = x + i * (R * 2 + 1.5);
    if (i < r) {
      doc.setFillColor(...GOLD);
      doc.circle(cx, y, R, 'F');
    } else {
      doc.setFillColor(210, 210, 210);
      doc.setDrawColor(180, 180, 180);
      doc.circle(cx, y, R, 'D');
    }
  }
  doc.setFillColor(...DARK);
  doc.setDrawColor(0, 0, 0);
}

async function loadLogoDataUrl() {
  const resp = await fetch(logoUrl);
  const blob = await resp.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(blob);
  });
}

export async function generatePDF(data, ccn) {
  const logoData = await loadLogoDataUrl();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = 215.9;
  const H = 279.4;
  const M = 14;
  const CW = W - 2 * M;
  const COL1 = 85;
  const COL2 = CW - COL1;

  // ─── Logo header (white background) ───
  // Logo is 224×51 px → aspect 4.392. At 58mm wide → 13.2mm tall.
  const LOGO_W = 58;
  const LOGO_H = 13.2;
  doc.addImage(logoData, 'PNG', M, 4, LOGO_W, LOGO_H);

  // ─── FACILITY ASSESSMENT SNAPSHOT bar ───
  doc.setFillColor(...NAVY);
  doc.rect(0, 20, W, 11, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('FACILITY ASSESSMENT SNAPSHOT', M, 27.5);

  if (data.state) {
    doc.setFontSize(13);
    doc.text(data.state, W - M, 27.5, { align: 'right' });
  }

  let y = 35;

  // ─── Main Info Table ───
  const mainRows = [
    ['Name of Facility', fmt(data.facilityName)],
    ['Location', fmt(data.location)],
    ['EMR', fmt(data.emr)],
    ['Census Capacity', fmt(data.censusCap)],
    ['Current Census', fmt(data.currentCensus)],
    ['Type of Patient', fmt(data.patientType)],
    ['Previous Coverage from Medelite', fmt(data.previousCoverage)],
    ['Previous Provider Performance from Medelite', fmt(data.previousPerformance)],
    ['Medical Coverage', fmt(data.medicalCoverage)],
  ];

  autoTable(doc, {
    startY: y,
    body: mainRows,
    columnStyles: {
      0: { cellWidth: COL1, fontStyle: 'bold', fillColor: LIGHT, textColor: DARK },
      1: { cellWidth: COL2, fillColor: WHITE, textColor: DARK },
    },
    styles: {
      fontSize: 9.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      lineColor: BORDER,
      lineWidth: 0.3,
    },
    margin: { left: M, right: M },
    theme: 'grid',
  });

  y = doc.lastAutoTable.finalY + 4;

  // ─── Star Ratings Section Header ───
  doc.setFillColor(...NAVY);
  doc.rect(M, y, CW, 7, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('  Star Ratings', M, y + 4.8);
  y += 7;

  const starData = [
    { label: 'Overall Star Rating', val: data.overallRating },
    { label: 'Health Inspection', val: data.healthInspectionRating },
    { label: 'Staffing', val: data.staffingRating },
    { label: 'Quality of Resident Care', val: data.qualityRating },
  ];

  const starRows = starData.map(s => [s.label, `${s.val ?? '—'} / 5`]);

  autoTable(doc, {
    startY: y,
    body: starRows,
    columnStyles: {
      0: { cellWidth: COL1, fontStyle: 'bold', fillColor: LIGHT, textColor: DARK },
      1: { cellWidth: COL2, fillColor: WHITE, textColor: DARK },
    },
    styles: {
      fontSize: 9.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      lineColor: BORDER,
      lineWidth: 0.3,
    },
    margin: { left: M, right: M },
    theme: 'grid',
    didDrawCell: (hook) => {
      if (hook.section === 'body' && hook.column.index === 1) {
        const idx = hook.row.index;
        const rating = starData[idx]?.val;
        if (rating != null) {
          const cx = hook.cell.x + 28;
          const cy = hook.cell.y + hook.cell.height / 2;
          drawStars(doc, cx, cy - 1.5, rating, 3);
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  // ─── Hospitalization & ED Metrics (Bonus) ───
  if (data.claims && Object.values(data.claims).some(v => v != null)) {
    doc.setFillColor(...NAVY);
    doc.rect(M, y, CW, 7, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('  Hospitalization & ED Metrics', M, y + 4.8);
    y += 7;

    const c = data.claims;
    const hospRows = [
      ['Short Term Hospitalization', c.str_hosp != null ? fmtPct(c.str_hosp) : '—'],
      ['STR National Avg. for Hospitalization', c.nat_str_hosp != null ? fmtPct(c.nat_str_hosp) : '—'],
      ['STR State National Avg. for Hospitalization', c.st_str_hosp != null ? fmtPct(c.st_str_hosp) : '—'],
      ['STR ED Visit', c.str_ed != null ? fmtPct(c.str_ed) : '—'],
      ['STR ED Visits National Avg.', c.nat_str_ed != null ? fmtPct(c.nat_str_ed) : '—'],
      ['STR ED Visits State Avg.', c.st_str_ed != null ? fmtPct(c.st_str_ed) : '—'],
      ['LT Hospitalization', c.lt_hosp != null ? fmtDec(c.lt_hosp) : '—'],
      ['LT National Avg. for Hospitalization', c.nat_lt_hosp != null ? fmtDec(c.nat_lt_hosp) : '—'],
      ['LT State National Avg. for Hospitalization', c.st_lt_hosp != null ? fmtDec(c.st_lt_hosp) : '—'],
      ['ED Visit', c.lt_ed != null ? fmtDec(c.lt_ed) : '—'],
      ['LT ED Visits National Avg.', c.nat_lt_ed != null ? fmtDec(c.nat_lt_ed) : '—'],
      ['LT ED Visits State Avg.', c.st_lt_ed != null ? fmtDec(c.st_lt_ed) : '—'],
    ];

    autoTable(doc, {
      startY: y,
      body: hospRows,
      columnStyles: {
        0: { cellWidth: COL1, fontStyle: 'bold', fillColor: LIGHT, textColor: DARK },
        1: { cellWidth: COL2, fillColor: WHITE, textColor: DARK },
      },
      styles: {
        fontSize: 9.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
        lineColor: BORDER,
        lineWidth: 0.3,
      },
      margin: { left: M, right: M },
      theme: 'grid',
    });

    y = doc.lastAutoTable.finalY + 4;
  }

  // ─── Footer ───
  const footerY = H - 12;
  doc.setFillColor(...LIGHT);
  doc.rect(0, footerY - 4, W, 16, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('Source: Medicare Care Compare  |  Generated by INFINITE Platform', M, footerY + 1);

  const link = `https://www.medicare.gov/care-compare/details/nursing-home/${ccn}`;
  doc.setTextColor(30, 100, 200);
  doc.textWithLink(link, M, footerY + 6, { url: link });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.setTextColor(...GRAY);
  doc.text(today, W - M, footerY + 1, { align: 'right' });

  doc.save(`Facility_Assessment_${data.facilityName?.replace(/\s+/g, '_') || ccn}_${ccn}.pdf`);
}
