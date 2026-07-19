import { apiClient, ensureCsrfCookie } from './client';
import type {
  AssemblyPoint,
  AuditLogFilterOptions,
  AuditLogListResponse,
  CheckInRecord,
  DashboardData,
  EvacuationEvent,
  FamilyDetail,
  FamilyReunificationEntry,
  FamilyReunificationNote,
  FamilySummary,
  Municipality,
  Paginated,
  CareEvent,
  CareEventCategory,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  RepatriationAuthorization,
  RepatriationStatus,
  Person,
  QrDeliveryMethod,
  QrTokenData,
  RegistrationStatus,
  Role,
  Shelter,
  ShelterWithRisk,
  StatusHistoryEntry,
  User,
} from '../../types';

// A /api/login mostantól kétféleképp válaszolhat: vagy a bejelentkezett
// felhasználóval (ha valamiért nincs 2FA-lépés), vagy egy jelzéssel, hogy
// a rendszer e-mailben kiküldött egy kódot, és a /login/two-factor/verify
// végpontra van szükség a bejelentkezés befejezéséhez.
export type LoginResult = { twoFactorRequired: true } | { twoFactorRequired: false; user: User };

export async function login(email: string, password: string): Promise<LoginResult> {
  await ensureCsrfCookie();
  const { data } = await apiClient.post<{ data: User } | { two_factor_required: true }>('/api/login', {
    email,
    password,
  });

  if ('two_factor_required' in data) {
    return { twoFactorRequired: true };
  }

  return { twoFactorRequired: false, user: data.data };
}

export async function verifyTwoFactorCode(code: string): Promise<User> {
  const { data } = await apiClient.post<{ data: User }>('/api/login/two-factor/verify', { code });
  return data.data;
}

// A folyamatban lévő 2FA-állapotot a szerver a sessionben tartja, ezért
// ehhez a hívásnál nem kell semmilyen azonosítót küldeni.
export async function resendTwoFactorCode(): Promise<void> {
  await apiClient.post('/api/login/two-factor/resend');
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/logout');
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ data: User }>('/api/me');
  return data.data;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  password?: string;
  current_password?: string;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await apiClient.put<{ data: User }>('/api/me', payload);
  return data.data;
}

export async function updateTwoFactorPreference(enabled: boolean): Promise<User> {
  const { data } = await apiClient.put<{ data: User }>('/api/me/two-factor', { enabled });
  return data.data;
}

export interface LoginHistoryEntry {
  id: number;
  // two_factor_sent/login_2fa_failed: a bejelentkezéshez tartozó 2FA-kód
  // kiküldése, illetve egy hibás kódpróbálkozás.
  action: 'login' | 'logout' | 'login_failed' | 'two_factor_sent' | 'login_2fa_failed';
  created_at: string;
}

export async function fetchLoginHistory(): Promise<LoginHistoryEntry[]> {
  const { data } = await apiClient.get<{ data: LoginHistoryEntry[] }>('/api/me/login-history');
  return data.data;
}

export async function fetchEvents(): Promise<Paginated<EvacuationEvent>> {
  const { data } = await apiClient.get<Paginated<EvacuationEvent>>('/api/events');
  return data;
}

export async function fetchEvent(eventId: string): Promise<EvacuationEvent> {
  const { data } = await apiClient.get<{ data: EvacuationEvent }>(`/api/events/${eventId}`);
  return data.data;
}

export interface CreateEventPayload {
  code: string;
  name: string;
  status: EvacuationEvent['status'];
  starts_at?: string | null;
  ends_at?: string | null;
  shelters?: { shelter_id: string; capacity_limit: number }[];
}

export async function createEvent(payload: CreateEventPayload): Promise<EvacuationEvent> {
  const { data } = await apiClient.post<{ data: EvacuationEvent }>('/api/events', payload);
  return data.data;
}

export interface UpdateEventPayload {
  name?: string;
  status?: EvacuationEvent['status'];
  starts_at?: string | null;
  ends_at?: string | null;
  shelters?: { shelter_id: string; capacity_limit: number }[];
}

export async function updateEvent(eventId: string, payload: UpdateEventPayload): Promise<EvacuationEvent> {
  const { data } = await apiClient.put<{ data: EvacuationEvent }>(`/api/events/${eventId}`, payload);
  return data.data;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await apiClient.delete(`/api/events/${eventId}`);
}

