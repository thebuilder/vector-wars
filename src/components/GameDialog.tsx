import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
export function GameDialog({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="game-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-bar">
        <span>{eyebrow}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="dialog-body">
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
