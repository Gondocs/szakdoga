import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Alert, Typography } from '@mui/material';
import jsQR from 'jsqr';

interface QrScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
}

/**
 * Élő, kamerás QR-kód beolvasás a böngészőből (Interreg tanulmány "beépített
 * kamerás QR-kód olvasás" követelménye), a videófolyam kereteit vászonra
 * rajzolva és jsQR-rel dekódolva — nem igényel natív alkalmazást vagy
 * külön hardveres QR-olvasót.
 */
export function QrScannerDialog({ open, onClose, onDetected }: QrScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        setError('A kamera nem érhető el, vagy nincs hozzá engedély. Kérjük, illessze be a kódot kézzel.');
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        onDetected(code.data);
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>QR-kód beolvasása kamerával</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="warning">{error}</Alert>
        ) : (
          <Box sx={{ position: 'relative', width: '100%', borderRadius: 1, overflow: 'hidden', bgcolor: '#000' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
            <Typography
              variant="caption"
              sx={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: '#fff' }}
            >
              Tartsa a QR-kódot a kamera elé
            </Typography>
          </Box>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Mégse</Button>
      </DialogActions>
    </Dialog>
  );
}