export async function fetchDashboard(eventId: string): Promise<DashboardData> {
  const { data } = await apiClient.get<{ data: DashboardData }>(`/api/events/${eventId}/dashboard`);
  return data.data;
}

export interface StockForecastShelterRow {
  shelter_id: string;
  shelter_name: string | null;
  checked_in_count: number;
  meal_portions_per_day: number;
  special_diet_portions_per_day: number;
  blankets_needed: number;
  mattresses_needed: number;
  medicine_needed_count: number;
}

export interface StockForecastData {
  generated_at: string;
  by_shelter: StockForecastShelterRow[];
  totals: Omit<StockForecastShelterRow, 'shelter_id' | 'shelter_name'>;
}

export async function fetchStockForecast(eventId: string): Promise<StockForecastData> {
  const { data } = await apiClient.get<{ data: StockForecastData }>(`/api/events/${eventId}/stock-forecast`);
  return data.data;
}

export type TimelineInterval = '15min' | 'hour' | 'day';

export interface TimelineBucket {
  bucket: string;
  count: number;
}

export async function fetchRegistrationsTimeline(eventId: string, interval: TimelineInterval): Promise<TimelineBucket[]> {
  const { data } = await apiClient.get<{ data: TimelineBucket[] }>(`/api/events/${eventId}/registrations-timeline`, {
    params: { interval },
  });
  return data.data;
}

