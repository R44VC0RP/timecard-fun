import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db';
import { invoices, invoiceLineItems, projects, clockInRecords, clockOutRecords, projectRates, userConfig, invoiceSettings } from '@/app/db/schema';
import { eq, and, between } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { options } from '../auth/[...nextauth]/options';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');

    if (invoiceId) {
      // Get specific invoice
      const invoice = await db.query.invoices.findFirst({
        where: and(
          eq(invoices.id, invoiceId),
          eq(invoices.userId, session.user.id)
        ),
      });

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      // Fetch line items separately
      const lineItems = await db.select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoiceId));

      return NextResponse.json({ 
        invoice: {
          ...invoice,
          lineItems
        }
      });
    }

    // Get all invoices for user
    const userInvoices = await db.query.invoices.findMany({
      where: eq(invoices.userId, session.user.id),
      orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
    });

    return NextResponse.json({ invoices: userInvoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔑 Session:', session.user);

    const body = await request.json();
    const { startDate, endDate, projectIds } = body;

    console.log('📅 Creating invoice for period:', { startDate, endDate });

    // Ensure we have valid dates by creating proper Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Set start date to beginning of day
    start.setHours(0, 0, 0, 0);
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    
    console.log('📅 Normalized date range:', { 
      start: start.toISOString(), 
      end: end.toISOString() 
    });

    // Get user's invoice settings
    const settings = await db.query.invoiceSettings.findFirst({
      where: eq(invoiceSettings.userId, session.user.id),
    });

    if (!settings) {
      console.log('⚠️ No invoice settings found for user');
      return NextResponse.json({ error: 'Invoice settings not found' }, { status: 400 });
    }

    console.log('⚙️ Using invoice settings:', settings);

    // Generate invoice number
    const invoiceNumber = `${settings.invoiceNumberPrefix}${settings.nextInvoiceNumber}${settings.invoiceNumberSuffix || ''}`;
    console.log('📝 Generated invoice number:', invoiceNumber);

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (settings.defaultDueDate || 30));

    // Get all shifts for the date range
    console.log('🕒 Fetching shifts for date range...');
    const clockIns = await db.select()
      .from(clockInRecords)
      .where(
        and(
          eq(clockInRecords.userId, session.user.id),
          between(clockInRecords.timestamp, start, end)
        )
      );

    const clockOuts = await db.select()
      .from(clockOutRecords)
      .where(
        and(
          eq(clockOutRecords.userId, session.user.id),
          between(clockOutRecords.timestamp, start, end)
        )
      );

    console.log(`📊 Found ${clockIns.length} clock-ins and ${clockOuts.length} clock-outs`);

    // Get project rates (no need since we get it from invoice settings)
    
    // Calculate line items
    let subtotal = 0;
    
    // Create invoice first
    const [invoice] = await db.insert(invoices)
      .values({
        userId: session.user.id,
        invoiceNumber,
        startDate: start,
        endDate: end,
        dueDate,
        subtotal: "0",
        total: "0",
        status: 'draft',
      })
      .returning();

    console.log('📄 Created invoice:', invoice);
    
    // Create line items based on shifts
    const lineItems = [];
    
    // Match clock-ins with clock-outs by shiftId
    for (const clockIn of clockIns) {
      const clockOut = clockOuts.find(out => out.shiftId === clockIn.shiftId);
      
      if (clockOut) {
        // Calculate hours for this shift
        const hours = (clockOut.timestamp.getTime() - clockIn.timestamp.getTime()) / (1000 * 60 * 60);
        console.log(`⏱️ Calculated hours for shift ${clockIn.shiftId}:`, hours);
        
        // Get project info if available
        let projectName = "Unspecified Project";
        if (clockIn.projectId) {
          const project = await db.query.projects.findFirst({
            where: eq(projects.id, clockIn.projectId),
          });
          if (project) {
            projectName = project.name;
          }
        }
        
        // Use default hourly rate from settings
        const rate = settings.defaultHourlyRate || "0";
        const amount = (Number(rate) * hours).toString();
        subtotal += Number(amount);
        
        // Format dates for better readability
        const clockInDate = new Date(clockIn.timestamp);
        const clockOutDate = new Date(clockOut.timestamp);
        const dateStr = clockInDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeRange = `${clockInDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${clockOutDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        
        // Create line item for this shift
        lineItems.push({
          invoiceId: invoice.id,
          projectId: clockIn.projectId || null,
          description: clockIn.projectId 
            ? `${dateStr}: ${projectName} (${timeRange})`
            : `${dateStr}: Work hours (${timeRange})`,
          quantity: hours.toString(),
          rate: rate.toString(),
          amount,
        });
        
        console.log(`📝 Created line item for shift ${clockIn.shiftId} with ${hours.toFixed(2)} hours`);
      } else {
        console.log(`⚠️ No matching clock-out found for shift ${clockIn.shiftId}`);
      }
    }
    
    console.log(`📋 Created ${lineItems.length} line items from ${clockIns.length} clock-ins`);

    try {
      // Insert line items if there are any
      if (lineItems.length > 0) {
        await db.insert(invoiceLineItems).values(lineItems);
        console.log('✅ Successfully inserted line items');
      }

      // Update invoice totals
      const taxAmount = invoice.taxRate ? (subtotal * Number(invoice.taxRate) / 100).toString() : "0";
      const total = (subtotal + Number(taxAmount)).toString();

      await db.update(invoices)
        .set({
          subtotal: subtotal.toString(),
          taxAmount,
          total,
        })
        .where(eq(invoices.id, invoice.id));

      console.log('💰 Updated invoice totals:', { subtotal, taxAmount, total });

      // Update invoice number sequence
      await db.update(invoiceSettings)
        .set({
          nextInvoiceNumber: (settings.nextInvoiceNumber || 1) + 1,
        })
        .where(eq(invoiceSettings.userId, session.user.id));

      console.log('🔄 Updated invoice number sequence');

      // Return the created invoice with line items - using manual join instead of relation
      const createdInvoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, invoice.id),
      });

      // Fetch line items separately
      const invoiceLineItemsData = await db.select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoice.id));
      
      console.log('✅ Invoice creation completed successfully!');
      return NextResponse.json({ 
        invoice: { 
          ...createdInvoice, 
          lineItems: invoiceLineItemsData 
        } 
      });
    } catch (error) {
      console.error('❌ Error in invoice creation:', error);
      // If there was an error after creating the invoice, try to delete it
      if (invoice?.id) {
        await db.delete(invoices).where(eq(invoices.id, invoice.id));
        console.log('🗑️ Cleaned up failed invoice');
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 