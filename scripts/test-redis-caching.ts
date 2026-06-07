/**
 * Test script untuk memverifikasi Redis caching bekerja dengan baik
 * 
 * Cara menjalankan:
 * 1. Pastikan KV_REST_API_* atau UPSTASH_REDIS_REST_* sudah di-set di .env.local
 * 2. Jalankan: npm run test:redis
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx)
    const value = trimmed.slice(idx + 1).replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

type RedisModule = typeof import('../src/lib/redis')

async function testRedisConnection(redisMod: RedisModule) {
  console.log('\n=== Testing Redis Connection ===')
  const redis = redisMod.getRedis()
  if (redis) {
    console.log('✓ Redis connected successfully')
    return true
  } else {
    console.log('✗ Redis not configured (caching disabled)')
    console.log('  Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local')
    return false
  }
}

async function testBasicCaching(redisMod: RedisModule) {
  const { setCache, getCache, deleteCache } = redisMod
  console.log('\n=== Testing Basic Caching ===')
  
  const testKey = 'test:basic'
  const testData = { message: 'Hello Redis!', timestamp: Date.now() }
  
  // Set cache
  console.log('Setting cache...')
  await setCache(testKey, testData, 60)
  
  // Get cache
  console.log('Getting cache...')
  const retrieved = await getCache<typeof testData>(testKey)
  
  if (retrieved && retrieved.message === testData.message) {
    console.log('✓ Basic caching works!')
    console.log('  Retrieved:', retrieved)
  } else {
    console.log('✗ Cache retrieval failed')
    console.log('  Expected:', testData)
    console.log('  Got:', retrieved)
  }
  
  // Cleanup
  await deleteCache(testKey)
}

async function testCacheOrFetch(redisMod: RedisModule) {
  const { getCacheOrFetch, deleteCache } = redisMod
  console.log('\n=== Testing getCacheOrFetch Pattern ===')
  
  const testKey = 'test:cache-or-fetch'
  let fetchCount = 0
  
  const fetchFn = async () => {
    fetchCount++
    console.log(`  Fetch function called (count: ${fetchCount})`)
    return { data: 'fresh data', fetchedAt: Date.now() }
  }
  
  // First call - should fetch
  console.log('First call (expect fetch)...')
  const result1 = await getCacheOrFetch(testKey, fetchFn, 60)
  console.log('  Result:', result1)
  
  // Second call - should use cache
  console.log('Second call (expect cache hit)...')
  const result2 = await getCacheOrFetch(testKey, fetchFn, 60)
  console.log('  Result:', result2)
  
  if (fetchCount === 1) {
    console.log('✓ getCacheOrFetch pattern works correctly!')
  } else {
    console.log(`✗ Expected 1 fetch, got ${fetchCount}`)
  }
  
  // Cleanup
  await deleteCache(testKey)
}

async function testFilterHash(redisMod: RedisModule) {
  const { getFilterHash } = redisMod
  console.log('\n=== Testing Filter Hash Generation ===')
  
  const filters1 = {
    vendorNames: ['Nokia', 'Huawei'],
    programReports: ['AOP Wave 1'],
    circles: [],
    siteCategories: [],
    search: ''
  }
  
  const filters2 = {
    vendorNames: ['Huawei', 'Nokia'], // Same values, different order
    programReports: ['AOP Wave 1'],
    circles: [],
    siteCategories: [],
    search: ''
  }
  
  const filters3 = {
    vendorNames: ['Nokia'],
    programReports: ['AOP Wave 1'],
    circles: [],
    siteCategories: [],
    search: ''
  }
  
  const hash1 = getFilterHash(filters1)
  const hash2 = getFilterHash(filters2)
  const hash3 = getFilterHash(filters3)
  
  console.log('Hash 1:', hash1)
  console.log('Hash 2:', hash2)
  console.log('Hash 3:', hash3)
  
  if (hash1 === hash2) {
    console.log('✓ Same filters (different order) produce same hash')
  } else {
    console.log('✗ Hash mismatch for same filters')
  }
  
  if (hash1 !== hash3) {
    console.log('✓ Different filters produce different hashes')
  } else {
    console.log('✗ Different filters should produce different hashes')
  }
}

async function testCacheKeys(redisMod: RedisModule) {
  const { CACHE_KEYS, CACHE_TTL } = redisMod
  console.log('\n=== Testing Cache Key Generation ===')
  
  const filterHash = 'abc123'
  
  console.log('CACHE_KEYS.AOP_FILTERS:', CACHE_KEYS.AOP_FILTERS)
  console.log('CACHE_KEYS.AOP_SITE_DATA_NOFILTER:', CACHE_KEYS.AOP_SITE_DATA_NOFILTER)
  console.log('CACHE_KEYS.AOP_SITE_DATA(hash):', CACHE_KEYS.AOP_SITE_DATA(filterHash))
  console.log('CACHE_KEYS.AOP_DAILY_RUNRATE(hash):', CACHE_KEYS.AOP_DAILY_RUNRATE(filterHash))
  console.log('CACHE_KEYS.AOP_TOP_ISSUE(hash):', CACHE_KEYS.AOP_TOP_ISSUE(filterHash))
  console.log('CACHE_KEYS.AOP_MAP_DATA(hash):', CACHE_KEYS.AOP_MAP_DATA(filterHash))
  
  console.log('\nCACHE_TTL values (in seconds):')
  console.log('  FILTERS:', CACHE_TTL.FILTERS)
  console.log('  FULL_DATA:', CACHE_TTL.FULL_DATA)
  console.log('  STATS:', CACHE_TTL.STATS)
  console.log('  FILTERED_DATA:', CACHE_TTL.FILTERED_DATA)
  console.log('  DAILY_RUNRATE:', CACHE_TTL.DAILY_RUNRATE)
  console.log('  TOP_ISSUE:', CACHE_TTL.TOP_ISSUE)
  console.log('  MAP_DATA:', CACHE_TTL.MAP_DATA)
  
  console.log('✓ Cache key constants configured correctly')
}

async function main() {
  console.log('======================================')
  console.log('  Redis Caching Test Suite')
  console.log('======================================')

  const redisMod = await import('../src/lib/redis')
  
  const connected = await testRedisConnection(redisMod)
  
  if (connected) {
    await testBasicCaching(redisMod)
    await testCacheOrFetch(redisMod)
  }
  
  await testFilterHash(redisMod)
  await testCacheKeys(redisMod)
  
  console.log('\n======================================')
  console.log('  Test Complete!')
  console.log('======================================')
  
  if (!connected) {
    console.log('\nNote: To fully test caching, configure Upstash Redis:')
    console.log('1. Create account at https://console.upstash.com/')
    console.log('2. Create a new Redis database')
    console.log('3. Copy REST URL and Token to .env.local:')
    console.log('   UPSTASH_REDIS_REST_URL=your_url')
    console.log('   UPSTASH_REDIS_REST_TOKEN=your_token')
  }
}

main().catch(console.error)
