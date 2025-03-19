import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db';
import { userConfig, invoiceSettings } from '@/app/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [userConfigData, invoiceSettingsData] = await Promise.all([
      db.query.userConfig.findFirst({
        where: eq(userConfig.userId, session.user.id),
      }),
      db.query.invoiceSettings.findFirst({
        where: eq(invoiceSettings.userId, session.user.id),
      }),
    ]);

    return NextResponse.json({
      userConfig: userConfigData || null,
      invoiceSettings: invoiceSettingsData || null,
    });
  } catch (error) {
    console.error('Error fetching user config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userConfig: userConfigData, invoiceSettings: invoiceSettingsData } = body;

    // Update or create user config
    if (userConfigData) {
      await db
        .insert(userConfig)
        .values({
          ...userConfigData,
          userId: session.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userConfig.userId,
          set: {
            ...userConfigData,
            updatedAt: new Date(),
          },
        });
    }

    // Update or create invoice settings
    if (invoiceSettingsData) {
      await db
        .insert(invoiceSettings)
        .values({
          ...invoiceSettingsData,
          userId: session.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: invoiceSettings.userId,
          set: {
            ...invoiceSettingsData,
            updatedAt: new Date(),
          },
        });
    }

    // Fetch and return updated data
    const [updatedUserConfig, updatedInvoiceSettings] = await Promise.all([
      db.query.userConfig.findFirst({
        where: eq(userConfig.userId, session.user.id),
      }),
      db.query.invoiceSettings.findFirst({
        where: eq(invoiceSettings.userId, session.user.id),
      }),
    ]);

    return NextResponse.json({
      userConfig: updatedUserConfig,
      invoiceSettings: updatedInvoiceSettings,
    });
  } catch (error) {
    console.error('Error updating user config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 