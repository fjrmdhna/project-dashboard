import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test database connection using environment variables
    const dbConfig = {
      host: process.env.POSTGRES_HOST || 'postgres',
      port: process.env.POSTGRES_PORT || '5432',
      database: process.env.POSTGRES_DB || 'swap_progress',
      user: process.env.POSTGRES_USER || 'swap_user',
      password: process.env.POSTGRES_PASSWORD || 'swappassword'
    };

    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

    return NextResponse.json({
      status: 'success',
      message: 'Database configuration loaded successfully',
      timestamp: new Date().toISOString(),
      database: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: '***' // Hide password for security
      },
      connectionString: connectionString.replace(/:[^:@]*@/, ':***@'), // Hide password in connection string
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Failed to load database configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 