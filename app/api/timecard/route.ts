import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db';
import { clockInRecords, clockOutRecords } from '@/app/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, userId, timestamp, shiftId } = body;
    
    // Verify the user is operating on their own data
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'clockIn') {
      const result = await db.insert(clockInRecords).values({
        userId,
        shiftId: crypto.randomUUID(),
        timestamp: new Date(timestamp),
      }).returning();

      return NextResponse.json({ shiftId: result[0].shiftId });
    } else if (action === 'clockOut') {
      await db.insert(clockOutRecords).values({
        userId,
        shiftId,
        timestamp: new Date(timestamp),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in timecard API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user is requesting their own data
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'status') {
      // Get the last clock-in record for the user
      const lastClockIn = await db.query.clockInRecords.findFirst({
        where: eq(clockInRecords.userId, userId),
        orderBy: (clockInRecords, { desc }) => [desc(clockInRecords.timestamp)],
      });

      if (!lastClockIn) {
        return NextResponse.json({ isClocked: false });
      }

      // Check if there's a matching clock-out record
      const matchingClockOut = await db.query.clockOutRecords.findFirst({
        where: and(
          eq(clockOutRecords.userId, userId),
          eq(clockOutRecords.shiftId, lastClockIn.shiftId)
        ),
      });

      return NextResponse.json({
        isClocked: !matchingClockOut,
        lastClockIn: !matchingClockOut ? lastClockIn : null,
      });
    } else if (action === 'shifts') {
      const clockIns = await db.select().from(clockInRecords).where(eq(clockInRecords.userId, userId));
      const clockOuts = await db.select().from(clockOutRecords).where(eq(clockOutRecords.userId, userId));

      const shifts = clockIns.map(clockIn => {
        const clockOut = clockOuts.find(out => out.shiftId === clockIn.shiftId);
        return {
          shiftId: clockIn.shiftId,
          clockIn: clockIn.timestamp,
          clockOut: clockOut?.timestamp || null,
          duration: clockOut ? Math.floor((clockOut.timestamp.getTime() - clockIn.timestamp.getTime()) / 1000) : null,
          projectId: clockIn.projectId,
        };
      });

      return NextResponse.json({ shifts });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in timecard API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shiftId = searchParams.get('shiftId');
    const userId = searchParams.get('userId');

    if (!shiftId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify the user is operating on their own data
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete clock in and clock out records for the shift
    await db.delete(clockInRecords)
      .where(and(
        eq(clockInRecords.shiftId, shiftId),
        eq(clockInRecords.userId, userId)
      ));

    await db.delete(clockOutRecords)
      .where(and(
        eq(clockOutRecords.shiftId, shiftId),
        eq(clockOutRecords.userId, userId)
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting shift:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 