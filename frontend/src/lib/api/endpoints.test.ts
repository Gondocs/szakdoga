import { describe, expect, it } from 'vitest';
import {
  apiBaseUrl,
  auditLogExportUrl,
  personsExportUrl,
  shelterRosterExportUrl,
  summaryReportExportUrl,
} from './endpoints';

// Ezek a függvények nem hálózati hívást indítanak, hanem letölthető
// export-linkeket állítanak elő (pl. egy <a href> vagy window.open célja),
// ezért tesztelhetők valódi API-mock nélkül is.

describe('export URL builders', () => {
  it('apiBaseUrl a konfigurált API alapcímet adja vissza', () => {
    expect(apiBaseUrl()).toBe('http://localhost:8000');
  });

  it('personsExportUrl az esemény személyi CSV-exportjának útvonalát építi', () => {
    expect(personsExportUrl('event-1')).toBe('http://localhost:8000/api/events/event-1/persons/export');
  });

  it('shelterRosterExportUrl a befogadóhely névsor-exportjának útvonalát építi', () => {
    expect(shelterRosterExportUrl('event-1', 'shelter-2')).toBe(
      'http://localhost:8000/api/events/event-1/shelters/shelter-2/roster-export'
    );
  });

  it('summaryReportExportUrl az összesítő riport exportjának útvonalát építi', () => {
    expect(summaryReportExportUrl('event-1')).toBe('http://localhost:8000/api/events/event-1/report-export');
  });

  it('auditLogExportUrl paraméterek nélkül lekérdezés-string nélküli URL-t ad', () => {
    expect(auditLogExportUrl()).toBe('http://localhost:8000/api/audit-logs/export');
  });

  it('auditLogExportUrl a megadott szűrőket lekérdezés-stringgé alakítja', () => {
    const url = auditLogExportUrl({ event_id: 'event-1', significant_only: true, q: 'kovács' });

    const expectedQuery = new URLSearchParams({
      event_id: 'event-1',
      significant_only: 'true',
      q: 'kovács',
    }).toString();
    expect(url).toBe(`http://localhost:8000/api/audit-logs/export?${expectedQuery}`);
  });

  it('auditLogExportUrl kihagyja az undefined, null és üres string értékű szűrőket', () => {
    const url = auditLogExportUrl({ event_id: 'event-1', user_id: undefined, q: '', date_from: undefined });

    expect(url).toBe('http://localhost:8000/api/audit-logs/export?event_id=event-1');
  });
});
