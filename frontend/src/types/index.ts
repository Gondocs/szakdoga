export type RoleCode = 'admin' | 'manager' | 'registrar' | 'shelter_operator' | 'auditor';

export interface Role {
  id: number;
  code: RoleCode;
  name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  role?: Role;
  shelter_id?: string | null;
  shelter?: { id: string; name: string } | null;
}

export type EventStatus = 'draft' | 'active' | 'paused' | 'closed';

export interface EventShelterSummary {
  id: number;
  shelter_id: string;
  shelter_name: string;
  capacity_limit: number;
  checked_in_count: number;
}

export interface EvacuationEvent {
  id: string;
  code: string;
  name: string;
  status: EventStatus;
  starts_at: string | null;
  ends_at: string | null;
  shelters?: EventShelterSummary[];
  created_at?: string;
}

export type RegistrationStatus =
  | 'registered'
  | 'checked_in_assembly'
  | 'in_transport'
  | 'arrived_shelter'
  | 'left_shelter'
  | 'returned_home'
  | 'missing'
  | 'cancelled';

export type RegistrationChannel = 'staff' | 'self_service';

export interface Registration {
  id: string;
  status: RegistrationStatus;
  channel?: RegistrationChannel;
  central_transport_required: boolean;
  central_accommodation_required: boolean;
  under_regular_medical_care: boolean;
  own_vehicle: boolean;
  travels_alone: boolean | null;
  registered_at: string;
  self_arrival_confirmed_at?: string | null;
}

export type SpecialNeedCategory = 'medical' | 'mobility' | 'age' | 'diet' | 'animal' | 'other';

export interface SpecialNeed {
  id: number;
  category: SpecialNeedCategory;
  type: string | null;
  priority: number;
  description: string | null;
}

export interface Animal {
  id: number;
  animal_type: string;
  count: number;
  stays_at_address: boolean;
}

export interface Person {
  id: string;
  event_id: string;
  citizen_id?: string | null;
  family_id: string | null;
  family?: { id: string; family_code: string } | null;
  last_name: string;
  first_name: string;
  full_name: string;
  birth_place: string | null;
  birth_date: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  id_document_number?: string | null;
  document_photo_front_url?: string | null;
  document_photo_back_url?: string | null;
  municipality?: { id: number; name: string };
  address: {
    postal_code: string | null;
    settlement: string | null;
    street: string | null;
    house_number: string | null;
  };
  phone: string | null;
  email: string | null;
  data_masked?: boolean;
  registration?: Registration | null;
  current_shelter?: { id: string; name: string } | null;
  special_needs?: SpecialNeed[];
  animals?: Animal[];
  created_at?: string;
}

export type ShelterStatus = 'planned' | 'active' | 'full' | 'inactive';

