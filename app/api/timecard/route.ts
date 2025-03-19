import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db';
import { clockInRecords, clockOutRecords } from '@/app/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, timestamp } = body;
    
    // Convert incoming timezone timestamp to UTC
    const utcTimestamp = new Date(timestamp);

    if (action === 'clockIn') {
      // Generate a new shift ID
      const shiftId = uuidv4();
      
      // Create clock in record
      await db.insert(clockInRecords).values({
        userId,
        shiftId,
        timestamp: utcTimestamp,
      });

      return NextResponse.json({ success: true, shiftId });

    } else if (action === 'clockOut') {
      const { shiftId } = body;
      
      // Create clock out record
      await db.insert(clockOutRecords).values({
        userId,
        shiftId,
        timestamp: utcTimestamp,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing timecard action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (action === 'status') {
      // Find the most recent clock in/out records for the user
      const lastClockIn = await db.query.clockInRecords.findFirst({
        where: eq(clockInRecords.userId, userId),
        orderBy: (records, { desc }) => [desc(records.timestamp)],
      });

      const lastClockOut = await db.query.clockOutRecords.findFirst({
        where: eq(clockOutRecords.userId, userId),
        orderBy: (records, { desc }) => [desc(records.timestamp)],
      });

      // Determine if user is clocked in
      const isClocked = lastClockIn && (!lastClockOut || new Date(lastClockIn.timestamp) > new Date(lastClockOut.timestamp));

      return NextResponse.json({
        isClocked,
        lastClockIn: isClocked ? lastClockIn : null,
      });

    } else if (action === 'shifts') {
      // Get all shifts for the user
      const clockIns = await db.query.clockInRecords.findMany({
        where: eq(clockInRecords.userId, userId),
      });

      const clockOuts = await db.query.clockOutRecords.findMany({
        where: eq(clockOutRecords.userId, userId),
      });

      // Match clock ins with clock outs
      const shifts = clockIns.map(clockIn => {
        const clockOut = clockOuts.find(out => out.shiftId === clockIn.shiftId);
        return {
          shiftId: clockIn.shiftId,
          clockIn: clockIn.timestamp,
          clockOut: clockOut?.timestamp || null,
          duration: clockOut 
            ? (new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime()) / 1000
            : null
        };
      });

      return NextResponse.json({ shifts });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching timecard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 