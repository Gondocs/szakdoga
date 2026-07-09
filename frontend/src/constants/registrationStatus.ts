import type { RegistrationChannel, RegistrationStatus } from '../types';

export const registrationStatusLabels: Record<RegistrationStatus, string> = {
  registered: 'Regisztrált',
  checked_in_assembly: 'Megjelent a gyülekezőponton',
  in_transport: 'Szállítás alatt',
  arrived_shelter: 'Megérkezett',
  left_shelter: 'Befogadóhelyet elhagyta',
  returned_home: 'Visszatelepült',
  missing: 'Hiányzik',
  cancelled: 'Törölt',
};

export const registrationChannelLabels: Record<RegistrationChannel, string> = {
  staff: 'Hatósági',
  self_service: 'Önkiszolgáló',
};