export interface PersonListParams {
  search?: string;
  status?: string;
  special_need_category?: string;
  special_need_type?: string;
  central_transport_required?: boolean;
  central_accommodation_required?: boolean;
  shelter_id?: string;
  municipality_id?: number;
  sort_by?: 'name' | 'status' | 'municipality' | 'created_at';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export async function fetchPersons(eventId: string, params: PersonListParams = {}): Promise<Paginated<Person>> {
  const { data } = await apiClient.get<Paginated<Person>>(`/api/events/${eventId}/persons`, { params });
  return data;
}

export async function fetchPerson(personId: string): Promise<Person> {
  const { data } = await apiClient.get<{ data: Person }>(`/api/persons/${personId}`);
  return data.data;
}

export interface CreatePersonPayload {
  last_name: string;
  first_name: string;
  birth_last_name?: string;
  birth_first_name?: string;
  birth_place?: string;
  birth_date?: string;
  gender?: string;
  id_document_number?: string;
  mother_birth_name?: string;
  municipality_id: number;
  address_postal_code?: string;
  address_settlement?: string;
  address_street?: string;
  address_house_number?: string;
  phone?: string;
  email?: string;
  family_id?: string | null;
  create_new_family?: boolean;
  is_primary_contact?: boolean;
  central_transport_required?: boolean;
  central_accommodation_required?: boolean;
  under_regular_medical_care?: boolean;
  own_vehicle?: boolean;
  travels_alone?: boolean;
  special_needs?: { category: string; type?: string; priority?: number; description?: string }[];
  animals?: { animal_type: string; count?: number; stays_at_address?: boolean }[];
}

export async function createPerson(eventId: string, payload: CreatePersonPayload): Promise<Person> {
  const { data } = await apiClient.post<{ data: Person }>(`/api/events/${eventId}/persons`, payload);
  return data.data;
}

export interface UpdatePersonPayload {
  last_name?: string;
  first_name?: string;
  birth_last_name?: string;
  birth_first_name?: string;
  birth_place?: string;
  birth_date?: string;
  gender?: string;
  id_document_number?: string;
  mother_birth_name?: string;
  municipality_id?: number;
  address_postal_code?: string;
  address_settlement?: string;
  address_street?: string;
  address_house_number?: string;
  phone?: string;
  email?: string;
}

export async function updatePerson(personId: string, payload: UpdatePersonPayload): Promise<Person> {
  const { data } = await apiClient.put<{ data: Person }>(`/api/persons/${personId}`, payload);
  return data.data;
}

export async function updateRegistrationStatus(registrationId: string, status: RegistrationStatus): Promise<void> {
  await apiClient.put(`/api/registrations/${registrationId}/status`, { status });
}

export interface BulkStatusResult {
  updated: string[];
  failed: string[];
}

export async function bulkUpdateRegistrationStatus(
  eventId: string,
  personIds: string[],
  status: RegistrationStatus
): Promise<BulkStatusResult> {
  const { data } = await apiClient.put<{ data: BulkStatusResult }>(`/api/events/${eventId}/registrations/bulk-status`, {
    person_ids: personIds,
    status,
  });
  return data.data;
}

export async function fetchStatusHistory(personId: string): Promise<StatusHistoryEntry[]> {
  const { data } = await apiClient.get<{ data: StatusHistoryEntry[] }>(`/api/persons/${personId}/status-history`);
  return data.data;
}

export async function fetchFamily(familyId: string): Promise<FamilyDetail> {
  const { data } = await apiClient.get<{ data: FamilyDetail }>(`/api/families/${familyId}`);
  return data.data;
}

export interface CitizenHistoryEntry {
  person_id: string;
  event: { id: string; code: string; name: string; status: string };
  registration_status: string | null;
  channel: string | null;
  registered_at: string | null;
}

export interface CitizenHistory {
  citizen: { id: string; full_name: string; id_document_number: string };
  registrations: CitizenHistoryEntry[];
}

export async function fetchCitizenHistory(citizenId: string): Promise<CitizenHistory> {
  const { data } = await apiClient.get<{ data: CitizenHistory }>(`/api/citizens/${citizenId}/history`);
  return data.data;
}

export function apiBaseUrl(): string {
  return apiClient.defaults.baseURL ?? '';
}

export function personsExportUrl(eventId: string): string {
  return `${apiClient.defaults.baseURL}/api/events/${eventId}/persons/export`;
}

export function shelterRosterExportUrl(eventId: string, shelterId: string): string {
  return `${apiClient.defaults.baseURL}/api/events/${eventId}/shelters/${shelterId}/roster-export`;
}

export function summaryReportExportUrl(eventId: string): string {
  return `${apiClient.defaults.baseURL}/api/events/${eventId}/report-export`;
}

export async function issueQrToken(personId: string, reason?: 'lost'): Promise<QrTokenData> {
  const { data } = await apiClient.post<{ data: QrTokenData }>(`/api/persons/${personId}/qr`, reason ? { reason } : undefined);
  return data.data;
}

export async function resolveQrToken(publicId: string): Promise<Person> {
  const { data } = await apiClient.post<{ data: Person }>('/api/qr/resolve', { public_id: publicId });
  return data.data;
}

export async function fetchRepatriationAuthorizations(eventId: string): Promise<RepatriationAuthorization[]> {
  const { data } = await apiClient.get<{ data: RepatriationAuthorization[] }>(`/api/events/${eventId}/repatriation-authorizations`);
  return data.data;
}

export async function upsertRepatriationAuthorization(
  eventId: string,
  payload: { municipality_id: number; status: RepatriationStatus; conditions_note?: string; window_starts_at?: string; window_ends_at?: string }
): Promise<RepatriationAuthorization> {
  const { data } = await apiClient.put<{ data: RepatriationAuthorization }>(
    `/api/events/${eventId}/repatriation-authorizations`,
    payload
  );
  return data.data;
}

export async function confirmReturn(publicId: string): Promise<Person> {
  const { data } = await apiClient.post<{ data: Person }>(`/api/public/self-profile/${publicId}/confirm-return`);
  return data.data;
}

export async function fetchIncidents(eventId: string, status?: 'open' | 'resolved'): Promise<Incident[]> {
  const { data } = await apiClient.get<{ data: Incident[] }>(`/api/events/${eventId}/incidents`, {
    params: status ? { status } : undefined,
  });
  return data.data;
}

export async function createIncident(
  eventId: string,
  payload: { category: IncidentCategory; severity: IncidentSeverity; description: string; shelter_id?: string; person_id?: string }
): Promise<Incident> {
  const { data } = await apiClient.post<{ data: Incident }>(`/api/events/${eventId}/incidents`, payload);
  return data.data;
}

export async function resolveIncident(incidentId: number): Promise<Incident> {
  const { data } = await apiClient.post<{ data: Incident }>(`/api/incidents/${incidentId}/resolve`);
  return data.data;
}

export interface AssemblyPointPayload {
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  notes?: string | null;
}

export async function fetchAssemblyPoints(eventId: string): Promise<AssemblyPoint[]> {
  const { data } = await apiClient.get<{ data: AssemblyPoint[] }>(`/api/events/${eventId}/assembly-points`);
  return data.data;
}

export async function createAssemblyPoint(eventId: string, payload: AssemblyPointPayload): Promise<AssemblyPoint> {
  const { data } = await apiClient.post<{ data: AssemblyPoint }>(`/api/events/${eventId}/assembly-points`, payload);
  return data.data;
}

export async function updateAssemblyPoint(id: number, payload: AssemblyPointPayload): Promise<AssemblyPoint> {
  const { data } = await apiClient.put<{ data: AssemblyPoint }>(`/api/assembly-points/${id}`, payload);
  return data.data;
}

export async function deleteAssemblyPoint(id: number): Promise<void> {
  await apiClient.delete(`/api/assembly-points/${id}`);
}

export async function fetchCareEvents(personId: string): Promise<CareEvent[]> {
  const { data } = await apiClient.get<{ data: CareEvent[] }>(`/api/persons/${personId}/care-events`);
  return data.data;
}

export async function createCareEvent(
  personId: string,
  payload: { category: CareEventCategory; note?: string }
): Promise<CareEvent> {
  const { data } = await apiClient.post<{ data: CareEvent }>(`/api/persons/${personId}/care-events`, payload);
  return data.data;
}

export async function deliverQrToken(qrTokenId: number, deliveryMethod: QrDeliveryMethod): Promise<QrTokenData> {
  const { data } = await apiClient.post<{ data: QrTokenData }>(`/api/qr-tokens/${qrTokenId}/deliver`, {
    delivery_method: deliveryMethod,
  });
  return data.data;
}

export interface BulkImportResult {
  created_count: number;
  created: { person_id: string; full_name: string; public_id: string }[];
  errors: string[];
}

export async function bulkImportPersons(eventId: string, file: File): Promise<BulkImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<{ data: BulkImportResult }>(`/api/events/${eventId}/persons/bulk-import`, formData);
  return data.data;
}

