import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransportAccommodationFields } from './TransportAccommodationFields';

describe('TransportAccommodationFields', () => {
  it('alapértelmezett feliratokkal jeleníti meg a két jelölőt', () => {
    render(
      <TransportAccommodationFields
        centralTransportRequired={false}
        onCentralTransportRequiredChange={vi.fn()}
        centralAccommodationRequired={false}
        onCentralAccommodationRequiredChange={vi.fn()}
      />
    );

    expect(screen.getByRole('checkbox', { name: /Központi szállítást igényel/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Központi elszállásolást igényel/ })).not.toBeChecked();
  });

  it('egyedi feliratokat is elfogad (pl. első személyű önkiszolgáló szöveg)', () => {
    render(
      <TransportAccommodationFields
        centralTransportRequired
        onCentralTransportRequiredChange={vi.fn()}
        centralAccommodationRequired={false}
        onCentralAccommodationRequiredChange={vi.fn()}
        transportLabel="Központi szállítást igénylek"
        accommodationLabel="Központi elszállásolást igénylek"
      />
    );

    expect(screen.getByRole('checkbox', { name: /Központi szállítást igénylek/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Központi elszállásolást igénylek/ })).not.toBeChecked();
  });

  it('kattintáskor a megfelelő callbacket hívja a jelenlegi érték ellentettjével', async () => {
    const onTransportChange = vi.fn();
    const onAccommodationChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TransportAccommodationFields
        centralTransportRequired={false}
        onCentralTransportRequiredChange={onTransportChange}
        centralAccommodationRequired={true}
        onCentralAccommodationRequiredChange={onAccommodationChange}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: /Központi szállítást igényel/ }));
    await user.click(screen.getByRole('checkbox', { name: /Központi elszállásolást igényel/ }));

    expect(onTransportChange).toHaveBeenCalledWith(true);
    expect(onAccommodationChange).toHaveBeenCalledWith(false);
  });
});
