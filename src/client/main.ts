import './styles/main.css';
import {
  DispatchStatus,
  DispatchUrgency,
  EnrichedDispatch,
  ResponseTeam,
  Shelter,
  ShelterStatus,
  TeamSpecialty,
  TeamStatus,
} from '../shared/types';
import { api } from './api/client';

type ViewName = 'overview' | 'shelters' | 'teams' | 'dispatches';

interface AppState {
  shelters: Shelter[];
  teams: ResponseTeam[];
  dispatches: EnrichedDispatch[];
  activeView: ViewName;
  globalSearch: string;
  sheltersStatus: string;
  teamsStatus: string;
  dispatchesStatus: string;
}

const state: AppState = {
  shelters: [],
  teams: [],
  dispatches: [],
  activeView: 'overview',
  globalSearch: '',
  sheltersStatus: 'ALL',
  teamsStatus: 'ALL',
  dispatchesStatus: 'ALL',
};

const VIEW_LABELS: Record<ViewName, string> = {
  overview: 'Pusat Komando',
  shelters: 'Posko Pengungsian',
  teams: 'Tim Lapangan',
  dispatches: 'Daftar Misi',
};

const SHELTER_STATUS_META: Record<
  ShelterStatus,
  { label: string; badgeClass: string }
> = {
  Open: {
    label: 'Buka',
    badgeClass: 'status-badge-open',
  },
  Full: {
    label: 'Penuh',
    badgeClass: 'status-badge-full',
  },
  Closed: {
    label: 'Tutup',
    badgeClass: 'status-badge-closed',
  },
};

const URGENCY_LABELS: Record<DispatchUrgency, string> = {
  Critical: 'Kritis',
  High: 'Tinggi',
  Medium: 'Sedang',
  Low: 'Rendah',
};

const SPECIALTY_LABELS: Record<TeamSpecialty, string> = {
  SAR: 'SAR',
  Medical: 'Medis',
  Logistics: 'Logistik',
};

function escapeHtml(value: string): string {
  const el = document.createElement('div');
  el.textContent = value;
  return el.innerHTML;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function showToast(
  message: string,
  type: 'success' | 'error' | 'info' = 'info'
): void {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const styleClass =
    type === 'error'
      ? 'bg-red-700 text-white border-red-800'
      : 'bg-zinc-950 text-white border-zinc-800';

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg shadow-lg border text-xs font-semibold animate-slide-in transition-all duration-200 ${styleClass}`;

  const dotClass =
    type === 'success'
      ? 'bg-emerald-400'
      : type === 'error'
      ? 'bg-white'
      : 'bg-zinc-400';

  toast.innerHTML = `<span class="w-2 h-2 rounded-full shrink-0 ${dotClass}"></span><span class="flex-1 leading-snug">${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(4px)';
    setTimeout(() => toast.remove(), 200);
  }, 3600);
}

let confirmResolver: ((confirmed: boolean) => void) | null = null;