export async function fetchShelters(eventId: string, personId?: string): Promise<ShelterWithRisk[]> {
  const { data } = await apiClient.get<{ data: ShelterWithRisk[] }>(`/api/events/${eventId}/shelters`, {
    params: personId ? { person_id: personId } : undefined,
  });
  return data.data;
}

export interface MunicipalityPersonSummary {
  municipality_id: number;
  name: string;
  lat: number;
  lng: number;
  person_count: number;
}

export async function fetchPersonMunicipalitySummary(
  eventId: string,
  filters?: { central_transport_required?: boolean }
): Promise<MunicipalityPersonSummary[]> {
  const { data } = await apiClient.get<{ data: MunicipalityPersonSummary[] }>(
    `/api/events/${eventId}/persons/municipality-summary`,
    { params: filters }
  );
  return data.data;
}

export type VehicleType = 'bus' | 'minibus' | 'train' | 'car' | 'ambulance' | 'truck' | 'other';

export interface Transport {
  id: string;
  code: string;
  capacity: number | null;
  origin: string | null;
  destination: string | null;
  escort_name: string | null;
  departure_planned_at: string | null;
  arrival_planned_at: string | null;
  delay_minutes: number | null;
  route_change_note: string | null;
  vehicle: { id: string; plate_number: string; label: string; vehicle_type: VehicleType } | null;
  onboard_count: number;
  last_lat: number | null;
  last_lng: number | null;
  last_position_at: string | null;
}

export async function fetchTransports(eventId: string): Promise<Transport[]> {
  const { data } = await apiClient.get<{ data: Transport[] }>(`/api/events/${eventId}/transports`);
  return data.data;
}

export interface TransportPayload {
  code: string;
  capacity?: number;
  vehicle_id?: string | null;
  origin?: string;
  destination?: string;
  escort_name?: string;
  departure_planned_at?: string;
  arrival_planned_at?: string;
  delay_minutes?: number;
  route_change_note?: string;
}

export async function createTransport(eventId: string, payload: TransportPayload): Promise<Transport> {
  const { data } = await apiClient.post<{ data: Transport }>(`/api/events/${eventId}/transports`, payload);
  return data.data;
}

export async function updateTransport(transportId: string, payload: TransportPayload): Promise<Transport> {
  const { data } = await apiClient.put<{ data: Transport }>(`/api/transports/${transportId}`, payload);
  return data.data;
}

