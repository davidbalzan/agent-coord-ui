import type { ButtonHTMLAttributes } from "react";

type HoloButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function HoloButton({ className, ...rest }: HoloButtonProps) {
  return (
    <button
      className={`holo-btn${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}
