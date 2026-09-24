import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  icon: React.ReactNode
  iconClassName?: string
}

export function StatCard({ title, value, icon, iconClassName, className, ...props }: StatCardProps) {
  return (
    <Card className={cn("transition-all hover:shadow-md", className)} {...props}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2 rounded-lg text-xl flex items-center justify-center bg-muted text-muted-foreground", iconClassName)}>
            {icon}
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live</span>
        </div>
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}
