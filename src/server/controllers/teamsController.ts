import { Request, Response } from 'express';
import { ResponseTeam, TeamSpecialty, TeamStatus } from '../../shared/types';
import { findTeamById, generateNextId, store } from '../store/jsonStore';
import { isNonEmptyString, sendError, sendSuccess } from '../utils/response';

const VALID_SPECIALTIES: TeamSpecialty[] = ['SAR', 'Medical', 'Logistics'];
const VALID_STATUSES: TeamStatus[] = ['Standby', 'Deployed'];

function isValidSpecialty(value: unknown): value is TeamSpecialty {
  return (
    typeof value === 'string' &&
    VALID_SPECIALTIES.includes(value as TeamSpecialty)
  );
}

function isValidTeamStatus(value: unknown): value is TeamStatus {
  return (
    typeof value === 'string' && VALID_STATUSES.includes(value as TeamStatus)
  );
}

export function getAllTeams(_req: Request, res: Response): void {
  sendSuccess(
    res,
    200,
    'Response teams retrieved successfully',
    store.response_teams
  );
}

export function getTeamById(req: Request, res: Response): void {
  const team = findTeamById(req.params.id);
  if (!team) {
    sendError(res, 404, `Response team with ID '${req.params.id}' not found`);
    return;
  }

  sendSuccess(res, 200, 'Response team retrieved successfully', team);
}

export function createTeam(req: Request, res: Response): void {
  const { name, specialty, member_count } = req.body as Partial<ResponseTeam>;

  if (
    !isNonEmptyString(name) ||
    !isValidSpecialty(specialty) ||
    typeof member_count !== 'number' ||
    !Number.isInteger(member_count) ||
    member_count <= 0
  ) {
    sendError(
      res,
      400,
      "Invalid team payload. Required: non-empty 'name', 'specialty' ('SAR' | 'Medical' | 'Logistics'), and positive integer 'member_count'."
    );
    return;
  }

  const newTeam: ResponseTeam = {
    team_id: generateNextId(store.response_teams, 'TM-', (t) => t.team_id),
    name: name.trim(),
    specialty,
    member_count,
    status: 'Standby',
  };

  store.response_teams.push(newTeam);
  sendSuccess(res, 201, 'Response team registered successfully', newTeam);
}

export function updateTeam(req: Request, res: Response): void {
  const team = findTeamById(req.params.id);
  if (!team) {
    sendError(res, 404, `Response team with ID '${req.params.id}' not found`);
    return;
  }

  const { name, specialty, member_count, status } =
    req.body as Partial<ResponseTeam>;

  if (name !== undefined && !isNonEmptyString(name)) {
    sendError(res, 400, "Field 'name' must be a non-empty string.");
    return;
  }
  if (specialty !== undefined && !isValidSpecialty(specialty)) {
    sendError(
      res,
      400,
      "Field 'specialty' must be 'SAR', 'Medical', or 'Logistics'."
    );
    return;
  }
  if (
    member_count !== undefined &&
    (typeof member_count !== 'number' ||
      !Number.isInteger(member_count) ||
      member_count <= 0)
  ) {
    sendError(res, 400, "Field 'member_count' must be a positive integer.");
    return;
  }
  if (status !== undefined && !isValidTeamStatus(status)) {
    sendError(res, 400, "Field 'status' must be 'Standby' or 'Deployed'.");
    return;
  }

  if (name !== undefined) team.name = name.trim();
  if (specialty !== undefined) team.specialty = specialty;
  if (member_count !== undefined) team.member_count = member_count;
  if (status !== undefined) team.status = status;

  sendSuccess(res, 200, 'Response team updated successfully', team);
}

export function deleteTeam(req: Request, res: Response): void {
  const index = store.response_teams.findIndex(
    (t) => t.team_id === req.params.id
  );
  if (index === -1) {
    sendError(res, 404, `Response team with ID '${req.params.id}' not found`);
    return;
  }

  const targetTeam = store.response_teams[index];
  if (targetTeam.status === 'Deployed') {
    sendError(
      res,
      400,
      `Cannot delete team '${targetTeam.name}' while its status is 'Deployed'.`
    );
    return;
  }

  const [deletedTeam] = store.response_teams.splice(index, 1);
  sendSuccess(res, 200, 'Response team deleted successfully', deletedTeam);
}
