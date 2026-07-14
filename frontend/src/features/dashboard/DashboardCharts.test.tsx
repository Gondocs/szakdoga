import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardCharts } from './DashboardCharts';
import { fetchRegistrationsTimeline } from '../../lib/api/endpoints';
import type { DashboardData } from '../../types';

vi.mock('../../lib/api/endpoints', () => ({
  fetchRegistrationsTimeline: vi.fn(),
}));

const mockedFetchTimeline = vi.mocked(fetchRegistrationsTimeline);

function makeDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    registered_count: 187,
    families_count: 52,
    arrived_count: 171,
    central_transport_required_count: 34,
    central_accommodation_required_count: 0,
    special_needs_by_category: { medical: 0, mobility: 0, age: 0, diet: 0, animal: 0, other: 0 },
    status_breakdown: {
      registered: 0,
      checked_in_assembly: 0,
      in_transport: 0,
      arrived_shelter: 0,
      left_shelter: 0,
      returned_home: 0,
      missing: 0,
      cancelled: 0,
    },
    gender_breakdown: { male: 0, female: 0, other: 0 },
    age_breakdown: {},
    registrations_by_day: [],
    shelters: [],
    overall_risk: {
      score: 62.5,
      level: 'medium',
      utilization: 0.88,
      intake_rate_per_hour: 4.5,
      forecast_hours_to_full: 3.2,
    },
    ...overrides,
  };
}

describe('DashboardCharts', () => {
  it('a kockázati szintet és a telítettség százalékát megjeleníti', async () => {
    mockedFetchTimeline.mockResolvedValue([]);

    render(<DashboardCharts data={makeDashboardData()} eventId="event-1" />);

    expect(screen.getByText('Közepes')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('Kockázati pontszám: 62.5')).toBeInTheDocument();

    await waitFor(() => expect(mockedFetchTimeline).toHaveBeenCalledWith('event-1', 'day'));
  });

  it('a becsült telítődési időt olvasható szöveggé alakítja (óra múlva)', () => {
    mockedFetchTimeline.mockResolvedValue([]);

    render(<DashboardCharts data={makeDashboardData()} eventId="event-1" />);

    expect(screen.getByText(/4\.5 fő\/óra érkeztetési ütem mellett kb\. 3\.2 óra múlva telítődik\./)).toBeInTheDocument();
  });

  it('betelt kapacitásnál ("0 óra") a "betelt" üzenetet mutatja, nem "0 óra múlva"-t', () => {
    mockedFetchTimeline.mockResolvedValue([]);

    render(
      <DashboardCharts
        data={makeDashboardData({
          overall_risk: { score: 100, level: 'critical', utilization: 1, intake_rate_per_hour: 6, forecast_hours_to_full: 0 },
        })}
        eventId="event-1"
      />
    );

    expect(screen.getByText('A kapacitás betelt.')).toBeInTheDocument();
  });

  it('null előrejelzésnél azt jelzi, hogy nem várható telítődés', () => {
    mockedFetchTimeline.mockResolvedValue([]);

    render(
      <DashboardCharts
        data={makeDashboardData({
          overall_risk: { score: 10, level: 'low', utilization: 0.1, intake_rate_per_hour: 0, forecast_hours_to_full: null },
        })}
        eventId="event-1"
      />
    );

    expect(screen.getByText('A jelenlegi ütem mellett nem várható telítődés.')).toBeInTheDocument();
  });

  it('üres időbeli adatsor esetén (betöltés után) az "nincs adat" üzenetet mutatja diagram helyett', async () => {
    mockedFetchTimeline.mockResolvedValue([]);

    render(<DashboardCharts data={makeDashboardData()} eventId="event-1" />);

    expect(await screen.findAllByText('Nincs még megjeleníthető adat.')).not.toHaveLength(0);
  });

  it('az időintervallum váltógombra kattintva újra lekéri az időbeli adatsort az új felbontással', async () => {
    mockedFetchTimeline.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<DashboardCharts data={makeDashboardData()} eventId="event-1" />);

    await waitFor(() => expect(mockedFetchTimeline).toHaveBeenCalledWith('event-1', 'day'));

    await user.click(screen.getByRole('button', { name: 'Óránként' }));

    await waitFor(() => expect(mockedFetchTimeline).toHaveBeenCalledWith('event-1', 'hour'));
  });

  it('a "Speciális igények" panel csak akkor jelenik meg, ha van legalább egy nem nulla kategória', () => {
    mockedFetchTimeline.mockResolvedValue([]);

    const { rerender } = render(<DashboardCharts data={makeDashboardData()} eventId="event-1" />);
    expect(screen.queryByText('Speciális igények')).not.toBeInTheDocument();

    rerender(
      <DashboardCharts
        data={makeDashboardData({
          special_needs_by_category: { medical: 3, mobility: 0, age: 0, diet: 0, animal: 0, other: 0 },
        })}
        eventId="event-1"
      />
    );
    expect(screen.getByText('Speciális igények')).toBeInTheDocument();
  });
});
