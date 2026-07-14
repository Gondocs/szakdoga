import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpecialNeedIcon } from './SpecialNeedIcon';

describe('SpecialNeedIcon', () => {
  it('a kategóriának megfelelő ikont jeleníti meg', () => {
    render(<SpecialNeedIcon category="medical" />);

    expect(screen.getByTestId('LocalHospitalIcon')).toBeInTheDocument();
  });

  it('ismeretlen (típushibás) kategóriánál a "Egyéb" ikonra esik vissza, nem omlik össze', () => {
    render(<SpecialNeedIcon category={'unknown' as never} />);

    expect(screen.getByTestId('HelpOutlineIcon')).toBeInTheDocument();
  });

  it('a tooltip a katalógusbeli típus címkéjét mutatja, ha van típus megadva', async () => {
    const user = userEvent.setup();
    render(<SpecialNeedIcon category="mobility" needType="bedridden" />);

    await user.hover(screen.getByTestId('AccessibleForwardIcon'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Mozgás-/érzékszervi korlátozottság (Ágyhoz kötött)');
  });

  it('típus hiányában a szabad szöveges leírást mutatja a tooltipben', async () => {
    const user = userEvent.setup();
    render(<SpecialNeedIcon category="other" needDescription="Egyedi, nem katalogizált igény" />);

    await user.hover(screen.getByTestId('HelpOutlineIcon'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Egyéb (Egyedi, nem katalogizált igény)');
  });

  it('a "title" prop felülírja az automatikusan képzett tooltip-szöveget', async () => {
    const user = userEvent.setup();
    render(<SpecialNeedIcon category="diet" needType="vegan" title="Egyedi felülírt szöveg" />);

    await user.hover(screen.getByTestId('RestaurantIcon'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Egyedi felülírt szöveg');
  });
});
