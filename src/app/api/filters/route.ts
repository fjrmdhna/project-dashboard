import { NextResponse } from 'next/server';
import { getFilterOptions } from '@/lib/hermes-5g-utils';

export async function GET() {
  try {
    const filterOptions = await getFilterOptions();
    
    if (filterOptions.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'Failed to fetch filter options' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        vendors: filterOptions.data.vendors,
        programs: filterOptions.data.programs,
        cities: filterOptions.data.cities,
        nanoClusters: filterOptions.data.nanoClusters,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in filters API route:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 }
    );
  }
} 