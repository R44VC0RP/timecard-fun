import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db';
import { clockInRecords, clockOutRecords } from '@/app/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shiftId, projectId } = body;
    
    // Update both clock in and clock out records for the shift
    await db.update(clockInRecords)
      .set({ projectId })
      .where(eq(clockInRecords.shiftId, shiftId));

    await db.update(clockOutRecords)
      .set({ projectId })
      .where(eq(clockOutRecords.shiftId, shiftId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating shift project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 