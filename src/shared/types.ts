export type ShelterStatus = 'Open' | 'Full' | 'Closed';
export type TeamSpecialty = 'SAR' | 'Medical' | 'Logistics';
export type TeamStatus = 'Standby' | 'Deployed';
export type DispatchUrgency = 'Low' | 'Medium' | 'High' | 'Critical';
export type DispatchStatus = 'Active' | 'Completed';

export interface Shelter {
  shelter_id: string;
  name: string;
  location: string;
  max_capacity: number;
  current_occupancy: number;
  status: ShelterStatus;
}

export interface ResponseTeam {
  team_id: string;
  name: string;
  specialty: TeamSpecialty;
  member_count: number;
  status: TeamStatus;
}

export interface EmergencyDispatch {
  dispatch_id: string;
  shelter_id: string;
  team_id: string;
  incident_location: string;
  evacuee_count: number;
  urgency: DispatchUrgency;
  status: DispatchStatus;
  created_at: string;
  completed_at: string | null;
}

export interface EnrichedDispatch extends EmergencyDispatch {
  shelter_name: string;
  shelter_location: string;
  team_name: string;
  team_specialty: TeamSpecialty | 'Unknown';
}

export interface SafeGridStore {
  shelters: Shelter[];
  response_teams: ResponseTeam[];
  emergency_dispatches: EmergencyDispatch[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
