import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
        {
          "border-primary/20 bg-primary/10 text-primary hover:bg-primary/20": variant === "default",
          "border-border bg-muted/60 text-muted-foreground hover:bg-muted": variant === "secondary",
          "border-destructive/20 bg-destructive/10 text-destructive dark:bg-destructive/20 hover:bg-destructive/25": variant === "destructive",
          "border-border text-foreground bg-background hover:bg-muted/50": variant === "outline",
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/20 hover:bg-emerald-500/25": variant === "success",
          "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20 hover:bg-amber-500/25": variant === "warning",
          "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400 dark:bg-blue-500/20 hover:bg-blue-500/25": variant === "info",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
