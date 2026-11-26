import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { controlBase, controlState, Field } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ label, hint, error, className, containerClassName, required, id, ref, rows = 3, ...props }: TextareaProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={containerClassName}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(controlBase, controlState(Boolean(error)), 'resize-y px-3.5 py-2.5 leading-relaxed', className)}
        {...props}
      />
    </Field>
  );
}
