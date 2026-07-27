import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpTip } from './HelpTip';

describe('HelpTip', () => {
  it('alapból nem jeleníti meg a magyarázó szöveget', () => {
    render(<HelpTip text="Ez egy magyarázat." />);

    expect(screen.queryByText('Ez egy magyarázat.')).not.toBeInTheDocument();
  });

  it('a "?" jelvényre kattintva megjeleníti a magyarázó szöveget', async () => {
    const user = userEvent.setup();
    render(<HelpTip text="Ez egy magyarázat." />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Ez egy magyarázat.')).toBeInTheDocument();
  });
});
