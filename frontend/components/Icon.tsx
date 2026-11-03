// Carbon icons by our names (ADR-012; guideline §7.2). Decorative: the word next to it carries the meaning.
import {
  Checkmark,
  CheckmarkFilled,
  CircleDash,
  Close,
  ErrorFilled,
  Information,
  Link,
  ListBulleted,
  Locked,
  Misuse,
  Time,
  Tools,
  WarningAlt,
  WarningHex,
} from "@carbon/icons-react";

const ICONS = {
  check: Checkmark,
  feasible: CheckmarkFilled,
  cross: Close,
  misuse: Misuse, // INFEASIBLE
  alert: ErrorFilled, // SOLVER_FAILED, transport error
  hex: WarningHex, // PHYSICALLY_INADMISSIBLE
  wrench: Tools, // ENGINE_ERROR
  list: ListBulleted, // INPUT_INVALID
  clock: Time, // TIMEOUT, stale
  link: Link, // DEPENDENCY_NOT_MET
  info: Information, // NOT_APPLICABLE, notes
  warn: WarningAlt, // near limit
  ban: Locked, // blocked step
  dot: CircleDash, // not run yet
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const C = ICONS[name];
  return <C size={size} aria-hidden="true" focusable="false" style={{ flex: "none" }} />;
}
