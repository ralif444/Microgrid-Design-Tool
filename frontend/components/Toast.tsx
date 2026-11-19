// Toast for transport failures (Doc 7 §2, §5 non-Status outcomes; guideline §6 ToastNotification).
// Never used for a Status; those go to StatusBanner. `inline` renders it in place (component gallery).
import { ToastNotification } from "@carbon/react";
import { useLanguage } from "./Language";
import styles from "./ui.module.css";

export function Toast({ message, onDismiss, inline = false }: { message: string; onDismiss?: () => void; inline?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className={inline ? undefined : styles.toastArea}>
      <ToastNotification
        kind="error"
        role="alert"
        title={t("Error")}
        subtitle={t(message)}
        hideCloseButton={!onDismiss}
        onClose={() => {
          onDismiss?.();
          return false; // the caller owns visibility
        }}
        className={styles.toast}
      />
    </div>
  );
}
