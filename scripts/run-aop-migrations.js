/**
 * Script untuk menjalankan AOP performance migrations
 * 
 * Usage:
 *   node scripts/run-aop-migrations.js
 * 
 * Atau dengan environment variables:
 *   SUPABASE_URL=your_url SUPABASE_SERVICE_KEY=your_key node scripts/run-aop-migrations.js
 */

const fs = require('fs');
const path = require('path');

// Baca environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL dan SUPABASE_SERVICE_KEY harus diset');
  console.error('Set environment variables atau edit script ini');
  process.exit(1);
}

async function runMigration(filePath, description) {
  console.log(`\n📝 Running migration: ${description}`);
  console.log(`   File: ${filePath}\n`);
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  try {
    // Split SQL by semicolon untuk execute per statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    // Use fetch to call Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql: sql })
    });
    
    if (!response.ok) {
      // Fallback: try direct SQL execution via PostgREST
      console.log('   ⚠️  Direct RPC tidak tersedia, gunakan Supabase Dashboard SQL Editor');
      console.log('   📋 Copy SQL berikut ke Supabase Dashboard:\n');
      console.log(sql);
      return false;
    }
    
    const result = await response.json();
    console.log('   ✅ Migration berhasil!');
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    console.log('\n   📋 Alternatif: Copy SQL berikut ke Supabase Dashboard SQL Editor:\n');
    console.log(sql);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting AOP Performance Migrations\n');
  console.log('='.repeat(60));
  
  const migrationsDir = path.join(__dirname, '..', 'database');
  
  // Run indexes migration
  const indexesFile = path.join(migrationsDir, 'aop_performance_indexes.sql');
  if (fs.existsSync(indexesFile)) {
    await runMigration(indexesFile, 'AOP Performance Indexes');
  } else {
    console.error(`❌ File tidak ditemukan: ${indexesFile}`);
  }
  
  // Run function migration
  const functionFile = path.join(migrationsDir, 'aop_stats_function.sql');
  if (fs.existsSync(functionFile)) {
    await runMigration(functionFile, 'AOP Stats Function');
  } else {
    console.error(`❌ File tidak ditemukan: ${functionFile}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Migration selesai!');
  console.log('\n📝 Catatan:');
  console.log('   Jika script ini tidak berhasil, gunakan Supabase Dashboard SQL Editor');
  console.log('   untuk menjalankan SQL secara manual.');
}

main().catch(console.error);
