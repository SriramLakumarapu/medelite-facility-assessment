import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, Header,
  HeadingLevel, PageNumber,
} from 'docx';
import { saveAs } from 'file-saver';

const NAVY_HEX = '152F59';
const LIGHT_HEX = 'F0F5FA';
const BORDER_HEX = 'C8D4E3';
const GOLD_HEX = 'C49614';

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_HEX };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function labelCell(text) {
  return new TableCell({
    borders,
    width: { size: 4320, type: WidthType.DXA },
    shading: { fill: LIGHT_HEX, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: text || '', bold: true, size: 18, font: 'Arial' })] })],
  });
}

function valueCell(text) {
  return new TableCell({
    borders,
    width: { size: 5040, type: WidthType.DXA },
    shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: text || '—', size: 18, font: 'Arial' })] })],
  });
}

function row(label, value) {
  return new TableRow({ children: [labelCell(label), valueCell(value)] });
}

function sectionHeader(title) {
  return new TableRow({
    children: [
      new TableCell({
        borders: noBorders,
        columnSpan: 2,
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: NAVY_HEX, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: title, bold: true, color: 'FFFFFF', size: 20, font: 'Arial' })],
        })],
      }),
    ],
  });
}

function starText(n) {
  if (n == null) return '—';
  const filled = '★'.repeat(parseInt(n));
  const empty = '☆'.repeat(5 - parseInt(n));
  return `${filled}${empty}  (${n}/5)`;
}

function fmt(v) { return v != null && v !== '' ? String(v) : '—'; }
function fmtPct(v) { const n = parseFloat(v); return (v != null && v !== '' && !isNaN(n)) ? n.toFixed(1) + '%' : '—'; }
function fmtDec(v) { const n = parseFloat(v); return (v != null && v !== '' && !isNaN(n)) ? n.toFixed(2) : '—'; }

export async function generateDocx(data, ccn) {
  const c = data.claims || {};
  const hasHosp = Object.values(c).some(v => v != null);

  const tableRows = [
    row('Name of Facility', fmt(data.facilityName)),
    row('Location', fmt(data.location)),
    row('EMR', fmt(data.emr)),
    row('Census Capacity', fmt(data.censusCap)),
    row('Current Census', fmt(data.currentCensus)),
    row('Type of Patient', fmt(data.patientType)),
    row('Previous Coverage from Medelite', fmt(data.previousCoverage)),
    row('Previous Provider Performance from Medelite', fmt(data.previousPerformance)),
    row('Medical Coverage', fmt(data.medicalCoverage)),

    sectionHeader('Star Ratings'),
    row('Overall Star Rating', starText(data.overallRating)),
    row('Health Inspection', starText(data.healthInspectionRating)),
    row('Staffing', starText(data.staffingRating)),
    row('Quality of Resident Care', starText(data.qualityRating)),
  ];

  if (hasHosp) {
    tableRows.push(
      sectionHeader('Hospitalization & ED Metrics'),
      row('Short Term Hospitalization', fmtPct(c.str_hosp)),
      row('STR National Avg. for Hospitalization', fmtPct(c.nat_str_hosp)),
      row('STR State National Avg. for Hospitalization', fmtPct(c.st_str_hosp)),
      row('STR ED Visit', fmtPct(c.str_ed)),
      row('STR ED Visits National Avg.', fmtPct(c.nat_str_ed)),
      row('STR ED Visits State Avg.', fmtPct(c.st_str_ed)),
      row('LT Hospitalization', fmtDec(c.lt_hosp)),
      row('LT National Avg. for Hospitalization', fmtDec(c.nat_lt_hosp)),
      row('LT State National Avg. for Hospitalization', fmtDec(c.st_lt_hosp)),
      row('ED Visit', fmtDec(c.lt_ed)),
      row('LT ED Visits National Avg.', fmtDec(c.nat_lt_ed)),
      row('LT ED Visits State Avg.', fmtDec(c.st_lt_ed)),
    );
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1000, right: 900, bottom: 1000, left: 900 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              shading: { fill: NAVY_HEX, type: ShadingType.CLEAR },
              border: { bottom: { style: BorderStyle.NONE } },
              children: [
                new TextRun({ text: 'INFINITE — Managed by MEDELITE', bold: true, color: 'FFFFFF', size: 28, font: 'Arial' }),
              ],
            }),
            new Paragraph({
              shading: { fill: '253C7A', type: ShadingType.CLEAR },
              children: [
                new TextRun({ text: 'FACILITY ASSESSMENT SNAPSHOT    ' + (data.state || ''), bold: true, color: 'FFFFFF', size: 22, font: 'Arial' }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4320, 5040],
          rows: tableRows,
        }),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Source: Medicare Care Compare — ', size: 16, font: 'Arial', color: '666666' }),
            new TextRun({
              text: `https://www.medicare.gov/care-compare/details/nursing-home/${ccn}`,
              size: 16, font: 'Arial', color: '1E64C8', underline: {},
            }),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `Facility_Assessment_${data.facilityName?.replace(/\s+/g, '_') || ccn}_${ccn}.docx`);
}
