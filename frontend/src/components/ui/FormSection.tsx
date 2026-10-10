import { type ReactNode, useId } from "react";

interface FormSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
  children: ReactNode;
}

export default function FormSection({
  title,
  subtitle,
  icon,
  className,
  headingLevel = "h2",
  children,
}: FormSectionProps) {
  const autoId = useId();
  const headingId = `form-section-${autoId}`;
  const HeadingTag = headingLevel;

  return (
    <section
      aria-labelledby={headingId}
      className={`mb-6 rounded-lg bg-white p-5 shadow ${className ?? ""}`.trim()}
    >
      <HeadingTag
        id={headingId}
        className="mb-3 text-lg font-semibold text-gray-700"
      >
        {icon && <span className="mr-2">{icon}</span>}
        {title}
      </HeadingTag>
      {subtitle && <p className="mb-3 text-sm text-gray-500">{subtitle}</p>}
      {children}
    </section>
  );
}
