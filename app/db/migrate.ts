import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';

// This is a separate migration script that runs independently
async function main() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    console.log('⏳ Running migrations...');
    
    const start = Date.now();
    await migrate(db, {
      migrationsFolder: './migrations',
    });
    const end = Date.now();

    console.log(`✅ Migrations completed in ${end - start}ms`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error);
    process.exit(1);
  }
}

main();