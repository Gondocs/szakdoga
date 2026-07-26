import { toast } from 'react-toastify';
import { Button, Stack, Typography } from '@mui/material';

const DEFAULT_DELAY_MS = 6000;

interface ScheduleUndoableDeleteOptions {
  /** Pl. `"1. sz. busz" törölve.` — a törölt elem toast-üzenete. */
  message: string;
  /** A tényleges backend törlő hívás — csak akkor fut le, ha nem történt visszavonás. */
  onCommit: () => Promise<void>;
  /** Az elem visszaállítása a listaállapotba — visszavonáskor ÉS sikertelen commit esetén is meghívódik. */
  onUndo: () => void;
  /** Egyedi hibaüzenet-kinyerés a commit sikertelensége esetén (alapból generikus üzenet). */
  onError?: (error: unknown) => void;
  delayMs?: number;
}

/**
 * "Optimista" törlés: a hívó azonnal eltávolítja az elemet a lista-állapotból
 * (UI-visszajelzés), a tényleges backend törlés viszont csak `delayMs` múlva
 * indul el — eddig a toast "Visszavonás" gombjával megelőzhető, hogy a hívás
 * egyáltalán elinduljon. Ha a commit hívás mégis elhasal (pl. a szerver
 * elutasítja, mert időközben más függőség keletkezett), az elem automatikusan
 * visszakerül a listába, ugyanazzal az onUndo-val.
 */
export function scheduleUndoableDelete({ message, onCommit, onUndo, onError, delayMs = DEFAULT_DELAY_MS }: ScheduleUndoableDeleteOptions): void {
  let settled = false;

  const timeoutId = setTimeout(() => {
    if (settled) return;
    settled = true;
    onCommit().catch((error) => {
      if (onError) {
        onError(error);
      } else {
        toast.error('A törlés nem sikerült.');
      }
      onUndo();
    });
  }, delayMs);

  function handleUndo() {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    onUndo();
  }

  toast(
    ({ closeToast }) => (
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
        <Typography variant="body2">{message}</Typography>
        <Button
          size="small"
          color="inherit"
          sx={{ fontWeight: 700, flexShrink: 0 }}
          onClick={() => {
            handleUndo();
            closeToast?.();
          }}
        >
          Visszavonás
        </Button>
      </Stack>
    ),
    { autoClose: delayMs, closeOnClick: false }
  );
}
