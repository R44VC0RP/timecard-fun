import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db';
import { projects } from '@/app/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, link, userId } = body;
    
    // Create new project
    const [project] = await db.insert(projects).values({
      name,
      link,
      userId,
    }).returning();

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get all projects for user
    const userProjects = await db.query.projects.findMany({
      where: eq(projects.userId, userId),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    return NextResponse.json({ projects: userProjects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 