// Toast for transport failures (Doc 7 §2, §5 non-Status outcomes). Never used for a Status;
// those go to StatusBanner. `inline` renders it in place (component gallery).
import { Icon } from "./Icon";
import styles from "./ui.module.css";

export function Toast({ message, onDismiss, inline = false }: { message: string; onDismiss?: () => void; inline?: boolean }) {
  return (
    <div className={inline ? undefined : styles.toastArea}>
      <div className={styles.toast} role="alert">
        <Icon name="alert" />
        <p>
          <strong>Error: </strong>
          {message}
        </p>
        {onDismiss && (
          <button type="button" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
