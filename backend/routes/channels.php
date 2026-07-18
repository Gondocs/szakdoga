<?php

use App\Models\AuditLog;
use App\Models\EvacuationEvent;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Egyetlen privát csatorna eseményenként, a befogadóhelyi
// kapacitás/kockázat-frissítéseknek, az incidens-értesítéseknek ÉS a
// szállítóeszköz-pozíció frissítéseknek is (Szállítás és Térképes
// áttekintés oldalak, mindkettő az EventLayout/EventSubNav alatt él) — a
// meglévő EvacuationEventPolicy::viewDashboard()-ot használjuk fel, mert az
// pontosan azokat a szerepköröket engedi, akiknek ez az élő értesítés szól.
Broadcast::channel('event.{eventId}.updates', function (User $user, string $eventId) {
    $event = EvacuationEvent::find($eventId);

    return $event && Gate::forUser($user)->allows('viewDashboard', $event);
});

// Globális (nem esemény-scope-olt) csatorna az auditnapló élő csíkjához —
// ugyanaz a jogosultság, mint a teljes napló megtekintéséhez
// (AuditLogPolicy::viewAny), hogy senki ne lásson élőben olyan aktivitást,
// amit a rendes /api/audit-logs végponton sem nézhetne meg.
Broadcast::channel('audit-logs', function (User $user) {
    return Gate::forUser($user)->allows('viewAny', AuditLog::class);
});
