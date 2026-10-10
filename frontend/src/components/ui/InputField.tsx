import { type ChangeEvent, type FocusEvent, useId } from "react";

interface InputFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  className?: string;
  id?: string;
}

export default function InputField({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  className,
  id: idProp,
}: InputFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-gray-600"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full min-h-[44px] rounded-lg border px-3 py-2 text-base placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
