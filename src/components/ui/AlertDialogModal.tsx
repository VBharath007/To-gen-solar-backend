import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type AlertDialogType = "success" | "error" | "warning" | "info" | "confirmation" | "save";

export interface AlertDialogModalProps {
  isOpen: boolean;
  type?: AlertDialogType;
  title: string;
  description?: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
  showCancel?: boolean;
}

export function AlertDialogModal({
  isOpen,
  type = "info",
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
  onClose,
  showCancel = false,
}: AlertDialogModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        if (onCancel) onCancel();
        else if (onClose) onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, isLoading, onCancel, onClose]);

  if (!isOpen) return null;

  const isConfirmation = type === "confirmation" || showCancel;
  const defaultConfirmLabel = isConfirmation ? (isDestructive ? "Delete" : "Confirm") : "OK";
  const finalConfirmLabel = confirmLabel || defaultConfirmLabel;

  const iconConfig: Record<
    string,
    {
      Icon: React.ElementType;
      containerClass: string;
      iconClass: string;
      containerStyle: React.CSSProperties;
      iconStyle: React.CSSProperties;
    }
  > = {
    save: {
      Icon: CheckCircle2,
      containerClass: "bg-sky-50 dark:bg-sky-950",
      iconClass: "text-sky-600 dark:text-sky-400",
      containerStyle: { backgroundColor: "#e0f2fe" },
      iconStyle: { color: "#0b75b9" },
    },
    success: {
      Icon: CheckCircle2,
      containerClass: "bg-emerald-50 dark:bg-emerald-950",
      iconClass: "text-emerald-600 dark:text-emerald-400",
      containerStyle: { backgroundColor: "#ecfdf5" },
      iconStyle: { color: "#059669" },
    },
    error: {
      Icon: AlertCircle,
      containerClass: "bg-red-50 dark:bg-red-950",
      iconClass: "text-red-600 dark:text-red-400",
      containerStyle: { backgroundColor: "#fef2f2" },
      iconStyle: { color: "#dc2626" },
    },
    warning: {
      Icon: AlertTriangle,
      containerClass: "bg-amber-50 dark:bg-amber-950",
      iconClass: "text-amber-600 dark:text-amber-400",
      containerStyle: { backgroundColor: "#fffbeb" },
      iconStyle: { color: "#d97706" },
    },
    info: {
      Icon: Info,
      containerClass: "bg-blue-50 dark:bg-blue-950",
      iconClass: "text-blue-600 dark:text-blue-400",
      containerStyle: { backgroundColor: "#eff6ff" },
      iconStyle: { color: "#2563eb" },
    },
    confirmation: {
      Icon: isDestructive ? AlertTriangle : HelpCircle,
      containerClass: isDestructive ? "bg-red-50 dark:bg-red-950" : "bg-sky-50 dark:bg-sky-950",
      iconClass: isDestructive ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400",
      containerStyle: isDestructive ? { backgroundColor: "#fef2f2" } : { backgroundColor: "#e0f2fe" },
      iconStyle: isDestructive ? { color: "#dc2626" } : { color: "#0b75b9" },
    },
  };

  const config = iconConfig[type] || iconConfig.confirmation;
  const { Icon, containerClass, iconClass, containerStyle, iconStyle } = config;

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
  };

  const handleCancel = () => {
    if (isLoading) return;
    if (onCancel) onCancel();
    else if (onClose) onClose();
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-desc"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirmation && !isLoading) {
          handleCancel();
        }
      }}
    >
      <div
        className="rounded-2xl bg-surface border shadow-2xl overflow-hidden"
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
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "24px 20px 20px 20px",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", gap: "10px" }}>
          <div
            className={`flex items-center justify-center rounded-full ${containerClass}`}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "4px",
              flexShrink: 0,
              ...containerStyle,
            }}
          >
            <Icon className={`size-6 ${iconClass}`} style={{ width: "26px", height: "26px", ...iconStyle }} />
          </div>
          <h3
            id="alert-dialog-title"
            className="text-center font-bold text-base"
            style={{ margin: 0, color: "var(--text-primary, #0b2546)", fontSize: "16px", lineHeight: "1.3" }}
          >
            {title}
          </h3>
          {description && (
            <div
              id="alert-dialog-desc"
              className="text-center text-muted-foreground text-sm"
              style={{
                margin: "4px 0 0 0",
                color: "var(--text-secondary, #64748b)",
                lineHeight: "1.45",
                fontSize: "13px",
                maxWidth: "270px",
                wordBreak: "break-word",
              }}
            >
              {description}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", width: "100%", marginTop: "20px" }}>
          {isConfirmation && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleCancel}
              disabled={isLoading}
              style={{ flex: 1, height: "40px", fontSize: "14px", fontWeight: 500 }}
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={isDestructive ? "danger" : "primary"}
            className="flex-1"
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={isLoading}
            style={{
              flex: 1,
              height: "40px",
              fontSize: "14px",
              fontWeight: 500,
              backgroundColor: isDestructive ? "var(--danger-color, #dc2626)" : "var(--primary-color, #2e8b38)",
              borderColor: isDestructive ? "var(--danger-color, #dc2626)" : "var(--primary-color, #2e8b38)",
              color: "#ffffff",
            }}
            autoFocus
          >
            {finalConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AlertDialogModal;
