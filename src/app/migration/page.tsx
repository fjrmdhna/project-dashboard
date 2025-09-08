"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function MigrationPage() {
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState('Ready to start')

  const startMigration = async () => {
    setIsMigrating(true)
    setMigrationStatus('Migration started...')
    
    // Simulate migration process
    setTimeout(() => {
      setMigrationStatus('Fetching data from Supabase...')
    }, 1000)
    
    setTimeout(() => {
      setMigrationStatus('Cleaning data...')
    }, 3000)
    
    setTimeout(() => {
      setMigrationStatus('Inserting to PostgreSQL...')
    }, 5000)
    
    setTimeout(() => {
      setMigrationStatus('Migration completed successfully!')
      setIsMigrating(false)
    }, 7000)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Data Migration Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Migrate data from Supabase to local PostgreSQL database
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {!isMigrating ? (
                <Button onClick={startMigration} className="bg-green-600 hover:bg-green-700">
                  Start Migration
                </Button>
              ) : (
                <Button disabled className="bg-gray-400">
                  Migrating...
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Migration Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Migration Status</CardTitle>
            <CardDescription>
              Current status of the migration process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge className={isMigrating ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'}>
                {isMigrating ? 'In Progress' : 'Ready'}
              </Badge>
              <span className="text-sm text-muted-foreground">{migrationStatus}</span>
            </div>
          </CardContent>
        </Card>

        {/* Migration Info */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Information</CardTitle>
            <CardDescription>
              Details about the migration process and configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <span><strong>Source:</strong> Supabase (Cloud Database)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span><strong>Target:</strong> Local PostgreSQL (Docker)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span><strong>Tables:</strong> site_data, site_data_5g</span>
              </div>
              <div className="flex items-center space-x-2">
                <span><strong>Process:</strong> Fetch → Clean → Insert → Verify</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 