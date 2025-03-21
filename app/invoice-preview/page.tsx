"use client";

import { useState, useEffect } from 'react';
import { generateInvoicePDF } from '../components/InvoicePDF';

// Sample data for preview
const sampleInvoice = {
  id: "preview-1",
  invoiceNumber: "INV-2024-001",
  startDate: new Date("2024-03-01"),
  endDate: new Date("2024-03-15"),
  dueDate: new Date("2024-04-15"),
  createdAt: new Date(),
  updatedAt: new Date(),
  subtotal: "1250.00",
  taxRate: "10.00",
  taxAmount: "125.00",
  total: "1375.00",
  status: "draft",
  userId: "preview",
  notes: "Sample invoice for preview purposes",
  sentAt: null,
  paidAt: null,
  lineItems: [
    {
      id: "line-1",
      invoiceId: "preview-1",
      projectId: "project-1",
      description: "Frontend Development - Monday",
      quantity: "4.5",
      rate: "125.00",
      amount: "562.50",
      createdAt: new Date()
    },
    {
      id: "line-2",
      invoiceId: "preview-1",
      projectId: "project-1",
      description: "Backend API Integration - Tuesday",
      quantity: "3.5",
      rate: "125.00",
      amount: "437.50",
      createdAt: new Date()
    },
    {
      id: "line-3",
      invoiceId: "preview-1",
      projectId: "project-2",
      description: "UI/UX Design Review - Wednesday",
      quantity: "2.0",
      rate: "125.00",
      amount: "250.00",
      createdAt: new Date()
    }
  ]
};

const sampleCompanyInfo = {
  companyName: "Acme Web Solutions",
  companyAddress: "123 Tech Lane\nSilicon Valley, CA 94025",
  companyEmail: "billing@acmeweb.com",
  companyPhone: "+1 (555) 123-4567",
  paymentTerms: "Net 30 - Please make payment within 30 days",
  notes: "Thank you for your business! For any questions about this invoice, please contact billing@acmeweb.com",
  currency: "USD"
};

export default function InvoicePreview() {
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [formData, setFormData] = useState(sampleCompanyInfo);
  const [invoiceData, setInvoiceData] = useState(sampleInvoice);

  const generatePreview = () => {
    try {
      const doc = generateInvoicePDF({
        invoice: invoiceData,
        ...formData
      });

      // Convert to data URL
      const pdfDataUrl = doc.output('dataurlstring');
      setPdfUrl(pdfDataUrl);
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  // Generate preview on mount and when form data changes
  useEffect(() => {
    generatePreview();
  }, [formData, invoiceData]);

  const handleInputChange = (field: keyof typeof sampleCompanyInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLineItemChange = (index: number, field: keyof typeof sampleInvoice.lineItems[0], value: string) => {
    setInvoiceData(prev => {
      const newLineItems = [...prev.lineItems];
      newLineItems[index] = {
        ...newLineItems[index],
        [field]: value,
        // Update amount if quantity or rate changes
        amount: field === 'quantity' || field === 'rate' 
          ? (Number(field === 'quantity' ? value : newLineItems[index].quantity) * 
             Number(field === 'rate' ? value : newLineItems[index].rate)).toFixed(2)
          : newLineItems[index].amount
      };

      // Recalculate totals
      const subtotal = newLineItems.reduce((sum, item) => sum + Number(item.amount), 0);
      const taxAmount = (subtotal * Number(prev.taxRate) / 100);
      
      return {
        ...prev,
        lineItems: newLineItems,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: (subtotal + taxAmount).toFixed(2)
      };
    });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f1f5f9] p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Form Controls */}
        <div className="space-y-6">
          <div className="bg-[#1e293b] rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-instrument-serif mb-4">Company Information</h2>
            <div className="space-y-4">
              {Object.entries(formData).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm text-[#94a3b8] mb-1 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  {key === 'companyAddress' || key === 'notes' ? (
                    <textarea
                      value={value}
                      onChange={(e) => handleInputChange(key as keyof typeof sampleCompanyInfo, e.target.value)}
                      className="w-full bg-[#334155] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                      rows={3}
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleInputChange(key as keyof typeof sampleCompanyInfo, e.target.value)}
                      className="w-full bg-[#334155] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1e293b] rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-instrument-serif mb-4">Line Items</h2>
            <div className="space-y-6">
              {invoiceData.lineItems.map((item, index) => (
                <div key={item.id} className="p-4 bg-[#334155] rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm text-[#94a3b8] mb-1">Description</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                      className="w-full bg-[#1e293b] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Hours</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-1">Rate</label>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => handleLineItemChange(index, 'rate', e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#475569] rounded-md px-3 py-2 text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="text-right text-sm text-[#94a3b8]">
                    Amount: ${item.amount}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[#94a3b8]">
                <span>Subtotal:</span>
                <span>${invoiceData.subtotal}</span>
              </div>
              <div className="flex justify-between text-[#94a3b8]">
                <span>Tax ({invoiceData.taxRate}%):</span>
                <span>${invoiceData.taxAmount}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-[#f1f5f9]">
                <span>Total:</span>
                <span>${invoiceData.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - PDF Preview */}
        <div className="bg-[#1e293b] rounded-xl p-6 shadow-xl h-[calc(100vh-3rem)] sticky top-6">
          <h2 className="text-xl font-instrument-serif mb-4">PDF Preview</h2>
          {pdfUrl && (
            <iframe
              src={pdfUrl}
              className="w-full h-[calc(100%-2rem)] rounded-lg bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
} 