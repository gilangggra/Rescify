import {
  EmergencyDispatch,
  ResponseTeam,
  RescifyStore,
  Shelter,
} from '../../shared/types';

const INITIAL_SEED_DATA: RescifyStore = {
  shelters: [
    {
      shelter_id: 'SHL-01',
      name: 'Posko Utama GOR Baleendah',
      location: 'Baleendah, Kab. Bandung',
      max_capacity: 120,
      current_occupancy: 45,
      status: 'Open',
    },
    {
      shelter_id: 'SHL-02',
      name: 'Aula Kecamatan Dayeuhkolot',
      location: 'Dayeuhkolot, Kab. Bandung',
      max_capacity: 80,
      current_occupancy: 80,
      status: 'Full',
    },
    {
      shelter_id: 'SHL-03',
      name: 'Gedung Serbaguna Bojongsoang',
      location: 'Bojongsoang, Kab. Bandung',
      max_capacity: 100,
      current_occupancy: 20,
      status: 'Open',
    },
  ],
  response_teams: [
    {
      team_id: 'TM-01',
      name: 'Tim SAR Basarnas Bandung',
      specialty: 'SAR',
      member_count: 8,
      status: 'Deployed',
    },
    {
      team_id: 'TM-02',
      name: 'Tim Medis PMI & PSC 119',
      specialty: 'Medical',
      member_count: 6,
      status: 'Standby',
    },
    {
      team_id: 'TM-03',
      name: 'Tim Logistik Tagana BPBD',
      specialty: 'Logistics',
      member_count: 10,
      status: 'Standby',
    },
  ],
  emergency_dispatches: [
    {
      dispatch_id: 'DSP-01',
      shelter_id: 'SHL-01',
      team_id: 'TM-01',
      incident_location: 'Kampung Cieunteung RW 04',
      evacuee_count: 45,
      urgency: 'Critical',
      status: 'Active',
      created_at: '2026-11-25T14:00:00Z',
      completed_at: null,
    },
  ],
};

function cloneSeedData(): RescifyStore {
  return {
    shelters: INITIAL_SEED_DATA.shelters.map((s) => ({ ...s })),
    response_teams: INITIAL_SEED_DATA.response_teams.map((t) => ({ ...t })),
    emergency_dispatches: INITIAL_SEED_DATA.emergency_dispatches.map((d) => ({ ...d })),
  };
}

export const store: RescifyStore = cloneSeedData();

export function resetStore(): RescifyStore {
  const fresh = cloneSeedData();
  store.shelters.splice(0, store.shelters.length, ...fresh.shelters);
  store.response_teams.splice(0, store.response_teams.length, ...fresh.response_teams);
  store.emergency_dispatches.splice(
    0,
    store.emergency_dispatches.length,
    ...fresh.emergency_dispatches
  );
  return getStoreSnapshot();
}

export function getStoreSnapshot(): RescifyStore {
  return {
    shelters: store.shelters.map((s) => ({ ...s })),
    response_teams: store.response_teams.map((t) => ({ ...t })),
    emergency_dispatches: store.emergency_dispatches.map((d) => ({ ...d })),
  };
}

export function generateNextId<T>(
  items: T[],
  prefix: string,
  getId: (item: T) => string
): string {
  let maxNumber = 0;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}(\\d+)$`);

  for (const item of items) {
    const match = pattern.exec(getId(item));
    if (match) {
      const num = Number.parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }

  return `${prefix}${String(maxNumber + 1).padStart(2, '0')}`;
}

export function findShelterById(shelterId: string): Shelter | undefined {
  return store.shelters.find((s) => s.shelter_id === shelterId);
}

export function findTeamById(teamId: string): ResponseTeam | undefined {
  return store.response_teams.find((t) => t.team_id === teamId);
}

export function findDispatchById(dispatchId: string): EmergencyDispatch | undefined {
  return store.emergency_dispatches.find((d) => d.dispatch_id === dispatchId);
}
