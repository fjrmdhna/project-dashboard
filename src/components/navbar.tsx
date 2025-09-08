"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <Link href="/" className="flex items-center justify-center">
              <div className="w-28 h-28 relative flex items-center justify-center">
                <Image
                  src="/logo indosat putih.png"
                  alt="Indosat Ooredoo Hutchison Logo"
                  width={112}
                  height={112}
                  className="object-contain"
                />
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="#projects" 
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              Projects
            </Link>
            <Link 
              href="#dashboard" 
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              Dashboard
            </Link>
            <Link 
              href="#analytics" 
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              Analytics
            </Link>
            <Link 
              href="#reports" 
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              Reports
            </Link>
            <Link 
              href="#team" 
              className="text-foreground/70 hover:text-foreground transition-colors font-medium"
            >
              Team
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              Login
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Join Project
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
} 