function askConfirm(title: string, message: string): Promise<boolean> {
  const modal = document.getElementById('modal-confirm');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  if (!modal || !titleEl || !msgEl) return Promise.resolve(false);

  titleEl.textContent = title;
  msgEl.textContent = message;
  modal.classList.remove('hidden');

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function resolveConfirm(result: boolean): void {
  document.getElementById('modal-confirm')?.classList.add('hidden');
  if (confirmResolver) {
    const fn = confirmResolver;
    confirmResolver = null;
    fn(result);
  }
}

function closeAllModals(): void {
  document.getElementById('modal-create-dispatch')?.classList.add('hidden');
  document.getElementById('modal-create-shelter')?.classList.add('hidden');
  document.getElementById('modal-edit-shelter')?.classList.add('hidden');
  document.getElementById('modal-create-team')?.classList.add('hidden');
  document.getElementById('modal-edit-team')?.classList.add('hidden');
  document.getElementById('modal-edit-dispatch')?.classList.add('hidden');
  resolveConfirm(false);
}

function switchView(view: ViewName): void {
  state.activeView = view;

  document.querySelectorAll('.view-panel').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`view-${view}`)?.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach((btn) => {
    const isActive = (btn as HTMLElement).dataset.view === view;
    btn.classList.toggle('bg-red-600', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('shadow-xs', isActive);
    btn.classList.toggle('font-semibold', isActive);
    btn.classList.toggle('bg-red-50', false);
    btn.classList.toggle('text-red-600', false);
    btn.classList.toggle('text-zinc-600', !isActive);
    btn.classList.toggle('hover:text-zinc-950', !isActive);
    btn.classList.toggle('hover:bg-zinc-200/70', !isActive);
    btn.classList.toggle('font-medium', !isActive);
    btn.setAttribute('aria-selected', String(isActive));

    const countBadge = btn.querySelector('span[id^="nav-count-"]');
    if (countBadge) {
      countBadge.classList.toggle('text-white/90', isActive);
      countBadge.classList.toggle('text-zinc-400', !isActive);
    }
  });

  document.querySelectorAll('.nav-item-mobile').forEach((btn) => {
    const isActive = (btn as HTMLElement).dataset.view === view;
    btn.classList.toggle('bg-red-600', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('shadow-xs', isActive);
    btn.classList.toggle('font-semibold', isActive);
    btn.classList.toggle('bg-red-50', false);
    btn.classList.toggle('text-red-600', false);
    btn.classList.toggle('text-zinc-600', !isActive);
    btn.classList.toggle('font-medium', !isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  const breadcrumb = document.getElementById('header-breadcrumb');
  if (breadcrumb) breadcrumb.textContent = VIEW_LABELS[view];
}

function renderTelemetry(): void {
  const totalOcc = state.shelters.reduce((sum, s) => sum + s.current_occupancy, 0);
  const totalCap = state.shelters.reduce((sum, s) => sum + s.max_capacity, 0);
  const available = Math.max(0, totalCap - totalOcc);
  const pct = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : '0.0';

  const activeMissions = state.dispatches.filter((d) => d.status === 'Active').length;
  const standbyUnits = state.teams.filter((t) => t.status === 'Standby').length;

  const setText = (id: string, value: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('telemetry-occupancy', `${totalOcc} / ${totalCap}`);
  setText('telemetry-occupancy-pct', `${pct}%`);
  setText('telemetry-available-beds', String(available));
  setText('telemetry-active-dispatches', String(activeMissions));
  setText('telemetry-standby-teams', `${standbyUnits} / ${state.teams.length}`);

  const occBar = document.getElementById('telemetry-occupancy-bar');
  if (occBar) {
    const numPct = totalCap > 0 ? Math.min(100, Math.round((totalOcc / totalCap) * 100)) : 0;
    occBar.style.width = `${numPct}%`;
    occBar.className = `progress-bar-fill h-full rounded-full ${
      numPct >= 90 ? 'bg-red-700' : numPct >= 75 ? 'bg-amber-600' : 'bg-red-600'
    }`;
  }

  setText('nav-count-shelters', String(state.shelters.length));
  setText('nav-count-teams', String(state.teams.length));
  setText('nav-count-dispatches', String(state.dispatches.length));
}

function renderShelterCard(s: Shelter): string {
  const meta = SHELTER_STATUS_META[s.status];
  const pct = Math.min(100, Math.round((s.current_occupancy / s.max_capacity) * 100));
  const remaining = Math.max(0, s.max_capacity - s.current_occupancy);
  const barColor =
    s.status === 'Closed'
      ? 'bg-zinc-400'
      : pct >= 100
      ? 'bg-red-700'
      : pct >= 80
      ? 'bg-amber-600'
      : 'bg-red-600';

  return `
  <article class="card-elevated hover:border-zinc-400 transition-all flex flex-col justify-between overflow-hidden">
    <div class="p-5">
      <div class="flex items-center justify-between gap-2 mb-3">
        <span class="font-mono text-xs font-semibold text-zinc-500">${escapeHtml(s.shelter_id)}</span>
        <span class="${meta.badgeClass}">
          ${escapeHtml(meta.label)}
        </span>
      </div>

      <h3 class="text-sm font-bold text-zinc-950 leading-snug">${escapeHtml(s.name)}</h3>
      <p class="text-xs text-zinc-500 mt-0.5 mb-4">${escapeHtml(s.location)}</p>

      <div>
        <div class="flex justify-between items-center text-xs mb-1.5">
          <span class="text-zinc-600 font-medium">${remaining} tempat kosong</span>
          <span class="tabular-nums font-bold text-zinc-900">${s.current_occupancy} / ${s.max_capacity}</span>
        </div>
        <div class="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
          <div class="progress-bar-fill h-full rounded-full ${barColor}" style="width: ${pct}%"></div>
        </div>
      </div>
    </div>

    <div class="px-5 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs">
      <span class="tabular-nums text-zinc-600 font-semibold">${pct}% terisi</span>
      <div class="flex items-center gap-3">
        <button type="button" data-action="edit-shelter" data-id="${escapeHtml(s.shelter_id)}" class="cursor-pointer text-zinc-700 hover:text-zinc-950 font-semibold transition-colors">Edit</button>
        <button type="button" data-action="delete-shelter" data-id="${escapeHtml(s.shelter_id)}" class="cursor-pointer text-red-600 hover:text-red-700 font-semibold transition-colors">Hapus</button>
      </div>
    </div>
  </article>`;
}

function renderOverview(): void {
  const q = state.globalSearch.toLowerCase();

  // Shelters preview
  const overviewShelters = document.getElementById('overview-shelters-grid');
  if (overviewShelters) {
    const matched = state.shelters.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.shelter_id.toLowerCase().includes(q)
    );
    overviewShelters.innerHTML = matched.length
      ? matched.slice(0, 3).map(renderShelterCard).join('')
      : '<div class="col-span-3 text-center py-8 card-elevated text-xs font-medium text-zinc-500">Tidak ada posko ditemukan.</div>';
  }

  // Dispatches preview
  const overviewDispatches = document.getElementById('overview-dispatches-list');
  if (overviewDispatches) {
    const matched = state.dispatches.filter(
      (d) =>
        d.incident_location.toLowerCase().includes(q) ||
        d.shelter_name.toLowerCase().includes(q) ||
        d.team_name.toLowerCase().includes(q)
    );
    if (matched.length === 0) {
      overviewDispatches.innerHTML =
        '<div class="py-10 text-center text-xs text-zinc-500">Belum ada misi evakuasi.</div>';
    } else {
      overviewDispatches.innerHTML = matched
        .slice(0, 5)
        .map((d) => {
          const isCompleted = d.status === 'Completed';
          const badgeClass = isCompleted ? 'status-badge-completed' : 'status-badge-active';
          const badgeText = isCompleted ? 'Selesai' : 'Aktif';
          const urgencyClass =
            d.urgency === 'Critical'
              ? 'text-red-600 font-bold'
              : d.urgency === 'High'
              ? 'text-orange-600 font-semibold'
              : 'text-zinc-600 font-medium';

          return `
          <div class="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-xs mb-1">
                <span class="font-mono text-zinc-500 font-semibold">${escapeHtml(d.dispatch_id)}</span>
                <span class="${urgencyClass}">${escapeHtml(URGENCY_LABELS[d.urgency])}</span>
                <span class="text-zinc-300">·</span>
                <span class="${badgeClass}">${badgeText}</span>
              </div>
              <p class="text-xs font-semibold text-zinc-950 truncate">${escapeHtml(d.incident_location)}</p>
              <p class="text-xs text-zinc-500 truncate mt-0.5">${escapeHtml(d.shelter_name)} (+${d.evacuee_count}) · ${escapeHtml(d.team_name)}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              ${
                !isCompleted
                  ? `<button type="button" data-action="complete-dispatch" data-id="${escapeHtml(d.dispatch_id)}" class="cursor-pointer px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors">Selesai</button>`
                  : ''
              }
            </div>
          </div>`;
        })
        .join('');
    }
  }

  // Teams preview
  const overviewTeams = document.getElementById('overview-teams-list');
  if (overviewTeams) {
    const matched = state.teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.specialty.toLowerCase().includes(q)
    );
    if (matched.length === 0) {
      overviewTeams.innerHTML =
        '<div class="py-10 text-center text-xs text-zinc-500">Belum ada tim terdaftar.</div>';
    } else {
      overviewTeams.innerHTML = matched
        .map((t) => {
          const isStandby = t.status === 'Standby';
          const badgeClass = isStandby ? 'status-badge-standby' : 'status-badge-deployed';
          const badgeText = isStandby ? 'Siaga' : 'Bertugas';

          return `
          <div class="px-5 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors">
            <div class="min-w-0">
              <p class="text-xs font-semibold text-zinc-950 truncate">${escapeHtml(t.name)}</p>
              <p class="text-xs text-zinc-500 tabular-nums mt-0.5">${escapeHtml(SPECIALTY_LABELS[t.specialty])} · ${t.member_count} personel</p>
            </div>
            <span class="${badgeClass}">
              ${badgeText}
            </span>
          </div>`;
        })
        .join('');
    }
  }
}

function renderSheltersView(): void {
  const grid = document.getElementById('shelters-grid');
  const empty = document.getElementById('shelters-empty-state');
  if (!grid || !empty) return;

  const q = state.globalSearch.toLowerCase();
  const filtered = state.shelters.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      s.shelter_id.toLowerCase().includes(q);
    const matchStatus = state.sheltersStatus === 'ALL' || s.status === state.sheltersStatus;
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = filtered.map(renderShelterCard).join('');
}

function renderTeamsView(): void {
  const tbody = document.getElementById('teams-table-body');
  const empty = document.getElementById('teams-empty-state');
  if (!tbody || !empty) return;

  const q = state.globalSearch.toLowerCase();
  const filtered = state.teams.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(q) ||
      t.specialty.toLowerCase().includes(q) ||
      t.team_id.toLowerCase().includes(q);
    const matchStatus = state.teamsStatus === 'ALL' || t.status === state.teamsStatus;
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  tbody.innerHTML = filtered
    .map((t) => {
      const isStandby = t.status === 'Standby';
      const badgeClass = isStandby ? 'status-badge-standby' : 'status-badge-deployed';
      const badgeText = isStandby ? 'Siaga' : 'Bertugas';

      return `
      <tr class="hover:bg-zinc-50 transition-colors">
        <td class="px-5 py-3 font-mono font-medium tabular-nums text-zinc-500">${escapeHtml(t.team_id)}</td>
        <td class="px-5 py-3 font-semibold text-zinc-950">${escapeHtml(t.name)}</td>
        <td class="px-5 py-3 text-zinc-700 font-medium">${escapeHtml(SPECIALTY_LABELS[t.specialty])}</td>
        <td class="px-5 py-3 tabular-nums text-zinc-700">${t.member_count} personel</td>
        <td class="px-5 py-3">
          <span class="${badgeClass}">
            ${badgeText}
          </span>
        </td>
        <td class="px-5 py-3 text-right space-x-3 whitespace-nowrap">
          <button type="button" data-action="edit-team" data-id="${escapeHtml(t.team_id)}" class="text-xs font-semibold text-zinc-700 hover:text-zinc-950">Edit</button>
          <button type="button" data-action="delete-team" data-id="${escapeHtml(t.team_id)}" class="text-xs font-semibold text-red-600 hover:text-red-700">Hapus</button>
        </td>
      </tr>`;
    })
    .join('');
}

function renderDispatchesView(): void {
  const tbody = document.getElementById('dispatches-table-body');
  const empty = document.getElementById('dispatches-empty-state');
  if (!tbody || !empty) return;

  const q = state.globalSearch.toLowerCase();
  const filtered = state.dispatches.filter((d) => {
    const matchSearch =
      d.incident_location.toLowerCase().includes(q) ||
      d.shelter_name.toLowerCase().includes(q) ||
      d.team_name.toLowerCase().includes(q) ||
      d.dispatch_id.toLowerCase().includes(q);
    const matchStatus = state.dispatchesStatus === 'ALL' || d.status === state.dispatchesStatus;
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  tbody.innerHTML = filtered
    .map((d) => {
      const isCompleted = d.status === 'Completed';
      const badgeClass = isCompleted ? 'status-badge-completed' : 'status-badge-active';
      const badgeText = isCompleted ? 'Selesai' : 'Aktif';
      const specialtyLabel =
        d.team_specialty === 'Unknown' ? 'Umum' : SPECIALTY_LABELS[d.team_specialty];
      const urgencyClass =
        d.urgency === 'Critical'
          ? 'text-red-600 font-bold'
          : d.urgency === 'High'
          ? 'text-orange-600 font-semibold'
          : 'text-zinc-700 font-medium';

      return `
      <tr class="hover:bg-zinc-50 transition-colors ${isCompleted ? 'opacity-80' : ''}">
        <td class="px-5 py-3 font-mono font-medium tabular-nums text-zinc-500">${escapeHtml(d.dispatch_id)}</td>
        <td class="px-5 py-3">
          <div class="font-semibold text-zinc-950">${escapeHtml(d.incident_location)}</div>
          <div class="text-[11px] text-zinc-500 tabular-nums">${escapeHtml(formatTimestamp(d.created_at))}</div>
        </td>
        <td class="px-5 py-3">
          <div class="font-semibold text-zinc-900">${escapeHtml(d.shelter_name)}</div>
          <div class="text-[11px] text-zinc-500 tabular-nums">+${d.evacuee_count} pengungsi</div>
        </td>
        <td class="px-5 py-3">
          <div class="text-zinc-900 font-medium">${escapeHtml(d.team_name)}</div>
          <div class="text-[11px] ${urgencyClass}">${escapeHtml(specialtyLabel)} · Urgensi ${escapeHtml(URGENCY_LABELS[d.urgency])}</div>
        </td>
        <td class="px-5 py-3">
          <span class="${badgeClass}">
            ${badgeText}
          </span>
        </td>
        <td class="px-5 py-3 text-right space-x-2 whitespace-nowrap">
          ${
            !isCompleted
              ? `<button type="button" data-action="complete-dispatch" data-id="${escapeHtml(d.dispatch_id)}" class="cursor-pointer px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors">Selesai</button>`
              : ''
          }
          <button type="button" data-action="edit-dispatch" data-id="${escapeHtml(d.dispatch_id)}" class="px-2 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950">Edit</button>
          <button type="button" data-action="delete-dispatch" data-id="${escapeHtml(d.dispatch_id)}" class="px-2 py-1 text-xs font-semibold text-red-600 hover:text-red-700">
            ${isCompleted ? 'Hapus' : 'Batalkan'}
          </button>
        </td>
      </tr>`;
    })
    .join('');
}

function renderDispatchModalDropdowns(): void {
  const shelterSelect = document.getElementById('dispatch-shelter') as HTMLSelectElement | null;
  if (shelterSelect) {
    shelterSelect.innerHTML = '<option value="" disabled selected>Pilih posko...</option>';
    for (const s of state.shelters) {
      const free = Math.max(0, s.max_capacity - s.current_occupancy);
      const opt = document.createElement('option');
      opt.value = s.shelter_id;
      opt.disabled = s.status !== 'Open' || free <= 0;
      opt.textContent = `${s.name} (${free} kosong · ${SHELTER_STATUS_META[s.status].label})`;
      shelterSelect.appendChild(opt);
    }
  }

  const teamSelect = document.getElementById('dispatch-team') as HTMLSelectElement | null;
  if (teamSelect) {
    teamSelect.innerHTML = '<option value="" disabled selected>Pilih tim siaga...</option>';
    for (const t of state.teams) {
      const opt = document.createElement('option');
      opt.value = t.team_id;
      opt.disabled = t.status !== 'Standby';
      const statusText = t.status === 'Standby' ? 'Siaga' : 'Bertugas';
      opt.textContent = `${t.name} (${SPECIALTY_LABELS[t.specialty]} · ${statusText})`;
      teamSelect.appendChild(opt);
    }
  }
}

function renderAll(): void {
  renderTelemetry();
  renderOverview();
  renderSheltersView();
  renderTeamsView();
  renderDispatchesView();
  renderDispatchModalDropdowns();
}

async function refreshAllData(): Promise<void> {
  try {
    const [shelters, teams, dispatches] = await Promise.all([
      api.getShelters(),
      api.getTeams(),
      api.getDispatches(),
    ]);
    state.shelters = shelters;
    state.teams = teams;
    state.dispatches = dispatches;
    renderAll();
  } catch (err) {
    showToast(getErrorMessage(err, 'Gagal memuat data SafeGrid.'), 'error');
  }
}

function openEditShelterModal(shelterId: string): void {
  const s = state.shelters.find((item) => item.shelter_id === shelterId);
  if (!s) return;

  (document.getElementById('edit-shelter-id') as HTMLInputElement).value = s.shelter_id;
  (document.getElementById('edit-shelter-name') as HTMLInputElement).value = s.name;
  (document.getElementById('edit-shelter-location') as HTMLInputElement).value = s.location;

  const capInput = document.getElementById('edit-shelter-capacity') as HTMLInputElement;
  capInput.value = String(s.max_capacity);
  capInput.min = String(Math.max(1, s.current_occupancy));

  const hint = document.getElementById('edit-shelter-occ-hint');
  if (hint) hint.textContent = `(min ${s.current_occupancy})`;

  (document.getElementById('edit-shelter-status') as HTMLSelectElement).value = s.status;
  document.getElementById('modal-edit-shelter')?.classList.remove('hidden');
}

function openEditTeamModal(teamId: string): void {
  const t = state.teams.find((item) => item.team_id === teamId);
  if (!t) return;

  (document.getElementById('edit-team-id') as HTMLInputElement).value = t.team_id;
  (document.getElementById('edit-team-name') as HTMLInputElement).value = t.name;
  (document.getElementById('edit-team-specialty') as HTMLSelectElement).value = t.specialty;
  (document.getElementById('edit-team-members') as HTMLInputElement).value = String(t.member_count);
  (document.getElementById('edit-team-status') as HTMLSelectElement).value = t.status;

  document.getElementById('modal-edit-team')?.classList.remove('hidden');
}

function openEditDispatchModal(dispatchId: string): void {
  const d = state.dispatches.find((item) => item.dispatch_id === dispatchId);
  if (!d) return;

  (document.getElementById('edit-dispatch-id') as HTMLInputElement).value = d.dispatch_id;
  (document.getElementById('edit-dispatch-location') as HTMLInputElement).value = d.incident_location;
  (document.getElementById('edit-dispatch-urgency') as HTMLSelectElement).value = d.urgency;
  (document.getElementById('edit-dispatch-status') as HTMLSelectElement).value = d.status;

  document.getElementById('modal-edit-dispatch')?.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const view = (e.currentTarget as HTMLElement).dataset.view as ViewName | undefined;
      if (view) switchView(view);
    });
  });
  document.querySelectorAll('[data-jump-view]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const view = (e.currentTarget as HTMLElement).dataset.jumpView as ViewName | undefined;
      if (view) switchView(view);
    });
  });

  // Modal Triggers
  document.getElementById('btn-open-create-dispatch')?.addEventListener('click', () => {
    document.getElementById('modal-create-dispatch')?.classList.remove('hidden');
    document.getElementById('dispatch-shelter')?.focus();
  });
  document.querySelectorAll('[data-open-dispatch-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      document.getElementById('modal-create-dispatch')?.classList.remove('hidden');
      document.getElementById('dispatch-shelter')?.focus();
    });
  });
  document.querySelectorAll('[data-open-shelter-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      document.getElementById('modal-create-shelter')?.classList.remove('hidden');
      document.getElementById('shelter-name')?.focus();
    });
  });
  document.querySelectorAll('[data-open-team-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      document.getElementById('modal-create-team')?.classList.remove('hidden');
      document.getElementById('team-name')?.focus();
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeAllModals);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      return;
    }
    if (
      e.key === '/' &&
      document.activeElement?.tagName !== 'INPUT' &&
      document.activeElement?.tagName !== 'SELECT' &&
      document.activeElement?.tagName !== 'TEXTAREA'
    ) {
      e.preventDefault();
      document.getElementById('global-search')?.focus();
    }
  });

  document.getElementById('btn-confirm-cancel')?.addEventListener('click', () => resolveConfirm(false));
  document.getElementById('btn-confirm-ok')?.addEventListener('click', () => resolveConfirm(true));

  // Delegated actions
  document.addEventListener('click', async (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) return;

    try {
      if (action === 'edit-shelter') {
        openEditShelterModal(id);
      } else if (action === 'delete-shelter') {
        const ok = await askConfirm(
          'Hapus Posko',
          'Hapus posko ini? Posko yang masih memiliki misi aktif tidak dapat dihapus.'
        );
        if (!ok) return;
        await api.deleteShelter(id);
        showToast('Posko dihapus.', 'success');
        await refreshAllData();
      } else if (action === 'edit-team') {
        openEditTeamModal(id);
      } else if (action === 'delete-team') {
        const ok = await askConfirm(
          'Hapus Tim',
          'Hapus unit ini? Tim yang sedang bertugas tidak dapat dihapus.'
        );
        if (!ok) return;
        await api.deleteTeam(id);
        showToast('Tim dihapus.', 'success');
        await refreshAllData();
      } else if (action === 'complete-dispatch') {
        const updated = await api.updateDispatch(id, { status: 'Completed' });
        showToast(
          `Misi ${updated.dispatch_id} selesai. ${updated.team_name} kembali siaga.`,
          'success'
        );
        await refreshAllData();
      } else if (action === 'edit-dispatch') {
        openEditDispatchModal(id);
      } else if (action === 'delete-dispatch') {
        const ok = await askConfirm(
          'Batalkan / Hapus Misi',
          'Jika misi masih aktif, kapasitas posko akan dikembalikan dan tim kembali siaga.'
        );
        if (!ok) return;
        await api.deleteDispatch(id);
        showToast('Misi dihapus dan sumber daya disinkronkan.', 'success');
        await refreshAllData();
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Operasi gagal dijalankan.'), 'error');
    }
  });

  // Forms
  document.getElementById('form-create-dispatch')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    try {
      const created = await api.createDispatch({
        shelter_id: (document.getElementById('dispatch-shelter') as HTMLSelectElement).value,
        team_id: (document.getElementById('dispatch-team') as HTMLSelectElement).value,
        incident_location: (document.getElementById('dispatch-location') as HTMLInputElement).value.trim(),
        evacuee_count: Number.parseInt(
          (document.getElementById('dispatch-evacuees') as HTMLInputElement).value,
          10
        ),
        urgency: (document.getElementById('dispatch-urgency') as HTMLSelectElement).value as DispatchUrgency,
      });
      showToast(
        `${created.team_name} dikerahkan (+${created.evacuee_count} tempat dipesan).`,
        'success'
      );
      form.reset();
      closeAllModals();
      await refreshAllData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal menerbitkan misi.'), 'error');
    }
  });

  document.getElementById('form-create-shelter')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    try {
      const created = await api.createShelter({
        name: (document.getElementById('shelter-name') as HTMLInputElement).value.trim(),
        location: (document.getElementById('shelter-location') as HTMLInputElement).value.trim(),
        max_capacity: Number.parseInt(
          (document.getElementById('shelter-capacity') as HTMLInputElement).value,
          10
        ),
      });
      showToast(`Posko "${created.name}" ditambahkan.`, 'success');
      form.reset();
      closeAllModals();
      await refreshAllData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal menambahkan posko.'), 'error');
    }
  });

  document.getElementById('form-edit-shelter')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const id = (document.getElementById('edit-shelter-id') as HTMLInputElement).value;
      await api.updateShelter(id, {
        name: (document.getElementById('edit-shelter-name') as HTMLInputElement).value.trim(),
        location: (document.getElementById('edit-shelter-location') as HTMLInputElement).value.trim(),
        max_capacity: Number.parseInt(
          (document.getElementById('edit-shelter-capacity') as HTMLInputElement).value,
          10
        ),
        status: (document.getElementById('edit-shelter-status') as HTMLSelectElement).value as ShelterStatus,
      });
      showToast('Data posko diperbarui.', 'success');
      closeAllModals();
      await refreshAllData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memperbarui posko.'), 'error');
    }
  });

  document.getElementById('form-create-team')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    try {
      const created = await api.createTeam({
        name: (document.getElementById('team-name') as HTMLInputElement).value.trim(),
        specialty: (document.getElementById('team-specialty') as HTMLSelectElement).value as TeamSpecialty,
        member_count: Number.parseInt(
          (document.getElementById('team-members') as HTMLInputElement).value,
          10
        ),
      });
      showToast(`Unit "${created.name}" ditambahkan.`, 'success');
      form.reset();
      closeAllModals();
      await refreshAllData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal menambahkan tim.'), 'error');
    }
  });

  document.getElementById('form-edit-team')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const id = (document.getElementById('edit-team-id') as HTMLInputElement).value;
      await api.updateTeam(id, {
        name: (document.getElementById('edit-team-name') as HTMLInputElement).value.trim(),
        specialty: (document.getElementById('edit-team-specialty') as HTMLSelectElement).value as TeamSpecialty,
        member_count: Number.parseInt(
          (document.getElementById('edit-team-members') as HTMLInputElement).value,
          10
        ),
        status: (document.getElementById('edit-team-status') as HTMLSelectElement).value as TeamStatus,
      });
      showToast('Data tim diperbarui.', 'success');
      closeAllModals();
      await refreshAllData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memperbarui tim.'), 'error');
    }
  });

  document.getElementById('form-edit-dispatch')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const id = (document.getElementById('edit-dispatch-id') as HTMLInputElement).value;
      await api.updateDispatch(id, {
        incident_location: (document.getElementById('edit-dispatch-location') as HTMLInputElement).value.trim(),
        urgency: (document.getElementById('edit-dispatch-urgency') as HTMLSelectElement).value as DispatchUrgency,
        status: (document.getElementById('edit-dispatch-status') as HTMLSelectElement).value as DispatchStatus,
      });
      showToast('Misi diperbarui.', 'success');
      closeAllModals();
      await refreshAllData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memperbarui misi.'), 'error');
    }
  });

  // Search & Filters
  document.getElementById('global-search')?.addEventListener('input', (e) => {
    state.globalSearch = (e.currentTarget as HTMLInputElement).value;
    renderOverview();
    renderSheltersView();
    renderTeamsView();
    renderDispatchesView();
  });
  document.getElementById('filter-shelters-status')?.addEventListener('change', (e) => {
    state.sheltersStatus = (e.currentTarget as HTMLSelectElement).value;
    renderSheltersView();
  });
  document.getElementById('filter-teams-status')?.addEventListener('change', (e) => {
    state.teamsStatus = (e.currentTarget as HTMLSelectElement).value;
    renderTeamsView();
  });
  document.getElementById('filter-dispatches-status')?.addEventListener('change', (e) => {
    state.dispatchesStatus = (e.currentTarget as HTMLSelectElement).value;
    renderDispatchesView();
  });

  refreshAllData();
});
