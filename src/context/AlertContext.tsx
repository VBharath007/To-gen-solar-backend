import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertDialogModal, AlertDialogType } from "@/components/ui/AlertDialogModal";

export interface AlertOptions {
  type?: "success" | "error" | "warning" | "info";
  title?: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
}

export interface ConfirmOptions {
  type?: AlertDialogType;
  title?: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

interface AlertContextType {
  showAlert: (options: AlertOptions | string) => Promise<void>;
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}

interface DialogState {
  isOpen: boolean;
  type: AlertDialogType;
  title: string;
  description?: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  showCancel: boolean;
  resolve: (value: any) => void;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const queueRef = useRef<Array<() => void>>([]);

  const processNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      next?.();
    }
  }, []);

  const showAlert = useCallback(
    (options: AlertOptions | string): Promise<void> => {
      return new Promise<void>((resolve) => {
        const config: AlertOptions =
          typeof options === "string" ? { description: options } : options;

        const defaultTitle = {
          success: "Success",
          error: "Error",
          warning: "Warning",
          info: "Information",
        }[config.type || "info"];

        const execute = () => {
          setDialogState({
            isOpen: true,
            type: config.type || "info",
            title: config.title || defaultTitle,
            description: config.description,
            confirmLabel: config.confirmLabel || "OK",
            showCancel: false,
            resolve: () => {
              setDialogState(null);
              resolve();
              setTimeout(processNext, 100);
            },
          });
        };

        if (dialogState?.isOpen) {
          queueRef.current.push(execute);
        } else {
          execute();
        }
      });
    },
    [dialogState, processNext]
  );

  const showConfirm = useCallback(
    (options: ConfirmOptions | string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        const config: ConfirmOptions =
          typeof options === "string" ? { description: options } : options;

        const textToCheck = `${config.title || ""} ${config.confirmLabel || ""} ${
          typeof config.description === "string" ? config.description : ""
        }`;

        // Automatically detect if this confirmation is for saving / updating
        const isSaveAction =
          config.type === "save" ||
          (!config.isDestructive && /save|update|create|publish|submit|generate/i.test(textToCheck));

        // If isDestructive was not explicitly specified:
        // - if it's a save action, it is NOT destructive (false)
        // - if text indicates deletion/removal/clearing/discarding, it is destructive (true)
        // - otherwise default to false
        const isDestructive =
          config.isDestructive !== undefined
            ? config.isDestructive
            : isSaveAction
            ? false
            : /delete|remove|discard|clear|destroy|archive/i.test(textToCheck);

        const dialogType: AlertDialogType =
          config.type === "save" || isSaveAction
            ? "save"
            : config.type || (isDestructive ? "confirmation" : "info");

        const execute = () => {
          setDialogState({
            isOpen: true,
            type: dialogType,
            title: config.title || (isSaveAction ? "Save Changes" : "Confirm Action"),
            description: config.description,
            confirmLabel: config.confirmLabel || (isSaveAction ? "Save Changes" : undefined),
            cancelLabel: config.cancelLabel || "Cancel",
            isDestructive,
            showCancel: true,
            resolve: (result: boolean) => {
              setDialogState(null);
              resolve(result);
              setTimeout(processNext, 100);
            },
          });
        };

        if (dialogState?.isOpen) {
          queueRef.current.push(execute);
        } else {
          execute();
        }
      });
    },
    [dialogState, processNext]
  );

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {dialogState && (
        <AlertDialogModal
          isOpen={dialogState.isOpen}
          type={dialogState.type}
          title={dialogState.title}
          description={dialogState.description}
          confirmLabel={dialogState.confirmLabel}
          cancelLabel={dialogState.cancelLabel}
          isDestructive={dialogState.isDestructive}
          showCancel={dialogState.showCancel}
          onConfirm={() => dialogState.resolve(true)}
          onCancel={() => dialogState.resolve(false)}
          onClose={() => dialogState.resolve(false)}
        />
      )}
    </AlertContext.Provider>
  );
}