export async function fetchTransportPassengers(transportId: string): Promise<Person[]> {
  const { data } = await apiClient.get<{ data: Person[] }>(`/api/transports/${transportId}/passengers`);
  return data.data;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  label: string;
  vehicle_type: VehicleType;
  capacity: number | null;
  driver_name: string | null;
  notes: string | null;
  active_assignment: {
    transport_id: string;
    transport_code: string;
    event_id: string;
    event_name: string | null;
    last_lat: number | null;
    last_lng: number | null;
    last_position_at: string | null;
  } | null;
}

export interface VehiclePayload {
  plate_number: string;
  label: string;
  vehicle_type?: VehicleType;
  capacity?: number;
  driver_name?: string;
  notes?: string;
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data } = await apiClient.get<{ data: Vehicle[] }>('/api/vehicles');
  return data.data;
}

export async function createVehicle(payload: VehiclePayload): Promise<Vehicle> {
  const { data } = await apiClient.post<{ data: Vehicle }>('/api/vehicles', payload);
  return data.data;
}

export async function updateVehicle(vehicleId: string, payload: VehiclePayload): Promise<Vehicle> {
  const { data } = await apiClient.put<{ data: Vehicle }>(`/api/vehicles/${vehicleId}`, payload);
  return data.data;
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  await apiClient.delete(`/api/vehicles/${vehicleId}`);
}

export async function deleteTransport(transportId: string): Promise<void> {
  await apiClient.delete(`/api/transports/${transportId}`);
}

export async function boardTransport(transportId: string, publicId: string, overrideCapacity = false): Promise<Person> {
  const { data } = await apiClient.post<{ data: Person }>(`/api/transports/${transportId}/board`, {
    public_id: publicId,
    override_capacity: overrideCapacity,
  });
  return data.data;
}

export async function alightTransport(transportId: string, publicId: string): Promise<Person> {
  const { data } = await apiClient.post<{ data: Person }>(`/api/transports/${transportId}/alight`, { public_id: publicId });
  return data.data;
}

export async function simulateTransportPosition(transportId: string): Promise<Transport> {
  const { data } = await apiClient.post<{ data: Transport }>(`/api/transports/${transportId}/simulate-position`);
  return data.data;
}

export interface ManifestImportResult {
  boarded_count: number;
  not_found: string[];
  already_onboard: string[];
  capacity_exceeded: string[];
  transport: Transport;
}

export async function importTransportManifest(transportId: string, file: File): Promise<ManifestImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<{ data: ManifestImportResult }>(`/api/transports/${transportId}/import-manifest`, formData);
  return data.data;
}

export interface CheckInPayload {
  event_id: string;
  public_id?: string;
  person_id?: string;
  override_capacity?: boolean;
  bed_label?: string | null;
}

export interface CheckInApiResult {
  checkIn: CheckInRecord;
  familySplitWarning: string | null;
}

export async function checkInPerson(shelterId: string, payload: CheckInPayload): Promise<CheckInApiResult> {
  const { data } = await apiClient.post<{ data: CheckInRecord; family_split_warning: string | null }>(
    `/api/shelters/${shelterId}/checkins`,
    payload
  );
  return { checkIn: data.data, familySplitWarning: data.family_split_warning };
}

export async function transferPerson(
  personId: string,
  shelterId: string,
  overrideCapacity = false,
  bedLabel?: string | null,
): Promise<CheckInApiResult> {
  const { data } = await apiClient.post<{ data: CheckInRecord; family_split_warning: string | null }>(
    `/api/persons/${personId}/transfer`,
    {
      shelter_id: shelterId,
      override_capacity: overrideCapacity,
      bed_label: bedLabel,
    }
  );
  return { checkIn: data.data, familySplitWarning: data.family_split_warning };
}

export async function updateBedAssignment(personId: string, bedLabel: string | null): Promise<CheckInRecord> {
  const { data } = await apiClient.patch<{ data: CheckInRecord }>(`/api/persons/${personId}/bed-assignment`, {
    bed_label: bedLabel,
  });
  return data.data;
}

export async function temporaryLeave(personId: string): Promise<CheckInRecord> {
  const { data } = await apiClient.post<{ data: CheckInRecord }>(`/api/persons/${personId}/temporary-leave`);
  return data.data;
}

export async function temporaryReturn(personId: string): Promise<CheckInRecord> {
  const { data } = await apiClient.post<{ data: CheckInRecord }>(`/api/persons/${personId}/temporary-return`);
  return data.data;
}

