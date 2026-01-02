"use client";

import Link from "next/link";
import { buttonClassName, ButtonVariant, ButtonSize } from "./buttonStyles";

interface LinkButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  onClick?: () => void;
}

export function LinkButton({
  href,
  children,
  variant,
  size,
  className,
  onClick,
  ...linkProps
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={buttonClassName(variant, size, className)}
      {...linkProps}
    >
      {children}
    </Link>
  );
}
