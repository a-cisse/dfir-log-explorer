import { CircleCheck, CircleAlert, CircleX } from "lucide-react";
import type { ParseStatus } from "./types";
export const statusLabels = {
  parsed: "Parsed",
  partial: "Partial",
  unparsed: "Unparsed",
};
export function ParsingStatusBadge({ status }: { status: ParseStatus }) {
  const Icon =
    status === "parsed"
      ? CircleCheck
      : status === "partial"
        ? CircleAlert
        : CircleX;
  return (
    <span className={`parsing-badge ${status}`}>
      <Icon size={12} />
      {statusLabels[status]}
    </span>
  );
}
