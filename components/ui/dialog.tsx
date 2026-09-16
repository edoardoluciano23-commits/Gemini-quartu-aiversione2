import * as React from "react"

export function Dialog({ open, onOpenChange, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative z-50 w-full max-w-lg bg-background p-6 shadow-lg sm:rounded-lg border">
        <button onClick={() => onOpenChange(false)} className="absolute right-4 top-4">X</button>
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ children, className }: any) {
  return <div className={className}>{children}</div>
}

export function DialogHeader({ children }: any) {
  return <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">{children}</div>
}

export function DialogTitle({ children, className }: any) {
  return <h2 className={className}>{children}</h2>
}

export function DialogDescription({ children, className }: any) {
  return <p className={className}>{children}</p>
}
