"use client";
// Delete confirmation (plan F2, user 2026-11-14): every removal asks first, because there is no undo
// (Doc 7 §7). Focus starts on Cancel and returns to the button that asked (Doc 7 §8); Carbon's Modal
// traps focus while open. The dialog is mounted only while asking, so its "Delete" button never
// competes with the row buttons ("Delete INV1") for an accessible name.
import { Modal } from "@carbon/react";
import { useRef, useState } from "react";

type Ask = { title: string; body: string; onYes: () => void };

export const CANNOT_UNDO = "This cannot be undone.";

export function useConfirmDelete() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const back = useRef<HTMLElement | null>(null);
  const close = (yes: boolean) => {
    if (yes) ask?.onYes();
    setAsk(null);
    queueMicrotask(() => back.current?.isConnected && back.current.focus());
  };
  const dialog = ask && (
    <Modal
      open
      danger
      size="xs"
      modalHeading={ask.title}
      primaryButtonText="Delete"
      secondaryButtonText="Cancel"
      selectorPrimaryFocus=".cds--btn--secondary"
      onRequestClose={() => close(false)}
      onRequestSubmit={() => close(true)}
    >
      <p>{ask.body}</p>
    </Modal>
  );
  const confirm = (title: string, body: string, onYes: () => void) => {
    back.current = document.activeElement as HTMLElement | null;
    setAsk({ title, body, onYes });
  };
  return { dialog, confirm };
}
