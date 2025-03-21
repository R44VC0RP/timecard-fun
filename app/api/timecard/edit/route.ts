import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db';
import { clockInRecords, clockOutRecords } from '@/app/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, shiftId, clockInTime, clockOutTime } = body;
    
    // Verify the user is operating on their own data
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update clock in time if provided
    if (clockInTime) {
      await db.update(clockInRecords)
        .set({ 
          timestamp: new Date(clockInTime),
          // Update the dateUpdated field
          createdAt: new Date()
        })
        .where(and(
          eq(clockInRecords.shiftId, shiftId),
          eq(clockInRecords.userId, userId)
        ));
    }

    // Update clock out time if provided
    if (clockOutTime) {
      // Check if there's an existing clock out record
      const existingClockOut = await db.query.clockOutRecords.findFirst({
        where: and(
          eq(clockOutRecords.shiftId, shiftId),
          eq(clockOutRecords.userId, userId)
        ),
      });

      if (existingClockOut) {
        // Update existing clock out record
        await db.update(clockOutRecords)
          .set({ 
            timestamp: new Date(clockOutTime),
            // Update the dateUpdated field
            createdAt: new Date()
          })
          .where(and(
            eq(clockOutRecords.shiftId, shiftId),
            eq(clockOutRecords.userId, userId)
          ));
      } else {
        // Create new clock out record
        await db.insert(clockOutRecords).values({
          userId,
          shiftId,
          timestamp: new Date(clockOutTime),
          projectId: null
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating shift times:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 