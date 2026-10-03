const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Generates a professional PDF invoice entirely in memory (no local disk
 * writes — Vercel's filesystem isn't persistent) and returns it as a Buffer,
 * ready to be uploaded to Vercel Blob or attached to an email directly.
 * Also returns the QR code data string.
 *
 * @param {Object} data - invoice fields (see Invoice model)
 */
const generateInvoicePDF = async (data) => {
  const qrData = JSON.stringify({
    invoice: data.invoiceNumber,
    booking: data.bookingId,
    total: data.total,
  });
  const qrImageDataUrl = await QRCode.toDataURL(qrData);
  const qrImageBuffer = Buffer.from(qrImageDataUrl.split(',')[1], 'base64');

  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---- Header ----
    doc.fillColor('#0B0C0A').fontSize(22).font('Helvetica-Bold').text('Work', { continued: true });
    doc.fillColor('#22C55E').text('X');
    doc.fillColor('#6B7069').fontSize(10).font('Helvetica').text('Workspace Xcellence', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#6B7069').text('336 Block G3, Johar Town, Canal Road, Lahore');
    doc.text('support: shahzadamjad999@gmail.com');

    doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#E4E7E1').stroke();

    // ---- Invoice meta ----
    doc.moveDown(1.2);
    doc.fillColor('#0B0C0A').fontSize(16).font('Helvetica-Bold').text('INVOICE', 50, 150);
    doc.fontSize(10).font('Helvetica').fillColor('#333');
    doc.text(`Invoice Number: ${data.invoiceNumber}`, 50, 175);
    doc.text(`Booking ID: ${data.bookingId}`, 50, 190);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 50, 205);

    doc.text(`Billed To:`, 320, 175);
    doc.font('Helvetica-Bold').text(data.customerName || '-', 320, 190);
    doc.font('Helvetica').text(data.customerEmail || '-', 320, 205);
    doc.text(data.customerPhone || '-', 320, 220);

    // ---- Table header ----
    let y = 260;
    doc.rect(50, y, 495, 24).fill('#0B0C0A');
    doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 60, y + 7);
    doc.text('Seats', 260, y + 7);
    doc.text('Qty', 340, y + 7);
    doc.text('Unit Price', 400, y + 7);
    doc.text('Amount', 480, y + 7);

    // ---- Table row ----
    y += 24;
    doc.rect(50, y, 495, 30).fillAndStroke('#F7F8F6', '#E4E7E1');
    doc.fillColor('#333').font('Helvetica').fontSize(9);
    doc.text(`${data.workspaceName}\n${data.bookingDate} · ${data.timeSlot}`, 60, y + 6, { width: 190 });
    doc.text((data.seatNumbers || []).join(', '), 260, y + 10, { width: 70 });
    doc.text(String(data.quantity), 340, y + 10);
    doc.text(`PKR ${data.unitPrice}`, 400, y + 10);
    doc.text(`PKR ${data.unitPrice * data.quantity}`, 480, y + 10);

    // ---- Totals ----
    y += 50;
    const subtotal = data.unitPrice * data.quantity;
    doc.font('Helvetica').fontSize(10).fillColor('#333');
    doc.text('Subtotal', 400, y);
    doc.text(`PKR ${subtotal}`, 480, y);
    doc.text('Tax', 400, y + 18);
    doc.text(`PKR ${data.tax || 0}`, 480, y + 18);
    doc.moveTo(400, y + 36).lineTo(545, y + 36).strokeColor('#E4E7E1').stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0B0C0A');
    doc.text('Total', 400, y + 44);
    doc.text(`PKR ${data.total}`, 480, y + 44);

    // ---- QR code ----
    doc.image(qrImageBuffer, 50, y, { width: 90 });
    doc.fontSize(8).fillColor('#6B7069').text('Scan to verify booking', 50, y + 92);

    // ---- Footer ----
    doc.fontSize(9).fillColor('#6B7069').text(
      'Thank you for booking with WorkX. This is a computer-generated invoice.',
      50, 750, { align: 'center', width: 495 }
    );

    doc.end();
  });

  return { pdfBuffer, qrData };
};

module.exports = generateInvoicePDF;
