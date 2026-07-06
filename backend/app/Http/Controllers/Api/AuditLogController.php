<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

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
            new OA\Parameter(name: 'date_from', in: 'query', description: 'Kezdő dátum/időpont (naptár szerinti szűrés)', schema: new OA\Schema(type: 'string', format: 'date-time')),
            new OA\Parameter(name: 'date_to', in: 'query', description: 'Záró dátum/időpont (naptár szerinti szűrés)', schema: new OA\Schema(type: 'string', format: 'date-time')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Napló lapozott listája'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function index(Request $request)
    {
        $this->authorize('viewAny', AuditLog::class);

        $logs = AuditLog::with('user')
            ->when($request->filled('entity_type'), fn ($q) => $q->where('entity_type', $request->string('entity_type')))
            ->when($request->filled('action'), fn ($q) => $q->where('action', $request->string('action')))
            ->when($request->filled('date_from'), fn ($q) => $q->where('created_at', '>=', $request->string('date_from')))
            ->when($request->filled('date_to'), fn ($q) => $q->where('created_at', '<=', $request->string('date_to')))
            ->orderByDesc('created_at')
            ->paginate(30);

        return AuditLogResource::collection($logs);
    }
}
