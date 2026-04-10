import { forwardRef } from "react";

export const Input = forwardRef(function Input(
  { className = "", ...props },
  ref,
) {
  return <input ref={ref} className={`app-field w-full ${className}`} {...props} />;
});

export const Textarea = forwardRef(function Textarea(
  { className = "", ...props },
  ref,
) {
  return <textarea ref={ref} className={`app-field w-full ${className}`} {...props} />;
});
