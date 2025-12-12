const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'db.mjbkbaypssfqkufycetd.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'NjTxoP5TTslsQOvg',
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Read and execute the SQL file
    const sql = fs.readFileSync('setup-database.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        try {
          await client.query(stmt);
          // Extract what we're creating for logging
          const match = stmt.match(/CREATE\s+(TABLE|INDEX|POLICY|FUNCTION|TRIGGER|OR REPLACE FUNCTION)\s+(?:IF NOT EXISTS\s+)?["\']?(\w+)/i);
          if (match) {
            console.log(`✅ Created ${match[1]}: ${match[2]}`);
          } else if (stmt.includes('ALTER TABLE')) {
            const tableMatch = stmt.match(/ALTER TABLE\s+(\w+)/i);
            if (tableMatch) console.log(`✅ Altered table: ${tableMatch[1]}`);
          } else if (stmt.includes('DROP TRIGGER')) {
            console.log(`✅ Dropped old trigger`);
          }
        } catch (err) {
          // Ignore "already exists" errors
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.log(`⚠️  Warning: ${err.message.split('\n')[0]}`);
          }
        }
      }
    }

    console.log('\n🎉 Database setup complete!');
    
    // Verify tables exist
    console.log('\n📋 Verifying tables...');
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tables in database:', result.rows.map(r => r.table_name).join(', '));

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

createTables();
