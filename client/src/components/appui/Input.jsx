export function Input({ className = "", ...props }) {
  return (
    <input
      className={`app-field w-full ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`app-field w-full ${className}`}
      {...props}
    />
  );
}
