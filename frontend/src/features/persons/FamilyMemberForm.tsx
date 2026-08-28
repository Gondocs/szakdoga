import { Box } from '@mui/material';
import DirectionsCarFilledIcon from '@mui/icons-material/DirectionsCarFilled';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import type { AssemblyPoint, Municipality } from '../../types';
import { PersonalDetailsFields, initialPersonalDetailsValues, personalDetailsToPayloadBase, type PersonalDetailsValues } from './PersonalDetailsFields';
import { TransportAccommodationFields } from './TransportAccommodationFields';
import { AssemblyPointField } from './AssemblyPointField';
import { SpecialNeedsEditor, type SpecialNeedRow } from './SpecialNeedsEditor';
import { SelectableToggleCard } from '../../components/ui/SelectableToggleCard';

export interface MemberFormState {
  values: PersonalDetailsValues;
  ownVehicle: boolean;
  centralTransportRequired: boolean;
  centralAccommodationRequired: boolean;
  underRegularMedicalCare: boolean;
  assemblyPointId: number | '';
  specialNeeds: SpecialNeedRow[];
}

export function makeEmptyMember(): MemberFormState {
  return {
    values: { ...initialPersonalDetailsValues },
    ownVehicle: false,
    centralTransportRequired: false,
    centralAccommodationRequired: false,
    underRegularMedicalCare: false,
    assemblyPointId: '',
    specialNeeds: [],
  };
}

/**
 * Ugyanaz a payload-leképezés minden családtagra, amit mind a helyszíni
 * regisztrációs varázsló (több tag egy kérésben, `createPersonFamily`),
 * mind az önkiszolgáló előregisztráció (`selfRegisterFamily`) használ.
 */
export function memberToPayloadBase(member: MemberFormState) {
  return {
    ...personalDetailsToPayloadBase(member.values),
    own_vehicle: member.ownVehicle,
    assembly_point_id: member.ownVehicle || member.assemblyPointId === '' ? undefined : member.assemblyPointId,
    central_transport_required: member.centralTransportRequired,
    central_accommodation_required: member.centralAccommodationRequired,
    under_regular_medical_care: member.underRegularMedicalCare,
    special_needs: member.specialNeeds.length
      ? member.specialNeeds.map((row) => ({ category: row.category, type: row.type || undefined, description: row.description || undefined }))
      : undefined,
  };
}

interface FamilyMemberFormProps {
  member: MemberFormState;
  setField: <K extends keyof PersonalDetailsValues>(key: K, value: PersonalDetailsValues[K]) => void;
  onChange: (patch: Partial<Omit<MemberFormState, 'values'>>) => void;
  municipalities: Municipality[];
  assemblyPoints: AssemblyPoint[];
  idDocumentNumberLabel?: string;
  ownVehicleLabel?: string;
  ownVehicleDescription?: string;
  transportLabel?: string;
  accommodationLabel?: string;
  transportDescription?: string;
  accommodationDescription?: string;
  showMedicalCare?: boolean;
}

/**
 * Egy családtag teljes adatlapja (személyes adatok, szállítási/ellátási
 * igények, speciális igények) — a helyszíni regisztrációs varázsló és az
 * önkiszolgáló előregisztráció közös, tagonként ismételhető építőeleme,
 * hogy a két felület ne tudjon egymástól függetlenül szétdriftelni.
 */
export function FamilyMemberForm({
  member,
  setField,
  onChange,
  municipalities,
  assemblyPoints,
  idDocumentNumberLabel,
  ownVehicleLabel = 'Saját járművel távozik',
  ownVehicleDescription = 'Akkor jelölje, ha a személy saját autóval, önválasztott helyre utazik — ez kizárja a központi szállítás egyidejű igénylését.',
  transportLabel,
  accommodationLabel,
  transportDescription,
  accommodationDescription,
  showMedicalCare = false,
}: FamilyMemberFormProps) {
  // A központi szállítás igénylése és a saját járművel történő,
  // önválasztott helyre utazás kölcsönösen kizárja egymást — nem lehet
  // egyszerre mindkettőt jelölni, ezért az egyik bejelölése automatikusan
  // kikapcsolja a másikat.
  function handleTransportChange(value: boolean) {
    onChange(value ? { centralTransportRequired: true, ownVehicle: false } : { centralTransportRequired: false });
  }

  function handleOwnVehicleChange(value: boolean) {
    onChange(value ? { ownVehicle: true, centralTransportRequired: false, assemblyPointId: '' } : { ownVehicle: false });
  }

  return (
    <>
      <PersonalDetailsFields values={member.values} setField={setField} municipalities={municipalities} idDocumentNumberLabel={idDocumentNumberLabel} />

      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <TransportAccommodationFields
          centralTransportRequired={member.centralTransportRequired}
          onCentralTransportRequiredChange={handleTransportChange}
          centralAccommodationRequired={member.centralAccommodationRequired}
          onCentralAccommodationRequiredChange={(v) => onChange({ centralAccommodationRequired: v })}
          transportLabel={transportLabel}
          accommodationLabel={accommodationLabel}
          transportDescription={transportDescription}
          accommodationDescription={accommodationDescription}
        />
        <SelectableToggleCard
          checked={member.ownVehicle}
          onChange={handleOwnVehicleChange}
          icon={<DirectionsCarFilledIcon fontSize="small" />}
          label={ownVehicleLabel}
          description={ownVehicleDescription}
        />
        {showMedicalCare && (
          <SelectableToggleCard
            checked={member.underRegularMedicalCare}
            onChange={(v) => onChange({ underRegularMedicalCare: v })}
            icon={<MedicalServicesIcon fontSize="small" />}
            label="Állandó egészségügyi ellátás alatt áll"
            description="Akkor válassza, ha a személy rendszeres gyógyszerelésre vagy orvosi felügyeletre szorul — ez segít a befogadóhelyi ellátás megszervezésében."
          />
        )}
      </Box>

      {!member.ownVehicle && (
        <Box sx={{ mt: 2 }}>
          <AssemblyPointField
            assemblyPoints={assemblyPoints}
            value={member.assemblyPointId}
            onChange={(id) => onChange({ assemblyPointId: id })}
          />
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        <SpecialNeedsEditor rows={member.specialNeeds} onChange={(rows) => onChange({ specialNeeds: rows })} />
      </Box>
    </>
  );
}