export async function fetchFamilies(eventId: string): Promise<FamilySummary[]> {
  const { data } = await apiClient.get<{ data: FamilySummary[] }>(`/api/events/${eventId}/families`);
  return data.data;
}

export async function fetchReunificationWorklist(eventId: string): Promise<FamilyReunificationEntry[]> {
  const { data } = await apiClient.get<{ data: FamilyReunificationEntry[] }>(
    `/api/events/${eventId}/families/reunification-worklist`
  );
  return data.data;
}

export async function fetchReunificationNotes(familyId: string): Promise<FamilyReunificationNote[]> {
  const { data } = await apiClient.get<{ data: FamilyReunificationNote[] }>(`/api/families/${familyId}/reunification-notes`);
  return data.data;
}

export async function addReunificationNote(
  familyId: string,
  payload: { note: string; resolved?: boolean }
): Promise<FamilyReunificationNote> {
  const { data } = await apiClient.post<{ data: FamilyReunificationNote }>(
    `/api/families/${familyId}/reunification-notes`,
    payload
  );
  return data.data;
}

export interface AuditLogFilters {
  entity_type?: string;
  action?: string;
  user_id?: number;
  event_id?: string;
  q?: string;
  significant_only?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
}

export async function fetchAuditLogs(params: AuditLogFilters = {}): Promise<AuditLogListResponse> {
  const { data } = await apiClient.get<AuditLogListResponse>('/api/audit-logs', { params });
  return data;
}

export async function fetchAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  const { data } = await apiClient.get<{ data: AuditLogFilterOptions }>('/api/audit-logs/filter-options');
  return data.data;
}

export function auditLogExportUrl(params: AuditLogFilters = {}): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return `${apiClient.defaults.baseURL}/api/audit-logs/export${queryString ? `?${queryString}` : ''}`;
}

// A municipalities/shelters törzsadat-végpontok nincsenek a projektleírás
// API-tervében külön felsorolva; a regisztrációs űrlaphoz szükséges egyszerű
// segédlekérdezések a meglévő shelters/events végpontokból származnak.
export async function fetchAllShelters(): Promise<Shelter[]> {
  const { data } = await apiClient.get<{ data: Shelter[] }>('/api/shelters');
  return data.data;
}

export interface ShelterPayload {
  name: string;
  municipality_id: number;
  address: string;
  capacity_total: number;
  accessible_capacity?: number;
  medical_support_available?: boolean;
  drinking_water_available?: boolean;
  meals_available?: boolean;
  hygiene_facilities_available?: boolean;
  childcare_available?: boolean;
  psychological_support_available?: boolean;
  house_rules?: string;
  public_health_notes?: string;
  status: Shelter['status'];
  contact_phone?: string;
}

export async function createShelter(payload: ShelterPayload): Promise<Shelter> {
  const { data } = await apiClient.post<{ data: Shelter }>('/api/shelters', payload);
  return data.data;
}

export async function updateShelter(shelterId: string, payload: Partial<ShelterPayload>): Promise<Shelter> {
  const { data } = await apiClient.put<{ data: Shelter }>(`/api/shelters/${shelterId}`, payload);
  return data.data;
}

export async function deleteShelter(shelterId: string): Promise<void> {
  await apiClient.delete(`/api/shelters/${shelterId}`);
}

export async function fetchUsers(): Promise<User[]> {
  const { data } = await apiClient.get<{ data: User[] }>('/api/users');
  return data.data;
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<{ data: Role[] }>('/api/roles');
  return data.data;
}

export interface UserPayload {
  name: string;
  email: string;
  password?: string;
  role_id: number;
  shelter_id?: string | null;
}

export async function createUser(payload: UserPayload): Promise<User> {
  const { data } = await apiClient.post<{ data: User }>('/api/users', payload);
  return data.data;
}

export async function updateUser(userId: number, payload: Partial<UserPayload>): Promise<User> {
  const { data } = await apiClient.put<{ data: User }>(`/api/users/${userId}`, payload);
  return data.data;
}

export async function uploadUserAvatar(userId: number, file: File): Promise<User> {
  const formData = new FormData();
  formData.append('avatar', file);
  const { data } = await apiClient.post<{ data: User }>(`/api/users/${userId}/avatar`, formData);
  return data.data;
}

