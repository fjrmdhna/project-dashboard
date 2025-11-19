"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center justify-center flex-shrink-0">
            <Link href="/" className="flex items-center justify-center">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <Image
                  src="/logo-indosat-putih.png"
                  alt="Indosat Ooredoo Hutchison Logo"
                  width={112}
                  height={112}
                  className="object-contain"
                />
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden items-center space-x-8 md:flex">
            <Link
              href="#projects"
              className="font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              Projects
            </Link>
            <Link
              href="#dashboard"
              className="font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="#analytics"
              className="font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              Analytics
            </Link>
            <Link
              href="#reports"
              className="font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              Reports
            </Link>
            <Link
              href="#team"
              className="font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              Team
            </Link>
          </div>

          {/* CTA Button */}
          <div className="flex items-center">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Login
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
