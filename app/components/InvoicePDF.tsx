import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceLineItem } from '../db/schema';

interface InvoicePDFProps {
  invoice: Invoice & { lineItems: InvoiceLineItem[] };
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  paymentTerms?: string;
  notes?: string;
  currency?: string;
}

export const generateInvoicePDF = ({
  invoice,
  companyName = 'Your Company Name',
  companyAddress = 'Your Company Address',
  companyEmail = 'your@email.com',
  companyPhone = '+1 234 567 890',
  paymentTerms = '',
  notes = '',
  currency = 'USD',
}: InvoicePDFProps) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const lineSpacing = 5;
  
  try {
    // Set document properties
    doc.setProperties({
      title: `Invoice ${invoice.invoiceNumber}`,
      subject: 'Invoice',
      author: companyName,
      keywords: 'invoice, billing',
      creator: 'NextTime App'
    });

    const formatCurrency = (amount: string | number | null | undefined) => {
      const numAmount = Number(amount || 0);
      return currency === 'USD'
        ? `$${numAmount.toFixed(2)}`
        : `${numAmount.toFixed(2)} ${currency}`;
    };

    let yPos = margin;

    // Add "INVOICE" header and number
    doc.setFontSize(16);
    doc.setTextColor(33, 33, 33);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE', margin, yPos);
    doc.text(invoice.invoiceNumber, pageWidth - margin, yPos, { align: 'right' });

    // Add billing period in gray
    yPos += 8;
    doc.setFontSize(9);
    doc.setTextColor(88, 88, 88);
    const startDate = new Date(invoice.startDate).toLocaleDateString();
    const endDate = new Date(invoice.endDate).toLocaleDateString();
    doc.text(`Billing Period: ${startDate} - ${endDate}`, pageWidth - margin, yPos, { align: 'right' });

    // Add From section
    yPos += 25;
    doc.setFontSize(9);
    doc.setTextColor(88, 88, 88);
    doc.text('From:', margin, yPos);
    
    yPos += lineSpacing;
    doc.setTextColor(33, 33, 33);
    doc.text(companyName, margin, yPos);
    
    // Handle address lines more compactly
    const addressLines = companyAddress.split('\\n');
    addressLines.forEach((line) => {
      yPos += 4; // Reduced spacing between address lines
      doc.text(line, margin, yPos);
    });
    
    yPos += 8; // Reduced spacing before email
    doc.text(companyEmail, margin, yPos);

    // Add Bill To section with adjusted starting position
    const billToX = pageWidth / 2;
    const billToY = yPos - ((addressLines.length * 4) + 8); // Adjust based on new compact spacing
    doc.setTextColor(88, 88, 88);
    doc.text('Bill To:', billToX, billToY);
    
    doc.setTextColor(33, 33, 33);
    doc.text(companyName, billToX, billToY + 4);
    doc.text(companyEmail, billToX, billToY + 8);

    // Add line items table with minimal styling
    yPos += 20; // Adjusted spacing before table
    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Description', 'Hours', 'Rate', 'Amount']],
      body: invoice.lineItems.map(item => [
        new Date(item.createdAt).toLocaleDateString(),
        item.description,
        item.quantity,
        formatCurrency(item.rate),
        formatCurrency(item.amount)
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: false,
        textColor: 88,
        fontSize: 9,
        fontStyle: 'normal',
        cellPadding: { top: 5, right: 4, bottom: 5, left: 4 },
      },
      bodyStyles: {
        fontSize: 9,
        textColor: 33,
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: false,
      },
      margin: { left: margin, right: margin },
      didDrawCell: (data) => {
        if (data.row.index === 0 && data.section === 'head') {
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.1);
          doc.line(
            data.settings.margin.left,
            data.cell.y + data.cell.height,
            pageWidth - data.settings.margin.right,
            data.cell.y + data.cell.height
          );
        }
      },
    });

    // Get the final Y position after the table
    const finalY = (doc as any).lastAutoTable.finalY + 15;

    // Add totals section with minimal styling
    const totalsX = pageWidth - margin - 80;
    let summaryY = finalY;

    // Add total hours
    const totalHours = invoice.lineItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    doc.setFontSize(9);
    doc.text('Total Hours:', totalsX, summaryY);
    doc.text(totalHours.toString(), pageWidth - margin, summaryY, { align: 'right' });

    // Add subtotal
    summaryY += lineSpacing + 2;
    doc.text('Subtotal:', totalsX, summaryY);
    doc.text(formatCurrency(invoice.subtotal), pageWidth - margin, summaryY, { align: 'right' });

    // Add tax if applicable
    if (invoice.taxRate) {
      summaryY += lineSpacing + 2;
      doc.text(`Tax (${invoice.taxRate}%)`, totalsX, summaryY);
      doc.text(formatCurrency(invoice.taxAmount), pageWidth - margin, summaryY, { align: 'right' });
    }

    // Add total due
    summaryY += lineSpacing + 4;
    doc.setFontSize(10);
    doc.text('Total Due:', totalsX, summaryY);
    doc.text(formatCurrency(invoice.total), pageWidth - margin, summaryY, { align: 'right' });

    // Add payment terms if provided
    if (paymentTerms) {
      summaryY += 20;
      doc.setFontSize(9);
      doc.setTextColor(88, 88, 88);
      doc.text('Payment Terms:', margin, summaryY);
      doc.setTextColor(33, 33, 33);
      doc.text(paymentTerms, margin + 50, summaryY);
    }

    // Add minimal footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${invoice.invoiceNumber}`, margin, pageHeight - 15);

    return doc;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
};

export default generateInvoicePDF; 