import { Request, Response } from 'express';
import {
  DispatchStatus,
  DispatchUrgency,
  EmergencyDispatch,
  EnrichedDispatch,
} from '../../shared/types';
import {
  findDispatchById,
  findShelterById,
  findTeamById,
  generateNextId,
  store,
} from '../store/jsonStore';
import { isNonEmptyString, sendError, sendSuccess } from '../utils/response';

const VALID_URGENCIES: DispatchUrgency[] = ['Low', 'Medium', 'High', 'Critical'];
const VALID_STATUSES: DispatchStatus[] = ['Active', 'Completed'];

function isValidUrgency(value: unknown): value is DispatchUrgency {
  return (
    typeof value === 'string' &&
    VALID_URGENCIES.includes(value as DispatchUrgency)
  );
}

function isValidDispatchStatus(value: unknown): value is DispatchStatus {
  return (
    typeof value === 'string' &&
    VALID_STATUSES.includes(value as DispatchStatus)
  );
}

function enrichDispatch(dispatch: EmergencyDispatch): EnrichedDispatch {
  const shelter = findShelterById(dispatch.shelter_id);
  const team = findTeamById(dispatch.team_id);

  return {
    ...dispatch,
    shelter_name: shelter ? shelter.name : 'Unknown Shelter',
    shelter_location: shelter ? shelter.location : '-',
    team_name: team ? team.name : 'Unknown Team',
    team_specialty: team ? team.specialty : 'Unknown',
  };
}

export function getAllDispatches(req: Request, res: Response): void {
  const shelterId =
    typeof req.query.shelter_id === 'string' ? req.query.shelter_id.trim() : '';
  const status =
    typeof req.query.status === 'string' ? req.query.status.trim() : '';

  const filtered = store.emergency_dispatches.filter((d) => {
    if (shelterId && d.shelter_id !== shelterId) return false;
    if (status && d.status !== status) return false;
    return true;
  });

  sendSuccess(
    res,
    200,
    'Emergency dispatches retrieved successfully',
    filtered.map(enrichDispatch)
  );
}

export function getDispatchById(req: Request, res: Response): void {
  const dispatch = findDispatchById(req.params.id);
  if (!dispatch) {
    sendError(res, 404, `Dispatch with ID '${req.params.id}' not found`);
    return;
  }

  sendSuccess(
    res,
    200,
    'Emergency dispatch retrieved successfully',
    enrichDispatch(dispatch)
  );
}

export function createDispatch(req: Request, res: Response): void {
  const { shelter_id, team_id, incident_location, evacuee_count, urgency } =
    req.body as Partial<EmergencyDispatch>;

  if (
    !isNonEmptyString(shelter_id) ||
    !isNonEmptyString(team_id) ||
    !isNonEmptyString(incident_location) ||
    typeof evacuee_count !== 'number' ||
    !Number.isInteger(evacuee_count) ||
    evacuee_count <= 0 ||
    !isValidUrgency(urgency)
  ) {
    sendError(
      res,
      400,
      "Invalid dispatch payload. Required: 'shelter_id', 'team_id', 'incident_location', positive integer 'evacuee_count', and 'urgency'."
    );
    return;
  }

  const trimmedShelterId = shelter_id.trim();
  const trimmedTeamId = team_id.trim();

  const shelter = findShelterById(trimmedShelterId);
  if (!shelter) {
    sendError(res, 404, `Shelter with ID '${trimmedShelterId}' not found`);
    return;
  }

  const team = findTeamById(trimmedTeamId);
  if (!team) {
    sendError(res, 404, `Response team with ID '${trimmedTeamId}' not found`);
    return;
  }

  if (
    shelter.status !== 'Open' ||
    shelter.current_occupancy + evacuee_count > shelter.max_capacity
  ) {
    sendError(res, 400, 'Insufficient shelter capacity');
    return;
  }

  if (team.status !== 'Standby') {
    sendError(res, 400, 'Response team is currently deployed');
    return;
  }

  const newDispatch: EmergencyDispatch = {
    dispatch_id: generateNextId(
      store.emergency_dispatches,
      'DSP-',
      (d) => d.dispatch_id
    ),
    shelter_id: trimmedShelterId,
    team_id: trimmedTeamId,
    incident_location: incident_location.trim(),
    evacuee_count,
    urgency,
    status: 'Active',
    created_at: new Date().toISOString(),
    completed_at: null,
  };

  store.emergency_dispatches.unshift(newDispatch);

  shelter.current_occupancy += evacuee_count;
  if (shelter.current_occupancy >= shelter.max_capacity) {
    shelter.status = 'Full';
  }
  team.status = 'Deployed';

  sendSuccess(
    res,
    201,
    'Emergency dispatch issued and shelter capacity reserved',
    enrichDispatch(newDispatch)
  );
}

export function updateDispatch(req: Request, res: Response): void {
  const dispatch = findDispatchById(req.params.id);
  if (!dispatch) {
    sendError(res, 404, `Dispatch with ID '${req.params.id}' not found`);
    return;
  }

  const { incident_location, urgency, status } =
    req.body as Partial<EmergencyDispatch>;

  if (incident_location !== undefined && !isNonEmptyString(incident_location)) {
    sendError(res, 400, "Field 'incident_location' must be a non-empty string.");
    return;
  }
  if (urgency !== undefined && !isValidUrgency(urgency)) {
    sendError(
      res,
      400,
      "Field 'urgency' must be 'Low', 'Medium', 'High', or 'Critical'."
    );
    return;
  }
  if (status !== undefined && !isValidDispatchStatus(status)) {
    sendError(res, 400, "Field 'status' must be 'Active' or 'Completed'.");
    return;
  }

  if (incident_location !== undefined) {
    dispatch.incident_location = incident_location.trim();
  }
  if (urgency !== undefined) {
    dispatch.urgency = urgency;
  }

  if (status !== undefined && status !== dispatch.status) {
    const team = findTeamById(dispatch.team_id);
    if (status === 'Completed') {
      dispatch.status = 'Completed';
      dispatch.completed_at = new Date().toISOString();
      if (team) {
        team.status = 'Standby';
      }
    } else {
      if (team && team.status !== 'Standby') {
        sendError(
          res,
          400,
          'Cannot reopen dispatch because assigned team is currently deployed elsewhere.'
        );
        return;
      }
      dispatch.status = 'Active';
      dispatch.completed_at = null;
      if (team) {
        team.status = 'Deployed';
      }
    }
  }

  sendSuccess(
    res,
    200,
    'Emergency dispatch updated successfully',
    enrichDispatch(dispatch)
  );
}

export function deleteDispatch(req: Request, res: Response): void {
  const index = store.emergency_dispatches.findIndex(
    (d) => d.dispatch_id === req.params.id
  );
  if (index === -1) {
    sendError(res, 404, `Dispatch with ID '${req.params.id}' not found`);
    return;
  }

  const [deletedDispatch] = store.emergency_dispatches.splice(index, 1);

  if (deletedDispatch.status === 'Active') {
    const shelter = findShelterById(deletedDispatch.shelter_id);
    if (shelter) {
      shelter.current_occupancy = Math.max(
        0,
        shelter.current_occupancy - deletedDispatch.evacuee_count
      );
      if (shelter.status === 'Full' && shelter.current_occupancy < shelter.max_capacity) {
        shelter.status = 'Open';
      }
    }

    const team = findTeamById(deletedDispatch.team_id);
    if (team) {
      team.status = 'Standby';
    }
  }

  sendSuccess(
    res,
    200,
    'Emergency dispatch cancelled and resources rolled back',
    deletedDispatch
  );
}
