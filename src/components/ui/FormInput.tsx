import { useId, type ReactNode, type ChangeEventHandler } from 'react';
import { theme } from '../../config/theme';

interface FormInputProps {
  label?: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  error?: string;
  icon?: ReactNode;
}

export default function FormInput({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  icon,
}: FormInputProps) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div className="mb-3">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: theme.colors.grayDark }}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-lg text-sm outline-none transition-colors duration-200 ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2.5`}
          style={{
            backgroundColor: theme.colors.bgCard,
            border: `1px solid ${error ? theme.colors.danger : theme.colors.border}`,
            color: theme.colors.white,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error
              ? theme.colors.danger
              : theme.colors.border;
          }}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs mt-1" style={{ color: theme.colors.danger }}>
          {error}
        </p>
      )}
    </div>
  );
}
