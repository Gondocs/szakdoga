<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\EvacuationEvent;
use App\Models\User;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    #[OA\Get(
        path: '/api/audit-logs',
        summary: 'Műveleti napló lapozott listázása és szűrése',
        description: 'Csak admin, vezető és auditor szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Audit'],
        parameters: [
            new OA\Parameter(name: 'entity_type', in: 'query', schema: new OA\Schema(type: 'string', example: 'Person')),
            new OA\Parameter(name: 'action', in: 'query', schema: new OA\Schema(type: 'string', example: 'checkin')),
            new OA\Parameter(name: 'user_id', in: 'query', description: 'Végrehajtó felhasználó szerinti szűrés', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'event_id', in: 'query', description: 'Esemény szerinti szűrés', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'q', in: 'query', description: 'Szabad szöveges keresés (felhasználó neve, entitás azonosítója)', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'significant_only', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'date_from', in: 'query', description: 'Kezdő dátum/időpont (naptár szerinti szűrés)', schema: new OA\Schema(type: 'string', format: 'date-time')),
            new OA\Parameter(name: 'date_to', in: 'query', description: 'Záró dátum/időpont (naptár szerinti szűrés)', schema: new OA\Schema(type: 'string', format: 'date-time')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Napló lapozott listája, benne egy napi összesítővel (meta.summary)'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function index(Request $request)
    {
        $this->authorize('viewAny', AuditLog::class);

        $logs = $this->filteredQuery($request)
            ->orderByDesc('created_at')
            ->paginate(30);

        $todayCount = AuditLog::whereDate('created_at', today())->count();
        $todaySignificantCount = AuditLog::whereDate('created_at', today())->where('significant', true)->count();

        return AuditLogResource::collection($logs)->additional([
            'meta' => [
                'summary' => [
                    'today_count' => $todayCount,
                    'today_significant_count' => $todaySignificantCount,
                ],
            ],
        ]);
    }

    #[OA\Get(
        path: '/api/audit-logs/filter-options',
        summary: 'A naplóban ténylegesen előforduló felhasználók és események listája szűrőmenükhöz',
        security: [['sanctumSession' => []]],
        tags: ['Audit'],
        responses: [
            new OA\Response(response: 200, description: 'Szűrőopciók'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function filterOptions()
    {
        $this->authorize('viewAny', AuditLog::class);

        $userIds = AuditLog::whereNotNull('user_id')->distinct()->pluck('user_id');
        $eventIds = AuditLog::whereNotNull('event_id')->distinct()->pluck('event_id');

        return response()->json([
            'data' => [
                'users' => User::whereIn('id', $userIds)->orderBy('name')->get(['id', 'name']),
                'events' => EvacuationEvent::whereIn('id', $eventIds)->orderByDesc('created_at')->get(['id', 'code', 'name']),
            ],
        ]);
    }

    #[OA\Get(
        path: '/api/audit-logs/export',
        summary: 'Műveleti napló exportálása CSV formátumban (az aktuális szűrésnek megfelelően)',
        security: [['sanctumSession' => []]],
        tags: ['Audit'],
        parameters: [
            new OA\Parameter(name: 'entity_type', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'action', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'user_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'event_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'q', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'significant_only', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'date_from', in: 'query', schema: new OA\Schema(type: 'string', format: 'date-time')),
            new OA\Parameter(name: 'date_to', in: 'query', schema: new OA\Schema(type: 'string', format: 'date-time')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'CSV fájl letöltése'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function exportCsv(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', AuditLog::class);

        $canViewSensitive = (bool) $request->user()?->hasRole(\App\Enums\RoleCode::Admin, \App\Enums\RoleCode::Manager);

        $logs = $this->filteredQuery($request)->with('user')->orderByDesc('created_at')->get();

        return response()->streamDownload(function () use ($logs, $canViewSensitive) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, ['Időpont', 'Felhasználó', 'Művelet', 'Entitás', 'Azonosító', 'Jelentős'], ';');

            foreach ($logs as $log) {
                fputcsv($handle, [
                    $log->created_at?->toDateTimeString(),
                    $log->user?->name ?? '–',
                    $log->action,
                    $log->entity_type,
                    $canViewSensitive ? $log->entity_id : substr($log->entity_id, 0, 8),
                    $log->significant ? 'igen' : 'nem',
                ], ';');
            }

            fclose($handle);
        }, 'muveleti-naplo.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function filteredQuery(Request $request)
    {
        return AuditLog::with(['user', 'event'])
            ->when($request->filled('entity_type'), fn ($q) => $q->where('entity_type', $request->string('entity_type')))
            ->when($request->filled('action'), fn ($q) => $q->where('action', $request->string('action')))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->when($request->filled('event_id'), fn ($q) => $q->where('event_id', $request->string('event_id')))
            ->when($request->boolean('significant_only'), fn ($q) => $q->where('significant', true))
            ->when($request->filled('date_from'), fn ($q) => $q->where('created_at', '>=', $request->string('date_from')))
            ->when($request->filled('date_to'), fn ($q) => $q->where('created_at', '<=', $request->string('date_to')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $search = $request->string('q');
                $q->where(function ($inner) use ($search) {
                    $inner->where('entity_id', 'like', "%{$search}%")
                        ->orWhere('entity_type', 'like', "%{$search}%")
                        ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$search}%"));
                });
            });
    }
}
