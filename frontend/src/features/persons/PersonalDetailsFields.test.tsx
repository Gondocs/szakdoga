import { describe, expect, it } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { PersonalDetailsFields, usePersonalDetailsForm, initialPersonalDetailsValues } from './PersonalDetailsFields';
import type { Municipality } from '../../types';

const municipalities: Municipality[] = [
  { id: 1, name: 'Győr', county: 'Győr-Moson-Sopron', postal_code: '9021' },
];

function Harness({ idDocumentNumberLabel }: { idDocumentNumberLabel?: string }) {
  const { values, setField } = usePersonalDetailsForm();
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <PersonalDetailsFields values={values} setField={setField} municipalities={municipalities} idDocumentNumberLabel={idDocumentNumberLabel} />
    </LocalizationProvider>
  );
}

describe('usePersonalDetailsForm', () => {
  it('kezdeti értékei üresek', () => {
    const { result } = renderHook(() => usePersonalDetailsForm());
    expect(result.current.values).toEqual(initialPersonalDetailsValues);
  });

  it('setField frissíti a megadott mezőt, a többit érintetlenül hagyva', () => {
    const { result } = renderHook(() => usePersonalDetailsForm());

    act(() => result.current.setField('lastName', 'Kovács'));
    act(() => result.current.setField('municipalityId', 1));

    expect(result.current.values.lastName).toBe('Kovács');
    expect(result.current.values.municipalityId).toBe(1);
    expect(result.current.values.firstName).toBe('');
  });

  it('reset visszaállítja a kezdeti (üres) állapotot', () => {
    const { result } = renderHook(() => usePersonalDetailsForm());

    act(() => result.current.setField('lastName', 'Kovács'));
    act(() => result.current.reset());

    expect(result.current.values).toEqual(initialPersonalDetailsValues);
  });

  it('toPayloadBase csak a kitöltött opcionális mezőket veszi bele (gender, id_document_number)', () => {
    const { result } = renderHook(() => usePersonalDetailsForm());

    act(() => {
      result.current.setField('lastName', 'Kovács');
      result.current.setField('firstName', 'Béla');
      result.current.setField('municipalityId', 1);
    });

    const payload = result.current.toPayloadBase();
    expect(payload).toMatchObject({ last_name: 'Kovács', first_name: 'Béla', municipality_id: 1 });
    expect(payload).not.toHaveProperty('gender');
    expect(payload).not.toHaveProperty('id_document_number');

    act(() => {
      result.current.setField('gender', 'female');
      result.current.setField('idDocumentNumber', 'AB123456');
    });

    const payloadWithOptional = result.current.toPayloadBase();
    expect(payloadWithOptional).toMatchObject({ gender: 'female', id_document_number: 'AB123456' });
  });
});

describe('PersonalDetailsFields', () => {
  it('gépeléskor a setField-en keresztül frissül az érték', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText(/Vezetéknév/), 'Nagy');

    expect(screen.getByLabelText(/Vezetéknév/)).toHaveValue('Nagy');
  });

  it('település kiválasztásakor a megfelelő id kerül a values.municipalityId-be', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('combobox', { name: /Település/ }));
    await user.click(await screen.findByRole('option', { name: 'Győr' }));

    expect(screen.getByRole('combobox', { name: /Település/ })).toHaveValue('Győr');
  });

  it('az idDocumentNumberLabel prop felülírja az alapértelmezett feliratot', () => {
    render(<Harness idDocumentNumberLabel="Személyazonosító okmány száma" />);

    expect(screen.getByLabelText('Személyazonosító okmány száma')).toBeInTheDocument();
    expect(screen.queryByLabelText('Okmányszám')).not.toBeInTheDocument();
  });
});
