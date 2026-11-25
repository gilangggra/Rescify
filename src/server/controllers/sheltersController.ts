import { Request, Response } from 'express';
import { Shelter, ShelterStatus } from '../../shared/types';
import { findShelterById, generateNextId, store } from '../store/jsonStore';
import { isNonEmptyString, sendError, sendSuccess } from '../utils/response';

const VALID_STATUSES: ShelterStatus[] = ['Open', 'Full', 'Closed'];

function isValidShelterStatus(value: unknown): value is ShelterStatus {
  return (
    typeof value === 'string' && VALID_STATUSES.includes(value as ShelterStatus)
  );
}

export function getAllShelters(_req: Request, res: Response): void {
  sendSuccess(res, 200, 'Shelters retrieved successfully', store.shelters);
}

export function getShelterById(req: Request, res: Response): void {
  const shelter = findShelterById(req.params.id);
  if (!shelter) {
    sendError(res, 404, `Shelter with ID '${req.params.id}' not found`);
    return;
  }

  sendSuccess(res, 200, 'Shelter retrieved successfully', shelter);
}

export function createShelter(req: Request, res: Response): void {
  const { name, location, max_capacity } = req.body as Partial<Shelter>;

  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(location) ||
    typeof max_capacity !== 'number' ||
    !Number.isInteger(max_capacity) ||
    max_capacity <= 0
  ) {
    sendError(
      res,
      400,
      "Invalid shelter payload. Required: non-empty 'name', 'location', and positive integer 'max_capacity'."
    );
    return;
  }

  const newShelter: Shelter = {
    shelter_id: generateNextId(store.shelters, 'SHL-', (s) => s.shelter_id),
    name: name.trim(),
    location: location.trim(),
    max_capacity,
    current_occupancy: 0,
    status: 'Open',
  };

  store.shelters.push(newShelter);
  sendSuccess(res, 201, 'Shelter registered successfully', newShelter);
}

export function updateShelter(req: Request, res: Response): void {
  const shelter = findShelterById(req.params.id);
  if (!shelter) {
    sendError(res, 404, `Shelter with ID '${req.params.id}' not found`);
    return;
  }

  const { name, location, max_capacity, status } = req.body as Partial<Shelter>;

  if (name !== undefined && !isNonEmptyString(name)) {
    sendError(res, 400, "Field 'name' must be a non-empty string.");
    return;
  }
  if (location !== undefined && !isNonEmptyString(location)) {
    sendError(res, 400, "Field 'location' must be a non-empty string.");
    return;
  }
  if (max_capacity !== undefined) {
    if (
      typeof max_capacity !== 'number' ||
      !Number.isInteger(max_capacity) ||
      max_capacity <= 0
    ) {
      sendError(res, 400, "Field 'max_capacity' must be a positive integer.");
      return;
    }
    if (max_capacity < shelter.current_occupancy) {
      sendError(
        res,
        400,
        `Cannot reduce max_capacity (${max_capacity}) below current_occupancy (${shelter.current_occupancy}).`
      );
      return;
    }
  }
  if (status !== undefined && !isValidShelterStatus(status)) {
    sendError(res, 400, "Field 'status' must be 'Open', 'Full', or 'Closed'.");
    return;
  }

  if (name !== undefined) shelter.name = name.trim();
  if (location !== undefined) shelter.location = location.trim();
  if (max_capacity !== undefined) shelter.max_capacity = max_capacity;

  if (status !== undefined) {
    shelter.status = status;
  } else if (shelter.status !== 'Closed') {
    shelter.status =
      shelter.current_occupancy >= shelter.max_capacity ? 'Full' : 'Open';
  }

  sendSuccess(res, 200, 'Shelter updated successfully', shelter);
}

export function deleteShelter(req: Request, res: Response): void {
  const index = store.shelters.findIndex((s) => s.shelter_id === req.params.id);
  if (index === -1) {
    sendError(res, 404, `Shelter with ID '${req.params.id}' not found`);
    return;
  }

  const targetShelter = store.shelters[index];
  const activeDispatches = store.emergency_dispatches.filter(
    (d) => d.shelter_id === targetShelter.shelter_id && d.status === 'Active'
  );
  if (activeDispatches.length > 0) {
    sendError(
      res,
      400,
      `Cannot delete shelter '${targetShelter.name}' while it has ${activeDispatches.length} active dispatch(es).`
    );
    return;
  }

  const [deletedShelter] = store.shelters.splice(index, 1);

  for (let i = store.emergency_dispatches.length - 1; i >= 0; i--) {
    if (store.emergency_dispatches[i].shelter_id === deletedShelter.shelter_id) {
      store.emergency_dispatches.splice(i, 1);
    }
  }

  sendSuccess(res, 200, 'Shelter deleted successfully', deletedShelter);
}