export interface Shelter {
  id: string;
  name: string;
  municipality?: string;
  coordinates?: { lat: number; lng: number } | null;
  address: string;
  capacity_total: number;
  accessible_capacity: number;
  medical_support_available: boolean;
  drinking_water_available: boolean;
  meals_available: boolean;
  hygiene_facilities_available: boolean;
  childcare_available: boolean;
  psychological_support_available: boolean;
  house_rules: string | null;
  public_health_notes: string | null;
  status: ShelterStatus;
  contact_phone: string | null;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ShelterWithRisk {
  event_shelter_id: number;
  shelter: Shelter;
  capacity_limit: number;
  checked_in_count: number;
  free_capacity: number;
  utilization: number;
  risk_score: number;
  risk_level: RiskLevel;
  match_score: number | null;
  match_reasons: string[];
  recommended: boolean;
}

export interface DashboardData {
  registered_count: number;
  families_count: number;
  arrived_count: number;
  central_transport_required_count: number;
  central_accommodation_required_count: number;
  special_needs_by_category: Record<SpecialNeedCategory, number>;
  status_breakdown: Record<RegistrationStatus, number>;
  gender_breakdown: { male: number; female: number; other: number };
  age_breakdown: Record<string, number>;
  registrations_by_day: { date: string; count: number }[];
  shelters: {
    shelter_id: string;
    shelter_name: string;
    capacity_limit: number;
    checked_in_count: number;
    utilization: number;
    risk_score: number;
    risk_level: RiskLevel;
  }[];
  overall_risk: {
    score: number;
    level: RiskLevel;
    utilization: number;
    intake_rate_per_hour: number;
    forecast_hours_to_full: number | null;
  };
}

// A backend App\Events\ShelterCapacityUpdated broadcastWith()-jének felel meg
// (mezőnevek szándékosan megegyeznek a DashboardData['shelters'][number]
// mezőivel, hogy ugyanazzal az alakkal lehessen frissíteni a state-et).
export interface ShelterCapacityUpdatedPayload {
  shelter_id: string;
  shelter_name: string;
  checked_in_count: number;
  capacity_limit: number;
  risk_score: number;
  risk_level: RiskLevel;
  utilization: number;
}

// A backend App\Events\IncidentCreated broadcastWith()-jének felel meg.
export interface IncidentCreatedPayload {
  incident_id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  shelter_name: string | null;
  description: string;
}

// A backend App\Events\TransportPositionUpdated broadcastWith()-jének felel
// meg — ugyanazon az event.{id}.updates csatornán érkezik, mint a
// ShelterCapacityUpdated.
export interface TransportPositionUpdatedPayload {
  transport_id: string;
  code: string;
  last_lat: number | null;
  last_lng: number | null;
  last_position_at: string | null;
}

// A backend App\Events\AuditLogRecorded broadcastWith()-jének felel meg —
// szándékosan nem tartalmazza a before/after_json mezőket (lásd a backend
// oldali kommentet), csak a napló élő csíkjához elég könnyű metaadatokat.
export interface AuditLogRecordedPayload {
  id: number;
  action: string;
  entity_type: string;
  user_name: string;
  significant: boolean;
  created_at: string;
}

export type RepatriationStatus = 'not_permitted' | 'conditional' | 'permitted';

export interface RepatriationAuthorization {
  municipality_id: number;
  municipality_name: string;
  status: RepatriationStatus;
  conditions_note: string | null;
  window_starts_at: string | null;
  window_ends_at: string | null;
  updated_by: string | null;
  person_count: number;
  returned_count: number;
}

export type IncidentCategory = 'complaint' | 'conflict' | 'security' | 'damage' | 'other';
export type IncidentSeverity = 'low' | 'medium' | 'high';
export type IncidentStatus = 'open' | 'resolved';

export interface Incident {
  id: number;
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  shelter: { id: string; name: string } | null;
  person: { id: string; full_name: string } | null;
  reported_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AssemblyPoint {
  id: number;
  event_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  notes: string | null;
  created_at: string;
}

export type CareEventCategory = 'meal' | 'aid_package' | 'medical' | 'hygiene' | 'other';

export interface CareEvent {
  id: number;
  person_id: string;
  category: CareEventCategory;
  note: string | null;
  shelter: { id: string; name: string } | null;
  recorded_by: string | null;
  recorded_at: string;
}

export type QrDeliveryMethod = 'digital' | 'card' | 'wristband' | 'paper';

export interface QrTokenData {
  id: number;
  public_id: string;
  status: 'active' | 'revoked' | 'expired';
  person_id: string | null;
  family_id: string | null;
  delivery_method: QrDeliveryMethod | null;
  delivered_at: string | null;
  created_at: string;
}

export interface CheckInRecord {
  id: number;
  event_id: string;
  person: { id: string; full_name: string };
  shelter: { id: string; name: string };
  bed_label?: string | null;
  checked_in_at: string;
  checked_in_by: string;
  temporary_leave_at?: string | null;
  temporary_return_at?: string | null;
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user: string | null;
  event_id: string | null;
  event?: { id: string; code: string; name: string } | null;
  action: string;
  entity_type: string;
  entity_id: string;
  significant: boolean;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  data_masked?: boolean;
  created_at: string;
}

export interface AuditLogFilterOptions {
  users: { id: number; name: string }[];
  events: { id: string; code: string; name: string }[];
}

export interface FamilyReunificationEntry {
  id: string;
  family_code: string;
  members: {
    id: string;
    full_name: string;
    current_shelter: string | null;
    shelter_id: string | null;
    shelter_coordinates: { lat: number; lng: number } | null;
  }[];
  latest_note: { note: string; resolved: boolean } | null;
  notes_count: number;
}

export interface FamilyReunificationNote {
  id: number;
  note: string;
  resolved: boolean;
  created_by: string | null;
  created_at: string;
}

export interface FamilySummary {
  id: string;
  family_code: string;
  members_count: number;
  primary_contact_person_id: string | null;
  is_split: boolean;
}

export interface FamilyDetail {
  id: string;
  family_code: string;
  primary_contact_person_id: string | null;
  members: Person[];
}

export interface StatusHistoryEntry {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  created_at: string;
}

export interface Municipality {
  id: number;
  name: string;
  county: string;
  postal_code: string;
  lat?: number | null;
  lng?: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
  links?: unknown;
}

export interface AuditLogListResponse extends Paginated<AuditLogEntry> {
  meta?: Paginated<AuditLogEntry>['meta'] & {
    summary?: { today_count: number; today_significant_count: number };
  };
}

export interface ApiError {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}
