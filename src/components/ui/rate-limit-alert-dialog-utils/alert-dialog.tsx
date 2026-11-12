"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface AlertDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = createContext<AlertDialogContextType | null>(null);

export function useAlertDialogContext() {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error("AlertDialog components must be used within an AlertDialog");
  }
  return context;
}

interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: AlertDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

interface TriggerProps {
  render?: React.ReactElement;
  children?: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

export function AlertDialogTrigger({ render, children, asChild, className }: TriggerProps) {
  const { setOpen } = useAlertDialogContext();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  if (render) {
    return React.cloneElement(render as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (render as any).props.onClick?.(e);
        handleClick(e);
      },
      className: cn((render as any).props.className, className),
    });
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<any>).props.onClick?.(e);
        handleClick(e);
      },
      className: cn((children as React.ReactElement<any>).props.className, className),
    });
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

interface ContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogContent({ children, className }: ContentProps) {
  const { open, setOpen } = useAlertDialogContext();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        ref={contentRef}
        className={cn(
          "rounded-2xl bg-surface border shadow-2xl overflow-hidden",
          className
        )}
        style={{
          width: "320px",
          minWidth: "280px",
          maxWidth: "calc(100vw - 32px)",
          minHeight: "310px",
          margin: "0 auto",
          backgroundColor: "var(--bg-surface, #ffffff)",
          border: "1px solid var(--border-color, #e2e8f0)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          animation: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function AlertDialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn("text-center font-semibold text-base", className)}
      style={{ margin: 0, color: "var(--text-primary, #0b2546)" }}
    >
      {children}
    </h3>
  );
}

export function AlertDialogDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn("text-center text-muted-foreground text-sm", className)}
      style={{ margin: 0, color: "var(--text-secondary, #64748b)", lineHeight: "1.4" }}
    >
      {children}
    </p>
  );
}

export function AlertDialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-row items-center justify-center gap-3 w-full", className)}
      style={{ display: "flex", gap: "12px", width: "100%" }}
    >
      {children}
    </div>
  );
}

export function AlertDialogClose({
  render,
  children,
  asChild,
  className,
  onClick,
}: {
  render?: React.ReactElement;
  children?: React.ReactNode;
  asChild?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler;
}) {
  const { setOpen } = useAlertDialogContext();

  const handleClick = (e: React.MouseEvent) => {
    onClick?.(e);
    setOpen(false);
  };

  if (render) {
    return React.cloneElement(render as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (render as any).props.onClick?.(e);
        handleClick(e);
      },
      className: cn((render as any).props.className, className),
      children: (render as any).props.children || children,
    });
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<any>).props.onClick?.(e);
        handleClick(e);
      },
      className: cn((children as React.ReactElement<any>).props.className, className),
    });
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

export const AlertDialogAction = AlertDialogClose;
export const AlertDialogCancel = AlertDialogClose;
