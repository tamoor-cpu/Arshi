const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const storage = require('./storage');

function dataUrlToBytes(dataUrl) {
  if (!dataUrl) return null;
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

// Read AcroForm fields from an uploaded PDF so the owner/employee knows what to fill.
async function extractPdfFields(sourceUrl) {
  try {
    const bytes = await storage.readBuffer(sourceUrl);
    if (!bytes) return [];
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    return form.getFields().map((f) => {
      const t = f.constructor.name;
      const type = /Text/.test(t) ? 'text' : /CheckBox/.test(t) ? 'checkbox' : /Dropdown|OptionList/.test(t) ? 'select' : 'text';
      return { key: f.getName(), label: f.getName(), type };
    });
  } catch {
    return [];
  }
}

// Word-wrap helper for the policy renderer.
function wrapText(text, font, size, maxWidth) {
  const out = [];
  (text || '').split(/\r?\n/).forEach((para) => {
    if (para.trim() === '') { out.push(''); return; }
    let line = '';
    para.split(/\s+/).forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) { out.push(line); line = word; }
      else line = test;
    });
    if (line) out.push(line);
  });
  return out;
}

// Persist the generated PDF via the storage adapter (local disk or remote object storage).
async function saveBytes(bytes) {
  return storage.saveBuffer(Buffer.from(bytes), { ext: 'pdf', contentType: 'application/pdf' });
}

async function stampSignatureBlock(pdf, page, font, fontBold, { employee, signatureBytes, dateStr }) {
  const sig = signatureBytes ? await pdf.embedPng(signatureBytes).catch(() => null) : null;
  const { width } = page.getSize();
  let y = 110;
  page.drawLine({ start: { x: 50, y: y + 60 }, end: { x: width - 50, y: y + 60 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  page.drawText('Electronically signed', { x: 50, y: y + 44, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  if (sig) {
    const dims = sig.scale(Math.min(160 / sig.width, 50 / sig.height));
    page.drawImage(sig, { x: 50, y: y - 6, width: dims.width, height: dims.height });
  }
  page.drawLine({ start: { x: 50, y }, end: { x: 250, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`${employee.firstName} ${employee.lastName}`, { x: 50, y: y - 14, size: 10, font: fontBold });
  page.drawText('Signature', { x: 50, y: y - 26, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  page.drawText(dateStr, { x: 320, y: y - 14, size: 10, font: fontBold });
  page.drawText('Date', { x: 320, y: y - 26, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
}

// Generate the final signed PDF for an employee and return its public URL.
async function generateSignedPdf({ template, fieldData = {}, signatureDataUrl, employee }) {
  const signatureBytes = dataUrlToBytes(signatureDataUrl);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // ----- Fillable form: fill the uploaded PDF's fields + stamp signature -----
  if (template.type === 'fillable_form' && template.sourceFileUrl) {
    const srcBytes = await storage.readBuffer(template.sourceFileUrl);
    if (srcBytes) {
      const pdf = await PDFDocument.load(srcBytes);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      try {
        const form = pdf.getForm();
        const formFields = form.getFields().map((f) => f.getName());
        Object.entries(fieldData).forEach(([key, val]) => {
          if (!formFields.includes(key)) return;
          try {
            const field = form.getField(key);
            const t = field.constructor.name;
            if (/Text/.test(t)) field.setText(String(val ?? ''));
            else if (/CheckBox/.test(t)) { val ? field.check() : field.uncheck(); }
          } catch { /* skip bad field */ }
        });
        try { form.flatten(); } catch { /* leave interactive if flatten fails */ }
      } catch { /* no acroform — fall through to appended page */ }

      // Append a certification + signature page with the entered values.
      const page = pdf.addPage([612, 792]);
      const { height } = page.getSize();
      page.drawText('Signed & Completed', { x: 50, y: height - 60, size: 18, font: fontBold });
      page.drawText(template.name, { x: 50, y: height - 82, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
      let y = height - 120;
      Object.entries(fieldData).forEach(([key, val]) => {
        page.drawText(`${key}:`, { x: 50, y, size: 10, font: fontBold });
        page.drawText(String(val ?? ''), { x: 220, y, size: 10, font });
        y -= 18;
      });
      await stampSignatureBlock(pdf, page, font, fontBold, { employee, signatureBytes, dateStr });
      return saveBytes(await pdf.save());
    }
  }

  // ----- Policy / electronic document: render content + signature -----
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [612, 792];
  const margin = 50;
  const maxWidth = pageSize[0] - margin * 2;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  page.drawText(template.name, { x: margin, y, size: 18, font: fontBold });
  y -= 28;

  // Entered field values (if any)
  if (Object.keys(fieldData).length) {
    Object.entries(fieldData).forEach(([key, val]) => {
      page.drawText(`${key}: ${val ?? ''}`, { x: margin, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 16;
    });
    y -= 8;
  }

  const lines = wrapText(template.content || '', font, 11, maxWidth);
  for (const line of lines) {
    if (y < 160) { page = pdf.addPage(pageSize); y = pageSize[1] - margin; }
    page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 16;
  }

  if (y < 180) { page = pdf.addPage(pageSize); }
  await stampSignatureBlock(pdf, page, font, fontBold, { employee, signatureBytes, dateStr });
  return saveBytes(await pdf.save());
}

module.exports = { generateSignedPdf, extractPdfFields };
