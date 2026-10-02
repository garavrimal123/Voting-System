const PDFDocument = require('pdfkit');

async function fetchImageBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

const CRIMSON = '#dc143c';
const BLUE = '#003893';
const GRAY = '#666666';
const LEFT = 50;

// Generates the registration confirmation PDF (with embedded photo and
// citizenship document image, where available) and streams it to res.
async function generateRegistrationPDF(voter, res) {
  const doc = new PDFDocument({ margin: 0, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=registration-${voter.applicationId}.pdf`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const rightColX = pageWidth - 50 - 90; // photo box x position (90 wide)

  // ---- Header banner ----
  doc.rect(0, 0, pageWidth, 80).fill(BLUE);
  doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
    .text('Nepal Local Level Election', LEFT, 22);
  doc.fontSize(12).font('Helvetica').text('Voter Registration Confirmation', LEFT, 48);
  doc.rect(0, 80, pageWidth, 6).fill(CRIMSON);

  let y = 110;

  // ---- Passport photo, top-right, fixed small box, never overlaps text ----
  const photoBuffer = await fetchImageBuffer(voter.photoUrl);
  const photoBoxTop = y;
  const photoBoxHeight = 110;
  doc.rect(rightColX, photoBoxTop, 90, photoBoxHeight).stroke('#cccccc');
  if (photoBuffer) {
    try {
      doc.image(photoBuffer, rightColX + 5, photoBoxTop + 5, { fit: [80, 100], align: 'center' });
    } catch {
      doc.fontSize(8).fillColor(GRAY).text('Photo unavailable', rightColX + 5, photoBoxTop + 45, { width: 80, align: 'center' });
    }
  } else {
    doc.fontSize(8).fillColor(GRAY).text('Photo unavailable', rightColX + 5, photoBoxTop + 45, { width: 80, align: 'center' });
  }

  // ---- Applicant details, left column, width capped so it never runs under the photo ----
  const leftColWidth = rightColX - LEFT - 20;
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(13).text('Application Details', LEFT, y, { width: leftColWidth });
  y += 22;
  doc.font('Helvetica').fontSize(10.5);

  const rows = [
    ['Application ID', voter.applicationId],
    ['Full Name', voter.fullName],
    ['Phone', voter.phone],
    ['Citizenship No.', voter.citizenshipNumber],
    ['Province', voter.province],
    ['District', voter.district],
    ['Municipality', voter.municipality],
    ['Ward', String(voter.ward)],
    ['Status', voter.registrationStatus.toUpperCase()],
  ];
  for (const [label, value] of rows) {
    doc.font('Helvetica-Bold').text(`${label}:`, LEFT, y, { continued: true, width: leftColWidth });
    doc.font('Helvetica').text(`  ${value}`, { width: leftColWidth });
    y = doc.y + 3;
  }

  // Move below whichever is taller: the text column or the photo box.
  y = Math.max(y, photoBoxTop + photoBoxHeight) + 25;

  // ---- Citizenship document section ----
  doc.font('Helvetica-Bold').fontSize(13).fillColor(BLUE).text('Submitted Citizenship Document', LEFT, y, { width: pageWidth - 100 });
  y = doc.y + 10;

  const isImageDoc = /\.(jpe?g|png)(\?|$)/i.test(voter.citizenshipDocUrl);
  if (isImageDoc) {
    const docBuffer = await fetchImageBuffer(voter.citizenshipDocUrl);
    if (docBuffer) {
      const docWidth = 260;
      try {
        doc.image(docBuffer, LEFT, y, { fit: [docWidth, 170] });
        y += 180;
      } catch {
        doc.fontSize(9).fillColor(GRAY).text('Document image could not be rendered.', LEFT, y);
        y += 20;
      }
    } else {
      doc.fontSize(9).fillColor(GRAY).text('Document image could not be loaded.', LEFT, y);
      y += 20;
    }
  } else {
    doc.fontSize(9).fillColor(GRAY).text('Citizenship document was submitted as a PDF file and is on record with the election office.', LEFT, y, { width: pageWidth - 100 });
    y = doc.y + 10;
  }

  // ---- Footer note ----
  doc.rect(LEFT, y + 10, pageWidth - 100, 1).fill('#e0e0e0');
  doc.fillColor(GRAY).fontSize(8.5).font('Helvetica').text(
    'This confirms your registration was received. Your Voter ID and login password will be sent by ' +
    'email once an administrator has verified your submitted documents. This document does not itself ' +
    'grant voting access. Use your Application ID above to track your registration status.',
    LEFT, y + 20, { width: pageWidth - 100 }
  );

  doc.end();
}

module.exports = { generateRegistrationPDF };