export async function deleteUserAvatar(userId: number): Promise<User> {
  const { data } = await apiClient.delete<{ data: User }>(`/api/users/${userId}/avatar`);
  return data.data;
}

export type DocumentPhotoSide = 'front' | 'back';

export async function uploadPersonDocumentPhoto(personId: string, file: File, side: DocumentPhotoSide): Promise<Person> {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('side', side);
  const { data } = await apiClient.post<{ data: Person }>(`/api/persons/${personId}/document-photo`, formData);
  return data.data;
}

export async function deletePersonDocumentPhoto(personId: string, side: DocumentPhotoSide): Promise<Person> {
  const { data } = await apiClient.delete<{ data: Person }>(`/api/persons/${personId}/document-photo`, { params: { side } });
  return data.data;
}

export async function fetchMunicipalities(): Promise<Municipality[]> {
  const { data } = await apiClient.get<{ data: Municipality[] }>('/api/municipalities');
  return data.data;
}

export interface MunicipalityPayload {
  name: string;
  county: string;
  postal_code?: string;
  lat?: number;
  lng?: number;
}

export async function createMunicipality(payload: MunicipalityPayload): Promise<Municipality> {
  const { data } = await apiClient.post<{ data: Municipality }>('/api/municipalities', payload);
  return data.data;
}

export async function updateMunicipality(municipalityId: number, payload: Partial<MunicipalityPayload>): Promise<Municipality> {
  const { data } = await apiClient.put<{ data: Municipality }>(`/api/municipalities/${municipalityId}`, payload);
  return data.data;
}

export async function deleteMunicipality(municipalityId: number): Promise<void> {
  await apiClient.delete(`/api/municipalities/${municipalityId}`);
}

// Lakossági önkiszolgáló előregisztráció (Interreg tanulmány "1. fázis") —
// hitelesítés nélkül elérhető végpontok.
export interface PublicEventInfo {
  id: string;
  code: string;
  name: string;
  status: string;
}

export async function fetchPublicEvent(code: string): Promise<PublicEventInfo> {
  const { data } = await apiClient.get<{ data: PublicEventInfo }>(`/api/public/events/${code}`);
  return data.data;
}

export async function fetchPublicMunicipalities(): Promise<Municipality[]> {
  const { data } = await apiClient.get<{ data: Municipality[] }>('/api/public/municipalities');
  return data.data;
}

export interface SelfRegisterPayload {
  last_name: string;
  first_name: string;
  birth_place?: string;
  birth_date?: string;
  gender?: string;
  id_document_number?: string;
  municipality_id: number;
  address_postal_code?: string;
  address_settlement?: string;
  address_street?: string;
  address_house_number?: string;
  phone?: string;
  email?: string;
  central_transport_required?: boolean;
  central_accommodation_required?: boolean;
  under_regular_medical_care?: boolean;
  own_vehicle?: boolean;
  special_needs?: { category: string; type?: string; priority?: number; description?: string }[];
  animals?: { animal_type: string; count?: number; stays_at_address?: boolean }[];
}

export interface SelfRegisterResult {
  person_id: string;
  full_name: string;
  public_id: string;
}

export async function selfRegister(code: string, payload: SelfRegisterPayload): Promise<SelfRegisterResult> {
  const { data } = await apiClient.post<{ data: SelfRegisterResult }>(`/api/public/events/${code}/self-register`, payload);
  return data.data;
}

export interface SelfProfileUpdatePayload {
  address_postal_code?: string;
  address_settlement?: string;
  address_street?: string;
  address_house_number?: string;
  phone?: string;
  email?: string;
  central_transport_required?: boolean;
  central_accommodation_required?: boolean;
  special_needs?: { category: string; type?: string; priority?: number; description?: string }[];
}

export async function fetchSelfProfile(publicId: string): Promise<Person> {
  const { data } = await apiClient.get<{ data: Person }>(`/api/public/self-profile/${publicId}`);
  return data.data;
}

export async function updateSelfProfile(publicId: string, payload: SelfProfileUpdatePayload): Promise<Person> {
  const { data } = await apiClient.put<{ data: Person }>(`/api/public/self-profile/${publicId}`, payload);
  return data.data;
}

export async function confirmSelfArrival(publicId: string): Promise<Person> {
  const { data } = await apiClient.post<{ data: Person }>(`/api/public/self-profile/${publicId}/confirm-arrival`);
  return data.data;
}
