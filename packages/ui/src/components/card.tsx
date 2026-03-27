import { type HTMLAttributes, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  footer?: React.ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ title, description, footer, children, ...props }, ref) => {
    return (
      <div ref={ref} data-component="card" {...props}>
        {(title || description) && (
          <div data-part="header">
            {title && <h3 data-part="title">{title}</h3>}
            {description && <p data-part="description">{description}</p>}
          </div>
        )}
        <div data-part="content">{children}</div>
        {footer && <div data-part="footer">{footer}</div>}
      </div>
    );
  },
);

Card.displayName = "Card";
