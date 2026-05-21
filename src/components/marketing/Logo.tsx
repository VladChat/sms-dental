import type { ComponentPropsWithoutRef } from "react";

type LogoProps = {
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  href?: string;
  imageSrc?: "/brand/logo-mark.png" | "/brand/logo-mark.webp";
} & Omit<ComponentPropsWithoutRef<"a">, "href" | "className" | "children">;

export function Logo({
  className,
  imageClassName,
  textClassName,
  href = "/",
  imageSrc = "/brand/logo-mark.webp",
  ...rest
}: LogoProps) {
  return (
    <a href={href} className={className} aria-label="Dental Missed Call Recovery home" {...rest}>
      <img
        src={imageSrc}
        width={44}
        height={44}
        alt="Dental Missed Call Recovery logo mark"
        className={imageClassName}
      />
      <span className={textClassName}>Dental Missed Call Recovery</span>
    </a>
  );
}
