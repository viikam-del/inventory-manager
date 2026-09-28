import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  icon: React.ReactNode
  iconClassName?: string
  description?: string
  trend?: {
    value: string | number
    label?: string
    isPositive?: boolean
  }
}

export function StatCard({
  title,
  value,
  icon,
  iconClassName,
  description,
  trend,
  className,
  ...props
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 hover:shadow-sm hover:border-border flex flex-col justify-between",
        className
      )}
      {...props}
    >
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {value}
            </div>
          </div>
          <div
            className={cn(
              "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border border-border/60 bg-muted/50 text-muted-foreground transition-transform group-hover:scale-105",
              iconClassName
            )}
          >
            {icon}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40 min-h-[28px]">
          {trend ? (
            <>
              <span
                className={cn(
                  "inline-flex items-center font-semibold text-[11px]",
                  trend.isPositive !== false
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {trend.isPositive !== false ? "+" : ""}{trend.value}
              </span>
              {trend.label && <span className="truncate">{trend.label}</span>}
            </>
          ) : description ? (
            <span className="truncate">{description}</span>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
