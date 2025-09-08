"use client"

import { Zap, Settings, Star, CloudLightning, Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

const features = [
  {
    icon: CloudLightning,
    title: "Fusion",
    description: "Advanced data integration and synchronization capabilities for seamless system connectivity and real-time updates across all platforms.",
    href: "#"
  },
  {
    icon: Settings,
    title: "AOP",
    description: "Aspect-Oriented Programming framework providing cross-cutting concerns management and modular architecture for scalable applications.",
    href: "#"
  },
  {
    icon: Star,
    title: "Hermes",
    description: "High-performance messaging and communication system ensuring reliable data transmission and optimal network performance.",
    href: "/hermes-5g"
  },
  {
    icon: Zap,
    title: "CME",
    description: "Comprehensive monitoring and analytics engine delivering real-time insights and performance metrics for operational excellence.",
    href: "#"
  },
  {
    icon: Database,
    title: "Migration",
    description: "Data migration dashboard for transferring data from Supabase to local PostgreSQL with real-time progress monitoring.",
    href: "/migration"
  }
]

export function FeaturesSection() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Built to cover your needs
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Comprehensive solutions designed to address every aspect of your business requirements with cutting-edge technology and proven methodologies.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {features.map((feature, index) => {
            if (feature.href && feature.href !== "#") {
              return (
                <Link key={index} href={feature.href} className="block">
                  <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-border cursor-pointer">
                    <CardHeader className="text-center pb-4">
                      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                        <feature.icon className="w-8 h-8 text-primary" />
                      </div>
                      <CardTitle className="text-xl font-semibold text-foreground">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <CardDescription className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              )
            }
            
            return (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-border">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                    <feature.icon className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
} 