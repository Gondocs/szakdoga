<?php

use App\Http\Controllers\Api\AssemblyPointController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CareEventController;
use App\Http\Controllers\Api\CheckInController;
use App\Http\Controllers\Api\CitizenController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EvacuationEventController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\FamilyController;
use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\MunicipalityController;
use App\Http\Controllers\Api\PersonController;
use App\Http\Controllers\Api\QrController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\RepatriationController;
use App\Http\Controllers\Api\SelfServiceController;
use App\Http\Controllers\Api\ShelterController;
use App\Http\Controllers\Api\TransportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VehicleController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

// Bejelentkezés nélkül elérhető lakossági önkiszolgáló előregisztráció
// (Interreg tanulmány "1. fázis"). Rate-limitelve a visszaélések ellen.
Route::middleware('throttle:20,1')->group(function () {
    Route::get('/public/events/{code}', [SelfServiceController::class, 'showEvent']);
    Route::post('/public/events/{code}/self-register', [SelfServiceController::class, 'selfRegister']);
    Route::get('/public/municipalities', [MunicipalityController::class, 'index']);
    Route::get('/public/self-profile/{publicId}', [SelfServiceController::class, 'showProfile']);
    Route::put('/public/self-profile/{publicId}', [SelfServiceController::class, 'updateProfile']);
    Route::post('/public/self-profile/{publicId}/confirm-arrival', [SelfServiceController::class, 'confirmArrival']);
    Route::post('/public/self-profile/{publicId}/confirm-return', [SelfServiceController::class, 'confirmReturn']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);

    Route::get('/events', [EvacuationEventController::class, 'index']);
    Route::post('/events', [EvacuationEventController::class, 'store']);
    Route::get('/events/{event}', [EvacuationEventController::class, 'show']);
    Route::put('/events/{event}', [EvacuationEventController::class, 'update']);
    Route::delete('/events/{event}', [EvacuationEventController::class, 'destroy']);
    Route::get('/events/{event}/dashboard', [DashboardController::class, 'show']);
    Route::get('/events/{event}/registrations-timeline', [DashboardController::class, 'timeline']);
    Route::get('/events/{event}/stock-forecast', [DashboardController::class, 'stockForecast']);
    Route::get('/events/{event}/persons/export', [ExportController::class, 'personsCsv']);
    Route::get('/events/{event}/shelters/{shelter}/roster-export', [ExportController::class, 'shelterRosterCsv']);
    Route::get('/events/{event}/report-export', [ExportController::class, 'summaryReportCsv']);

    Route::get('/events/{event}/persons', [PersonController::class, 'index']);
    Route::post('/events/{event}/persons', [PersonController::class, 'store']);
    Route::post('/events/{event}/persons/bulk-import', [PersonController::class, 'bulkImport']);
    Route::get('/persons/{person}', [PersonController::class, 'show']);
    Route::put('/persons/{person}', [PersonController::class, 'update']);
    Route::get('/persons/{person}/status-history', [PersonController::class, 'statusHistory']);
    Route::post('/persons/{person}/document-photo', [PersonController::class, 'uploadDocumentPhoto']);
    Route::delete('/persons/{person}/document-photo', [PersonController::class, 'deleteDocumentPhoto']);
    Route::get('/persons/{person}/care-events', [CareEventController::class, 'index']);
    Route::post('/persons/{person}/care-events', [CareEventController::class, 'store']);
    Route::post('/persons/{person}/qr', [QrController::class, 'issue']);

    Route::put('/registrations/{registration}/status', [RegistrationController::class, 'updateStatus']);
    Route::put('/events/{event}/registrations/bulk-status', [RegistrationController::class, 'bulkUpdateStatus']);

    Route::get('/events/{event}/families', [FamilyController::class, 'index']);
    Route::get('/families/{family}', [FamilyController::class, 'show']);
    Route::get('/events/{event}/families/reunification-worklist', [FamilyController::class, 'reunificationWorklist']);
    Route::get('/families/{family}/reunification-notes', [FamilyController::class, 'reunificationNotes']);
    Route::post('/families/{family}/reunification-notes', [FamilyController::class, 'addReunificationNote']);

    Route::get('/events/{event}/incidents', [IncidentController::class, 'index']);
    Route::post('/events/{event}/incidents', [IncidentController::class, 'store']);
    Route::post('/incidents/{incident}/resolve', [IncidentController::class, 'resolve']);

    Route::get('/events/{event}/assembly-points', [AssemblyPointController::class, 'index']);
    Route::post('/events/{event}/assembly-points', [AssemblyPointController::class, 'store']);
    Route::put('/assembly-points/{assemblyPoint}', [AssemblyPointController::class, 'update']);
    Route::delete('/assembly-points/{assemblyPoint}', [AssemblyPointController::class, 'destroy']);

    Route::get('/events/{event}/repatriation-authorizations', [RepatriationController::class, 'index']);
    Route::put('/events/{event}/repatriation-authorizations', [RepatriationController::class, 'upsert']);

    Route::get('/citizens/{citizen}/history', [CitizenController::class, 'history']);

    Route::get('/events/{event}/persons/municipality-summary', [PersonController::class, 'municipalitySummary']);

    Route::get('/municipalities', [MunicipalityController::class, 'index']);
    Route::post('/municipalities', [MunicipalityController::class, 'store']);
    Route::put('/municipalities/{municipality}', [MunicipalityController::class, 'update']);
    Route::delete('/municipalities/{municipality}', [MunicipalityController::class, 'destroy']);
    Route::get('/shelters', [ShelterController::class, 'all']);
    Route::post('/shelters', [ShelterController::class, 'store']);
    Route::put('/shelters/{shelter}', [ShelterController::class, 'update']);
    Route::delete('/shelters/{shelter}', [ShelterController::class, 'destroy']);

    Route::post('/qr/resolve', [QrController::class, 'resolve']);
    Route::post('/qr-tokens/{qrToken}/deliver', [QrController::class, 'deliver']);

    Route::get('/events/{event}/shelters', [ShelterController::class, 'index']);
    Route::post('/shelters/{shelter}/checkins', [CheckInController::class, 'store']);
    Route::post('/persons/{person}/transfer', [CheckInController::class, 'transfer']);
    Route::post('/persons/{person}/temporary-leave', [CheckInController::class, 'temporaryLeave']);
    Route::post('/persons/{person}/temporary-return', [CheckInController::class, 'temporaryReturn']);
    Route::patch('/persons/{person}/bed-assignment', [CheckInController::class, 'updateBedAssignment']);

    Route::get('/events/{event}/transports', [TransportController::class, 'index']);
    Route::post('/events/{event}/transports', [TransportController::class, 'store']);
    Route::put('/transports/{transport}', [TransportController::class, 'update']);
    Route::delete('/transports/{transport}', [TransportController::class, 'destroy']);
    Route::post('/transports/{transport}/board', [TransportController::class, 'board']);
    Route::post('/transports/{transport}/alight', [TransportController::class, 'alight']);
    Route::post('/transports/{transport}/simulate-position', [TransportController::class, 'simulatePosition']);
    Route::post('/transports/{transport}/import-manifest', [TransportController::class, 'importManifest']);
    Route::get('/transports/{transport}/passengers', [TransportController::class, 'passengers']);

    Route::get('/vehicles', [VehicleController::class, 'index']);
    Route::post('/vehicles', [VehicleController::class, 'store']);
    Route::put('/vehicles/{vehicle}', [VehicleController::class, 'update']);
    Route::delete('/vehicles/{vehicle}', [VehicleController::class, 'destroy']);

    Route::get('/audit-logs', [AuditLogController::class, 'index']);

    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{targetUser}', [UserController::class, 'update']);
    Route::post('/users/{targetUser}/avatar', [UserController::class, 'uploadAvatar']);
    Route::delete('/users/{targetUser}/avatar', [UserController::class, 'deleteAvatar']);
    Route::get('/roles', [UserController::class, 'roles']);
});
