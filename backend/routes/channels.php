<?php

use App\Models\EvacuationEvent;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Egyetlen privát csatorna eseményenként, mind a befogadóhelyi
// kapacitás/kockázat-frissítéseknek, mind az incidens-értesítéseknek — a
// meglévő EvacuationEventPolicy::viewDashboard()-ot használjuk fel, mert az
// pontosan azokat a szerepköröket engedi, akiknek ez az élő értesítés szól.
Broadcast::channel('event.{eventId}.updates', function (User $user, string $eventId) {
    $event = EvacuationEvent::find($eventId);

    return $event && Gate::forUser($user)->allows('viewDashboard', $event);
});
