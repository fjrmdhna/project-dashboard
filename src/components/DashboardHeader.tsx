"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'

export function DashboardHeader() {
  const [currentDateTime, setCurrentDateTime] = useState('')

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
      setCurrentDateTime(now.toLocaleDateString('en-US', options))
    }

    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-purple-900 text-white">
      <div className="container mx-auto px-3 py-1">
        <div className="flex items-center justify-between">
          {/* Logo Indosat */}
          <div className="flex items-center">
            <div className="relative">
              <Image
                src="/logo indosat putih.png"
                alt="Indosat Ooredoo Hutchison"
                width={60}
                height={60}
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <div className="text-center flex-1">
            <h1 className="text-xl font-bold tracking-wide">
              DASHBOARD HERMES H2 2025
            </h1>
            <div className="text-blue-200 text-[10px]">
              Real-time 5G Network Performance Monitor
            </div>
          </div>

          {/* Date */}
          <div className="text-right">
            <div className="text-xs font-semibold">
              {currentDateTime}
            </div>
            <div className="text-[10px] text-blue-200">
              Jakarta Time (WIB)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 