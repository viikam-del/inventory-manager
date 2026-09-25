import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "success" | "warning"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const classes = cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
      {
        "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98]": variant === "default",
        "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98]": variant === "destructive",
        "border border-border bg-card/60 backdrop-blur-sm text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-border/80 active:scale-[0.98]": variant === "outline",
        "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-[0.98]": variant === "secondary",
        "hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.98]": variant === "ghost",
        "text-primary underline-offset-4 hover:underline p-0 h-auto": variant === "link",
        "bg-success text-success-foreground shadow-sm hover:bg-success/90 active:scale-[0.98]": variant === "success",
        "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90 active:scale-[0.98]": variant === "warning",

        "h-9 px-4 py-2": size === "default",
        "h-8 rounded-md px-3 text-xs": size === "sm",
        "h-10 rounded-lg px-6 text-base": size === "lg",
        "h-9 w-9 p-0": size === "icon",
      },
      className
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
        ...props,
      });
    }

    return (
      <button
        className={classes}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
