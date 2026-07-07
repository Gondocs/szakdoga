<?php

namespace App\Http\Controllers\Api;

use App\Enums\RegistrationStatus;
use App\Enums\SpecialNeedCategory;
use App\Http\Controllers\Controller;
use App\Models\CheckIn;
use App\Models\EvacuationEvent;
use App\Models\SpecialNeed;
use App\Services\CapacityRiskService;
use App\Services\DemographicsService;
use App\Services\StockForecastService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class DashboardController extends Controller
{
    #[OA\Get(
        path: '/api/events/{event}/dashboard',
        summary: 'Vezetői dashboard: összesített mutatók és kapacitáskockázat',
        security: [['sanctumSession' => []]],
        tags: ['Dashboard'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Dashboard adatok',
                content: new OA\JsonContent(properties: [
                    new OA\Property(property: 'data', properties: [
                        new OA\Property(property: 'registered_count', type: 'integer'),
                        new OA\Property(property: 'families_count', type: 'integer'),
                        new OA\Property(property: 'arrived_count', type: 'integer'),
                        new OA\Property(property: 'central_transport_required_count', type: 'integer'),
                        new OA\Property(property: 'central_accommodation_required_count', type: 'integer'),
                        new OA\Property(property: 'status_breakdown', type: 'object', description: 'Regisztrációk száma státuszonként'),
                        new OA\Property(
                            property: 'registrations_by_day',
                            type: 'array',
                            items: new OA\Items(properties: [
                                new OA\Property(property: 'date', type: 'string', format: 'date'),
                                new OA\Property(property: 'count', type: 'integer'),
                            ])
                        ),
                        new OA\Property(property: 'overall_risk', properties: [
                            new OA\Property(property: 'score', type: 'number', format: 'float'),
                            new OA\Property(property: 'level', type: 'string', enum: ['low', 'medium', 'high', 'critical']),
                            new OA\Property(property: 'utilization', type: 'number', format: 'float'),
                            new OA\Property(property: 'intake_rate_per_hour', type: 'number', format: 'float', description: 'Érkeztetési ütem az elmúlt 2 órában'),
                            new OA\Property(property: 'forecast_hours_to_full', type: 'number', format: 'float', nullable: true, description: 'Becsült hátralévő óra a teljes kapacitás beteléséig a jelenlegi ütem alapján'),
                        ], type: 'object'),
                    ], type: 'object'),
                ])
            ),
            new OA\Response(response: 403, description: 'Nincs jogosultság a dashboard megtekintéséhez'),
        ]
    )]
    public function show(EvacuationEvent $event, CapacityRiskService $riskService, DemographicsService $demographicsService)
    {
        $this->authorize('viewDashboard', $event);

        $registrations = $event->registrations();

        $registeredCount = (clone $registrations)->count();
        $familiesCount = $event->families()->count();
        // Nem a checkins tábla sorainak száma (egy személynek áthelyezés vagy
        // ismételt érkeztetés esetén több checkin-rekordja is lehet), hanem a
        // ténylegesen jelenleg befogadóhelyen tartózkodó, egyedi személyek
        // száma — ugyanaz a definíció, mint amit a KPI-kártya kattintáskor
        // szűrésként (status=arrived_shelter) használ.
        $arrivedCount = (clone $registrations)->where('status', RegistrationStatus::ArrivedShelter->value)->count();
        $centralTransportCount = (clone $registrations)->where('central_transport_required', true)->count();
        $centralAccommodationCount = (clone $registrations)->where('central_accommodation_required', true)->count();

        $statusBreakdown = (clone $registrations)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $registrationsByDay = (clone $registrations)
            ->selectRaw('DATE(created_at) as day, count(*) as total')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->map(fn ($row) => ['date' => $row->day, 'count' => $row->total]);

        $specialNeedsByCategory = SpecialNeed::whereHas('person', fn ($q) => $q->where('event_id', $event->id))
            ->selectRaw('category, count(*) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $demographics = $demographicsService->breakdown($event);

        $shelterRisks = $event->eventShelters()->with('shelter')->get()->map(function ($es) use ($riskService) {
            $risk = $riskService->forEventShelter($es);

            return [
                'shelter_id' => $es->shelter_id,
                'shelter_name' => $es->shelter?->name,
                'capacity_limit' => $es->capacity_limit,
                'checked_in_count' => $es->checked_in_count,
                'utilization' => $risk['utilization'],
                'risk_score' => $risk['score'],
                'risk_level' => $risk['level']->value,
            ];
        });

        $overallRisk = $riskService->forEvent($event);

        $totalCapacity = (clone $event->eventShelters())->sum('capacity_limit');
        $totalCheckedIn = (clone $event->eventShelters())->sum('checked_in_count');
        $remainingCapacity = max($totalCapacity - $totalCheckedIn, 0);

        $forecastWindowHours = 2;
        $recentCheckins = CheckIn::where('event_id', $event->id)
            ->where('checked_in_at', '>=', now()->subHours($forecastWindowHours))
            ->count();
        $effectiveWindowHours = min($forecastWindowHours, max($event->created_at->diffInMinutes(now()) / 60, 1 / 60));
        $intakeRatePerHour = $recentCheckins / $effectiveWindowHours;

        $forecastHoursToFull = null;
        if ($remainingCapacity <= 0) {
            $forecastHoursToFull = 0;
        } elseif ($intakeRatePerHour > 0) {
            $forecastHoursToFull = round($remainingCapacity / $intakeRatePerHour, 1);
        }

        return response()->json([
            'data' => [
                'registered_count' => $registeredCount,
                'families_count' => $familiesCount,
                'arrived_count' => $arrivedCount,
                'central_transport_required_count' => $centralTransportCount,
                'central_accommodation_required_count' => $centralAccommodationCount,
                'special_needs_by_category' => collect(SpecialNeedCategory::cases())
                    ->mapWithKeys(fn ($case) => [$case->value => $specialNeedsByCategory->get($case->value, 0)]),
                'status_breakdown' => collect(RegistrationStatus::cases())
                    ->mapWithKeys(fn ($case) => [$case->value => $statusBreakdown->get($case->value, 0)]),
                'gender_breakdown' => $demographics['gender'],
                'age_breakdown' => $demographics['age'],
                'registrations_by_day' => $registrationsByDay,
                'shelters' => $shelterRisks,
                'overall_risk' => [
                    'score' => $overallRisk['score'],
                    'level' => $overallRisk['level']->value,
                    'utilization' => $overallRisk['utilization'],
                    'intake_rate_per_hour' => round($intakeRatePerHour, 1),
                    'forecast_hours_to_full' => $forecastHoursToFull,
                ],
            ],
        ]);
    }

    #[OA\Get(
        path: '/api/events/{event}/registrations-timeline',
        summary: 'Regisztrációk időbeli eloszlása, választható időegységgel',
        security: [['sanctumSession' => []]],
        tags: ['Dashboard'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'interval', in: 'query', description: 'Idő-felbontás', schema: new OA\Schema(type: 'string', enum: ['15min', 'hour', 'day'], default: 'day')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Időbeli bontású regisztrációs adatok',
                content: new OA\JsonContent(properties: [
                    new OA\Property(property: 'data', type: 'array', items: new OA\Items(properties: [
                        new OA\Property(property: 'bucket', type: 'string', format: 'date-time'),
                        new OA\Property(property: 'count', type: 'integer'),
                    ])),
                ])
            ),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function timeline(Request $request, EvacuationEvent $event)
    {
        $this->authorize('viewDashboard', $event);

        $interval = $request->string('interval')->value() ?: 'day';
        $bucketMinutes = match ($interval) {
            '15min' => 15,
            'hour' => 60,
            default => 1440,
        };

        $timestamps = $event->registrations()->orderBy('created_at')->pluck('created_at');

        $buckets = [];
        foreach ($timestamps as $createdAt) {
            $carbon = Carbon::parse($createdAt);
            $bucketEpochSeconds = intdiv($carbon->timestamp, $bucketMinutes * 60) * $bucketMinutes * 60;
            $key = Carbon::createFromTimestamp($bucketEpochSeconds)->toIso8601String();
            $buckets[$key] = ($buckets[$key] ?? 0) + 1;
        }

        ksort($buckets);

        return response()->json([
            'data' => collect($buckets)->map(fn ($count, $bucket) => ['bucket' => $bucket, 'count' => $count])->values(),
        ]);
    }

    #[OA\Get(
        path: '/api/events/{event}/stock-forecast',
        summary: 'Napi készletigény-előrejelzés befogadóhelyenként',
        description: 'A jelenleg befogadóhelyen tartózkodó személyek száma és egyedi igényei alapján becsült napi '.
            'étkezési adag-, takaró-, matrac- és gyógyszerigény.',
        security: [['sanctumSession' => []]],
        tags: ['Dashboard'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Készletigény-előrejelzés befogadóhelyenkénti és összesített bontásban'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function stockForecast(EvacuationEvent $event, StockForecastService $stockForecastService)
    {
        $this->authorize('viewDashboard', $event);

        return response()->json(['data' => $stockForecastService->forEvent($event)]);
    }
}
