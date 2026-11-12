import React from "react";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

export interface AlertProps {
  type?: "success" | "error" | "warning" | "info";
  message?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  children?: React.ReactNode;
  className?: string;
}

const typeStyles = {
  success: "bg-green-100 text-green-800 border-green-300",
  error: "bg-red-100 text-red-800 border-red-300",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
  info: "bg-blue-100 text-blue-800 border-blue-300",
};

const typeIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const fadeInBlur: Variants = {
  initial: { opacity: 0, filter: "blur(10px)", y: 10, rotate: 0 },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    rotate: 0,
    transition: { duration: 0.2, ease: "easeInOut" },
  },
};

const Alert: React.FC<AlertProps> = ({
  type = "info",
  message = "This is an alert message.",
  onClick,
  children,
  className,
}) => {
  const Icon = typeIcons[type];

  return (
    <motion.div
      className={cn(
        "border px-4 py-3 flex gap-x-2 items-center rounded-2xl text-sm",
        typeStyles[type],
        className
      )}
      role="alert"
      variants={fadeInBlur}
      initial="initial"
      animate="animate"
      onClick={onClick}
    >
      {Icon && <Icon style={{ width: '18px', height: '18px', minWidth: '18px', flexShrink: 0 }} />}
      <span className="font-bold capitalize">{type}:</span>
      <span>{children || message}</span>
    </motion.div>
  );
};

export default Alert;
export { Alert };
