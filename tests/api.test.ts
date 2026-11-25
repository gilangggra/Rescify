import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import app, { ready } from '../src/server/index';
import { resetStore } from '../src/server/store/jsonStore';
import {
  ApiResponse,
  EnrichedDispatch,
  ResponseTeam,
  Shelter,
} from '../src/shared/types';

let server: http.Server;
let baseUrl = '';

async function requestJson<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; json: ApiResponse<T> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as ApiResponse<T>;
  return { status: res.status, json };
}

describe('SafeGrid REST API & Capacity/Resource Invariants', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    await ready;
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind ephemeral port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    resetStore();
  });

  it('GET /api/health returns 200 OK with SafeGrid telemetry counts', async () => {
    const { status, json } = await requestJson<{
      status: string;
      storage: string;
      counts: {
        shelters: number;
        total_occupancy: number;
        total_capacity: number;
        response_teams: number;
        standby_teams: number;
        dispatches: number;
        active_dispatches: number;
      };
    }>('GET', '/api/health');

    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'ok');
    assert.equal(json.data.storage, 'in-memory-json');
    assert.equal(json.data.counts.shelters, 3);
    assert.equal(json.data.counts.total_occupancy, 145);
    assert.equal(json.data.counts.total_capacity, 300);
    assert.equal(json.data.counts.standby_teams, 2);
    assert.equal(json.data.counts.active_dispatches, 1);
  });

  it('Shelters CRUD: POST defaults Open/0, PUT prevents max_capacity < current_occupancy, DELETE blocks active dispatches', async () => {
    const createRes = await requestJson<Shelter>('POST', '/api/shelters', {
      name: 'GOR Ciparay',
      location: 'Ciparay, Kab. Bandung',
      max_capacity: 90,
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.json.data.current_occupancy, 0);
    assert.equal(createRes.json.data.status, 'Open');

    // SHL-01 has current_occupancy = 45 -> cannot reduce max_capacity to 40
    const badCap = await requestJson<null>('PUT', '/api/shelters/SHL-01', {
      max_capacity: 40,
    });
    assert.equal(badCap.status, 400);

    // SHL-01 has active DSP-01 -> cannot delete
    const blockedDel = await requestJson<null>('DELETE', '/api/shelters/SHL-01');
    assert.equal(blockedDel.status, 400);

    // Delete newly created unused shelter -> 200
    const delRes = await requestJson<Shelter>(
      'DELETE',
      `/api/shelters/${createRes.json.data.shelter_id}`
    );
    assert.equal(delRes.status, 200);
  });

  it('ResponseTeams CRUD: POST defaults Standby, DELETE blocks Deployed teams', async () => {
    const createRes = await requestJson<ResponseTeam>('POST', '/api/teams', {
      name: 'Delta Rescue',
      specialty: 'SAR',
      member_count: 5,
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.json.data.status, 'Standby');

    // TM-01 is Deployed -> 400
    const blockedDel = await requestJson<null>('DELETE', '/api/teams/TM-01');
    assert.equal(blockedDel.status, 400);

    // Delete standby TM-04 -> 200
    const delRes = await requestJson<ResponseTeam>(
      'DELETE',
      `/api/teams/${createRes.json.data.team_id}`
    );
    assert.equal(delRes.status, 200);
  });

  it('EmergencyDispatches 3-Entity Logic: capacity & team validation, Full sync, Complete release, and Cancel rollback', async () => {
    // SHL-02 is Full (80/80) -> 400 Insufficient shelter capacity
    const fullRes = await requestJson<null>('POST', '/api/dispatches', {
      shelter_id: 'SHL-02',
      team_id: 'TM-02',
      incident_location: 'Dayeuhkolot',
      evacuee_count: 10,
      urgency: 'High',
    });
    assert.equal(fullRes.status, 400);
    assert.equal(fullRes.json.message, 'Insufficient shelter capacity');

    // TM-01 is Deployed -> 400 Response team is currently deployed
    const busyTeamRes = await requestJson<null>('POST', '/api/dispatches', {
      shelter_id: 'SHL-03',
      team_id: 'TM-01',
      incident_location: 'Bojongsoang',
      evacuee_count: 10,
      urgency: 'Medium',
    });
    assert.equal(busyTeamRes.status, 400);
    assert.equal(busyTeamRes.json.message, 'Response team is currently deployed');

    // Dispatch TM-02 to SHL-03 (20/100) with 80 evacuees -> fills SHL-03 to 100/100 (Full) & deploys TM-02
    const dispatchRes = await requestJson<EnrichedDispatch>('POST', '/api/dispatches', {
      shelter_id: 'SHL-03',
      team_id: 'TM-02',
      incident_location: 'Cikoneng',
      evacuee_count: 80,
      urgency: 'Critical',
    });
    assert.equal(dispatchRes.status, 201);
    assert.equal(dispatchRes.json.data.shelter_name, 'Gedung Serbaguna Bojongsoang');
    assert.equal(dispatchRes.json.data.team_name, 'Bravo Rapid Medical Unit');

    const shl3Full = await requestJson<Shelter>('GET', '/api/shelters/SHL-03');
    assert.equal(shl3Full.json.data.current_occupancy, 100);
    assert.equal(shl3Full.json.data.status, 'Full');

    const tm2Deployed = await requestJson<ResponseTeam>('GET', '/api/teams/TM-02');
    assert.equal(tm2Deployed.json.data.status, 'Deployed');

    // Cancel active dispatch -> rolls back occupancy to 20, re-opens SHL-03, and releases TM-02 to Standby
    const cancelRes = await requestJson<null>(
      'DELETE',
      `/api/dispatches/${dispatchRes.json.data.dispatch_id}`
    );
    assert.equal(cancelRes.status, 200);

    const shl3Reopened = await requestJson<Shelter>('GET', '/api/shelters/SHL-03');
    assert.equal(shl3Reopened.json.data.current_occupancy, 20);
    assert.equal(shl3Reopened.json.data.status, 'Open');

    const tm2Standby = await requestJson<ResponseTeam>('GET', '/api/teams/TM-02');
    assert.equal(tm2Standby.json.data.status, 'Standby');

    // Mark DSP-01 as Completed -> releases TM-01 to Standby while keeping SHL-01 occupancy at 45
    const completeRes = await requestJson<EnrichedDispatch>('PUT', '/api/dispatches/DSP-01', {
      status: 'Completed',
    });
    assert.equal(completeRes.status, 200);
    assert.ok(completeRes.json.data.completed_at !== null);

    const tm1Standby = await requestJson<ResponseTeam>('GET', '/api/teams/TM-01');
    assert.equal(tm1Standby.json.data.status, 'Standby');

    const shl1AfterComplete = await requestJson<Shelter>('GET', '/api/shelters/SHL-01');
    assert.equal(shl1AfterComplete.json.data.current_occupancy, 45);
  });
});
