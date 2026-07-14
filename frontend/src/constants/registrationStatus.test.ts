import { describe, expect, it } from 'vitest';
import { registrationChannelLabels, registrationStatusLabels } from './registrationStatus';
import type { RegistrationChannel, RegistrationStatus } from '../types';

// A backend RegistrationStatus/RegistrationChannel enumjaival egyeznie kell a
// listának — ha a backend egy új státuszt vezet be és a frontend label-map
// lemarad mögötte, ez a teszt jelzi (TS hiba a hiányzó kulcsra, illetve
// hiányzó/üres label esetén itt bukik el futásidőben is).
const allStatuses: RegistrationStatus[] = [
  'registered',
  'checked_in_assembly',
  'in_transport',
  'arrived_shelter',
  'left_shelter',
  'returned_home',
  'missing',
  'cancelled',
];

const allChannels: RegistrationChannel[] = ['staff', 'self_service'];

describe('registrationStatusLabels', () => {
  it('minden regisztrációs státuszhoz nem üres magyar címkét rendel', () => {
    for (const status of allStatuses) {
      expect(registrationStatusLabels[status]).toBeTruthy();
    }
  });

  it('nincs felesleges, dokumentálatlan kulcs a map-ben', () => {
    expect(Object.keys(registrationStatusLabels).sort()).toEqual([...allStatuses].sort());
  });
});

describe('registrationChannelLabels', () => {
  it('minden regisztrációs csatornához nem üres magyar címkét rendel', () => {
    for (const channel of allChannels) {
      expect(registrationChannelLabels[channel]).toBeTruthy();
    }
  });
});
