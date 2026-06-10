import type { ReactNode } from "react";

type TableWrapProps = {
  children: ReactNode;
  compact?: boolean;
};

export function TableWrap({ children, compact = false }: TableWrapProps) {
  return <div className={compact ? "table-wrap table-wrap-compact" : "table-wrap"}>{children}</div>;
}
