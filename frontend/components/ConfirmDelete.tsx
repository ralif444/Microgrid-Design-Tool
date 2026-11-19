"use client";
// Delete confirmation (plan F2, user 2026-11-14): every removal asks first, because there is no undo
// (Doc 7 §7). Focus starts on Cancel and returns to the button that asked (Doc 7 §8); Carbon's Modal
// traps focus while open. The dialog is mounted only while asking, so its "Delete" button never
// competes with the row buttons ("Delete INV1") for an accessible name.
import { Modal } from "@carbon/react";
import { useRef, useState } from "react";
import { useLanguage } from "./Language";

type Ask = { title: string; body: string; onYes: () => void; yes: string };

export const CANNOT_UNDO = "This cannot be undone.";

export function useConfirmDelete() {
  const { t } = useLanguage();
  const [ask, setAsk] = useState<Ask | null>(null);
  const back = useRef<HTMLElement | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const close = (yes: boolean) => {
    if (yes) ask?.onYes();
    else cancel.current?.();
    cancel.current = null;
    setAsk(null);
    queueMicrotask(() => back.current?.isConnected && back.current.focus());
  };
  const dialog = ask && (
    <Modal
      open
      danger
      size="xs"
      modalHeading={t(ask.title)}
      primaryButtonText={t(ask.yes)}
      secondaryButtonText={t("Cancel")}
      selectorPrimaryFocus=".cds--btn--secondary"
      onRequestClose={() => close(false)}
      onRequestSubmit={() => close(true)}
    >
      <p>{t(ask.body)}</p>
    </Modal>
  );
  // `yes`: the confirm word when the removal is a replacement ("Replace"); default "Delete"
  const confirm = (title: string, body: string, onYes: () => void, yes = "Delete") => {
    back.current = document.activeElement as HTMLElement | null;
    cancel.current = null;
    setAsk({ title, body, onYes, yes });
  };
  // the same dialog as a yes/no for a step that goes on (audit O9: no native confirm(), which a browser can suppress)
  const yesNo = (title: string, body: string, yes: string) =>
    new Promise<boolean>((res) => {
      back.current = document.activeElement as HTMLElement | null;
      setAsk({ title, body, onYes: () => res(true), yes });
      cancel.current = () => res(false);
    });
  return { dialog, confirm, ask: yesNo };
}
