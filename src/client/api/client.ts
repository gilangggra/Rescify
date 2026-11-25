import {
  ApiResponse,
  DispatchStatus,
  DispatchUrgency,
  EmergencyDispatch,
  EnrichedDispatch,
  ResponseTeam,
  Shelter,
  ShelterStatus,
  TeamSpecialty,
  TeamStatus,
} from '../../shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json: ApiResponse<T> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Request failed');
  }
  return json.data;
}

export const api = {
  getShelters: () => request<Shelter[]>('/api/shelters'),
  createShelter: (payload: {
    name: string;
    location: string;
    max_capacity: number;
  }) =>
    request<Shelter>('/api/shelters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateShelter: (
    id: string,
    payload: Partial<{
      name: string;
      location: string;
      max_capacity: number;
      status: ShelterStatus;
    }>
  ) =>
    request<Shelter>(`/api/shelters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteShelter: (id: string) =>
    request<Shelter>(`/api/shelters/${id}`, { method: 'DELETE' }),

  getTeams: () => request<ResponseTeam[]>('/api/teams'),
  createTeam: (payload: {
    name: string;
    specialty: TeamSpecialty;
    member_count: number;
  }) =>
    request<ResponseTeam>('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateTeam: (
    id: string,
    payload: Partial<{
      name: string;
      specialty: TeamSpecialty;
      member_count: number;
      status: TeamStatus;
    }>
  ) =>
    request<ResponseTeam>(`/api/teams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteTeam: (id: string) =>
    request<ResponseTeam>(`/api/teams/${id}`, { method: 'DELETE' }),

  getDispatches: () => request<EnrichedDispatch[]>('/api/dispatches'),
  createDispatch: (payload: {
    shelter_id: string;
    team_id: string;
    incident_location: string;
    evacuee_count: number;
    urgency: DispatchUrgency;
  }) =>
    request<EnrichedDispatch>('/api/dispatches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateDispatch: (
    id: string,
    payload: Partial<{
      incident_location: string;
      urgency: DispatchUrgency;
      status: DispatchStatus;
    }>
  ) =>
    request<EnrichedDispatch>(`/api/dispatches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteDispatch: (id: string) =>
    request<EmergencyDispatch>(`/api/dispatches/${id}`, { method: 'DELETE' }),
};
