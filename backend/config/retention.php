<?php

return [
    /*
     * Interreg tanulmány "Adatmegőrzési/törlési szabályzat" funkciója: hány
     * nappal a lezárt esemény utolsó módosítása (státuszváltása) után
     * törölhetők automatikusan a regisztrált személyek személyes adatai.
     */
    'closed_event_retention_days' => (int) env('RETENTION_CLOSED_EVENT_DAYS', 365),
];
