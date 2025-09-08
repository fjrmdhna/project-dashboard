const { Client } = require('pg');

async function testDatabaseConnection() {
  const config = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || '5432',
    database: process.env.POSTGRES_DB || 'project_dashboard',
    user: process.env.POSTGRES_USER || 'project_user',
    password: process.env.POSTGRES_PASSWORD || 'projectpassword'
  };

  console.log('🔍 Testing database connection with config:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Password: ${config.password ? '***' : 'not set'}`);
  console.log('');

  const client = new Client(config);

  try {
    console.log('📡 Attempting to connect to PostgreSQL...');
    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL!');

    // Test basic query
    console.log('🧪 Testing basic query...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Query executed successfully!');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);

    // Test database info
    console.log('📊 Getting database information...');
    const dbInfo = await client.query(`
      SELECT 
        current_database() as database_name,
        current_user as current_user,
        inet_server_addr() as server_address,
        inet_server_port() as server_port
    `);
    
    console.log('✅ Database information retrieved:');
    console.log(`   Database: ${dbInfo.rows[0].database_name}`);
    console.log(`   User: ${dbInfo.rows[0].current_user}`);
    console.log(`   Server: ${dbInfo.rows[0].server_address}:${dbInfo.rows[0].server_port}`);

    console.log('\n🎉 All database tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   1. Make sure PostgreSQL container is running');
      console.error('   2. Check if the port is correct');
      console.error('   3. Verify container network configuration');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed:');
      console.error('   1. Check username and password');
      console.error('   2. Verify POSTGRES_USER and POSTGRES_PASSWORD environment variables');
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the test
testDatabaseConnection(); 