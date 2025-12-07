/**
 * Create playbooks table in Supabase
 * Run: node scripts/create-playbooks-table.js
 */

const { Client } = require('pg');

// Use Supabase pooler (session mode) for IPv4 compatibility
const connectionString = 'postgresql://postgres.oagcozlzpfedjnetpjus:gopeace123!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';

const createTableSQL = `
CREATE TABLE IF NOT EXISTS playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT '기타',
    difficulty TEXT DEFAULT '보통',
    estimated_time TEXT,
    keywords TEXT[] DEFAULT '{}',
    version TEXT DEFAULT '1.0.0',
    author TEXT DEFAULT 'admin',
    steps JSONB DEFAULT '[]',
    variables JSONB DEFAULT '{}',
    preconditions JSONB DEFAULT '[]',
    error_handlers JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    is_published BOOLEAN DEFAULT FALSE,
    order_index INT DEFAULT 0,
    execution_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    checksum TEXT,
    yaml_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_category ON playbooks(category);
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON playbooks(status);
CREATE INDEX IF NOT EXISTS idx_playbooks_is_published ON playbooks(is_published);
CREATE INDEX IF NOT EXISTS idx_playbooks_playbook_id ON playbooks(playbook_id);

ALTER TABLE playbooks DISABLE ROW LEVEL SECURITY;
`;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected!');

    console.log('Creating playbooks table...');
    await client.query(createTableSQL);
    console.log('Table created successfully!');

    // Verify
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'playbooks'");
    if (result.rows.length > 0) {
      console.log('✓ Verified: playbooks table exists');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
