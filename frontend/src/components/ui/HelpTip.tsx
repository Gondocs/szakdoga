import { useState } from 'react';
import { IconButton, Popover, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

/**
 * Apró, kattintható "?" jelvény rövid, nem nyilvánvaló magyarázathoz (pl.
 * egy számított érték képlete) — a legtöbb helyen már van leíró szöveg a
 * felület alatt, ezt csak ott érdemes használni, ahol a jelentés önmagában
 * (a UI-ból) nem derül ki egyértelműen.
 */
export function HelpTip({ text }: { text: string }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.25 }}>
        <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
      </IconButton>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Typography variant="body2" sx={{ p: 1.5, maxWidth: 320 }}>{text}</Typography>
      </Popover>
    </>
  );
}
