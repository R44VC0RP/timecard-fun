import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db';
import { projects } from '@/app/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { options } from '../auth/[...nextauth]/options';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, link, userId } = body;
    
    // Verify the user is creating a project for themselves
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create new project
    const result = await db.insert(projects).values({
      name,
      link,
      userId,
    }).returning();

    return NextResponse.json({ project: result[0] });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user is requesting their own projects
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all projects for user
    const userProjects = await db.select().from(projects).where(eq(projects.userId, userId));

    return NextResponse.json({ projects: userProjects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 