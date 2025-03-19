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
  console.log('🎨 Starting PDF generation for invoice:', invoice.invoiceNumber);
  
  const doc = new jsPDF();
  
  try {
    // Set document properties
    doc.setProperties({
      title: `Invoice ${invoice.invoiceNumber}`,
      subject: 'Invoice',
      author: companyName,
      keywords: 'invoice, timecard',
      creator: 'Timecard App'
    });
    console.log('📄 Set PDF document properties');

    // Add company logo/header
    doc.setFontSize(24);
    doc.setTextColor(44, 62, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 20, 20);
    console.log('🏢 Added company header');

    // Add company info
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text(companyAddress, 20, 30);
    doc.text(companyEmail, 20, 35);
    doc.text(companyPhone, 20, 40);
    console.log('📞 Added company contact info');

    // Add invoice details with styling
    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    doc.setFont('helvetica', 'bold');
    
    // Create a styled box for invoice details
    doc.setFillColor(247, 250, 252);
    doc.rect(130, 15, 65, 35, 'F');
    doc.setTextColor(44, 62, 80);
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 135, 25);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 135, 32);
    doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, 135, 39);
    console.log('📅 Added invoice details');

    // Add billing period with styling
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Billing Period:', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`${new Date(invoice.startDate).toLocaleDateString()} - ${new Date(invoice.endDate).toLocaleDateString()}`, 70, 60);
    console.log('📊 Added billing period');

    // Format currency based on settings
    const formatCurrency = (amount: string | number | null | undefined) => {
      const numAmount = Number(amount || 0);
      return currency === 'USD'
        ? `$${numAmount.toFixed(2)}`
        : `${numAmount.toFixed(2)} ${currency}`;
    };
    
    // Add line items table with enhanced styling
    console.log('📝 Preparing line items table...');
    const tableData = invoice.lineItems.map(item => [
      item.description,
      item.quantity,
      formatCurrency(item.rate),
      formatCurrency(item.amount)
    ]);

    autoTable(doc, {
      head: [['Description', 'Hours', 'Rate', 'Amount']],
      body: tableData,
      startY: 70,
      theme: 'striped',
      headStyles: {
        fillColor: [44, 62, 80],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 10,
        lineColor: [238, 242, 246],
      },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: [247, 250, 252],
      },
    });
    console.log('📊 Added line items table');

    // Add totals with enhanced styling
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    
    // Add a subtle line above totals
    doc.setDrawColor(238, 242, 246);
    doc.setLineWidth(0.5);
    doc.line(130, finalY + 15, 190, finalY + 15);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Subtotal:', 140, finalY + 20);
    doc.setTextColor(44, 62, 80);
    doc.text(formatCurrency(invoice.subtotal), 170, finalY + 20, { align: 'right' });

    if (invoice.taxRate) {
      doc.setTextColor(100);
      doc.text(`Tax (${Number(invoice.taxRate)}%)`, 140, finalY + 27);
      doc.setTextColor(44, 62, 80);
      doc.text(formatCurrency(invoice.taxAmount), 170, finalY + 27, { align: 'right' });
    }

    // Add total with background highlight
    doc.setFillColor(247, 250, 252);
    doc.rect(135, finalY + 32, 55, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('Total:', 140, finalY + 39);
    doc.text(formatCurrency(invoice.total), 170, finalY + 39, { align: 'right' });
    console.log('💰 Added totals section');

    // Add payment instructions with styling
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Instructions:', 20, finalY + 50);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    // Add payment terms if available
    if (paymentTerms) {
      doc.text(paymentTerms, 20, finalY + 57);
    } else {
      doc.text('Please include the invoice number with your payment.', 20, finalY + 57);
    }
    
    // Add notes if available
    if (notes) {
      doc.text('Notes:', 20, finalY + 65);
      doc.text(notes, 20, finalY + 72, { maxWidth: 170 });
    }
    
    console.log('💳 Added payment instructions');

    // Add footer with styling
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(247, 250, 252);
    doc.rect(0, pageHeight - 25, doc.internal.pageSize.width, 25, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Thank you for your business!', 20, pageHeight - 15);
    doc.text(`Generated on ${new Date().toLocaleString()}`, doc.internal.pageSize.width - 20, pageHeight - 15, { align: 'right' });
    console.log('✨ Added footer');

    console.log('✅ PDF generation completed successfully!');
    return doc;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
};

export default generateInvoicePDF; 