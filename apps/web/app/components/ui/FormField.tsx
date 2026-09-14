import React from "react";

export interface FormFieldProps {
  id: string;
  label: string;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  children: React.ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  error,
  helperText,
  required = false,
  children,
  className = "",
}) => {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(" ");

  const childWithProps = React.cloneElement(children, {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy || undefined,
  });

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
          {label}
          {required && <span className="text-[#BA1A1A] ml-1">*</span>}
        </label>
      </div>

      {childWithProps}

      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-[#BA1A1A] mt-1">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-sm text-slate-500 mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
