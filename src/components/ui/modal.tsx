"use client"

import * as React from "react"
import { Icons } from "@/components/icons"
import { cn } from "@/lib/utils"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
}

export function Modal({ isOpen, onClose, title, children, className, maxWidth = "md" }: ModalProps) {
  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        className={cn(
          "relative z-50 flex flex-col bg-background p-6 shadow-lg rounded-xl animate-in zoom-in-95",
          {
            "w-full max-w-sm": maxWidth === "sm",
            "w-full max-w-md": maxWidth === "md",
            "w-full max-w-lg": maxWidth === "lg",
            "w-full max-w-xl": maxWidth === "xl",
            "w-full max-w-2xl": maxWidth === "2xl",
            "w-full m-4": maxWidth === "full",
          },
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : <div />}
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted transition-colors ml-auto"
            aria-label="Close"
          >
            <Icons.close className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  )
}
