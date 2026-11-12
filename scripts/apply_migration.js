import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('D:/RDS/Projs/inventory-manager/.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  });
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const migrationSQL = fs.readFileSync('D:/RDS/Projs/inventory-manager/database/migrations/01_inventory_triggers.sql', 'utf8');

  // Split statements by semicolon or execute via RPC / query if supported, or via supabase rpc or direct query
  // Since supabase-js client doesn't have a direct raw SQL execution method without an rpc function, let's create an rpc or execute via supabase REST if possible.
  // Alternatively, let's check if we can execute via supabase.rpc('exec_sql', { sql: migrationSQL }) or similar if an exec function exists, or create one.

  console.log('Applying migration via Supabase RPC or direct SQL check...');
  const { error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL });
  if (error) {
    console.log('RPC exec_sql not found or errored. Trying alternative or reporting instruction:', error.message);
  } else {
    console.log('Migration successfully applied via database RPC!');
  }
}

main().catch(console.error);
