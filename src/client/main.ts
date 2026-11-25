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

interface AppState {
  shelters: Shelter[];
  teams: ResponseTeam[];
  dispatches: EnrichedDispatch[];
  sheltersSearch: string;
  sheltersStatus: string;
  dispatchesSearch: string;
  dispatchesStatus: string;
}

const state: AppState = {
  shelters: [],
  teams: [],
  dispatches: [],
  sheltersSearch: '',
  sheltersStatus: 'ALL',
  dispatchesSearch: '',
  dispatchesStatus: 'ALL',
};

const SHELTER_STATUS_META: Record<
  ShelterStatus,
  { label: string; dot: string; text: string }
> = {
  Open: { label: 'Buka', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  Full: { label: 'Penuh', dot: 'bg-rose-500', text: 'text-rose-600' },
  Closed: { label: 'Tutup', dot: 'bg-zinc-400', text: 'text-zinc-500' },
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
      ? 'bg-white text-rose-700 border-rose-200'
      : 'bg-zinc-900 text-white border-zinc-800';

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-md shadow-md border text-xs font-medium animate-slide-in transition-all duration-200 ${styleClass}`;

  const dotClass =
    type === 'success'
      ? 'bg-emerald-400'
      : type === 'error'
      ? 'bg-rose-500'
      : 'bg-zinc-400';

  toast.innerHTML = `<span class="w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}"></span><span class="flex-1 leading-snug">${escapeHtml(message)}</span>`;
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
  document.getElementById('modal-create-shelter')?.classList.add('hidden');
  document.getElementById('modal-edit-shelter')?.classList.add('hidden');
  document.getElementById('modal-create-team')?.classList.add('hidden');
  document.getElementById('modal-edit-team')?.classList.add('hidden');
  document.getElementById('modal-edit-dispatch')?.classList.add('hidden');
  resolveConfirm(false);
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
  setText('telemetry-occupancy-pct', `${pct}% terpakai`);
  setText('telemetry-available-beds', String(available));
  setText('telemetry-active-dispatches', String(activeMissions));
  setText('telemetry-standby-teams', `${standbyUnits} / ${state.teams.length}`);
}

function renderSheltersGrid(): void {
  const grid = document.getElementById('shelters-grid');
  const empty = document.getElementById('shelters-empty-state');
  if (!grid || !empty) return;

  const q = state.sheltersSearch.toLowerCase();
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
  grid.innerHTML = filtered
    .map((s) => {
      const meta = SHELTER_STATUS_META[s.status];
      const pct = Math.min(100, Math.round((s.current_occupancy / s.max_capacity) * 100));
      const remaining = Math.max(0, s.max_capacity - s.current_occupancy);
      const barColor =
        s.status === 'Closed'
          ? 'bg-zinc-400'
          : pct >= 100
          ? 'bg-rose-500'
          : pct >= 80
          ? 'bg-amber-500'
          : 'bg-zinc-900';

      return `
      <article class="bg-white rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors flex flex-col justify-between">
        <div class="p-4">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="font-mono text-[11px] text-zinc-400">${escapeHtml(s.shelter_id)}</span>
            <span class="inline-flex items-center gap-1.5 text-[11px] font-medium ${meta.text}">
              <span class="w-1.5 h-1.5 rounded-full ${meta.dot}"></span>
              ${escapeHtml(meta.label)}
            </span>
          </div>

          <h3 class="text-sm font-semibold text-zinc-900 leading-snug">${escapeHtml(s.name)}</h3>
          <p class="text-xs text-zinc-500 mt-0.5 mb-4">${escapeHtml(s.location)}</p>

          <div>
            <div class="flex justify-between items-center text-[11px] mb-1.5">
              <span class="text-zinc-500">${remaining} tempat kosong</span>
              <span class="tabular-nums font-medium text-zinc-800">${s.current_occupancy} / ${s.max_capacity}</span>
            </div>
            <div class="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div class="progress-bar-fill h-full rounded-full ${barColor}" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>

        <div class="px-4 py-2.5 bg-zinc-50/70 border-t border-zinc-100 flex items-center justify-between text-[11px]">
          <span class="tabular-nums text-zinc-400">${pct}% terisi</span>
          <div class="flex items-center gap-3">
            <button type="button" data-action="edit-shelter" data-id="${escapeHtml(s.shelter_id)}" class="text-zinc-600 hover:text-zinc-900 font-medium transition-colors">Edit</button>
            <button type="button" data-action="delete-shelter" data-id="${escapeHtml(s.shelter_id)}" class="text-rose-600 hover:text-rose-700 font-medium transition-colors">Hapus</button>
          </div>
        </div>
      </article>`;
    })
    .join('');
}

function renderDispatchFormDropdowns(): void {
  const shelterSelect = document.getElementById('dispatch-shelter') as HTMLSelectElement | null;
  if (shelterSelect) {
    const prev = shelterSelect.value;
    shelterSelect.innerHTML = '<option value="" disabled selected>Pilih posko...</option>';
    for (const s of state.shelters) {
      const free = Math.max(0, s.max_capacity - s.current_occupancy);
      const opt = document.createElement('option');
      opt.value = s.shelter_id;
      opt.disabled = s.status !== 'Open' || free <= 0;
      opt.textContent = `${s.name} (${free} kosong · ${SHELTER_STATUS_META[s.status].label})`;
      shelterSelect.appendChild(opt);
    }
    if (prev && state.shelters.some((s) => s.shelter_id === prev && s.status === 'Open')) {
      shelterSelect.value = prev;
    }
  }

  const teamSelect = document.getElementById('dispatch-team') as HTMLSelectElement | null;
  if (teamSelect) {
    const prev = teamSelect.value;
    teamSelect.innerHTML = '<option value="" disabled selected>Pilih tim siaga...</option>';
    for (const t of state.teams) {
      const opt = document.createElement('option');
      opt.value = t.team_id;
      opt.disabled = t.status !== 'Standby';
      const statusText = t.status === 'Standby' ? 'Siaga' : 'Bertugas';
      opt.textContent = `${t.name} (${SPECIALTY_LABELS[t.specialty]} · ${statusText})`;
      teamSelect.appendChild(opt);
    }
    if (prev && state.teams.some((t) => t.team_id === prev && t.status === 'Standby')) {
      teamSelect.value = prev;
    }
  }
}

function renderTeamsList(): void {
  const list = document.getElementById('teams-list');
  const empty = document.getElementById('teams-empty-state');
  if (!list || !empty) return;

  if (state.teams.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = state.teams
    .map((t) => {
      const isStandby = t.status === 'Standby';

      return `
      <div class="px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50/70 transition-colors">
        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-zinc-900 truncate">${escapeHtml(t.name)}</div>
          <div class="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
            <span class="font-mono text-zinc-400">${escapeHtml(t.team_id)}</span> · ${escapeHtml(SPECIALTY_LABELS[t.specialty])} · ${t.member_count} personel
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <span class="inline-flex items-center gap-1.5 text-[11px] font-medium ${isStandby ? 'text-emerald-700' : 'text-amber-700'}">
            <span class="w-1.5 h-1.5 rounded-full ${isStandby ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
            ${isStandby ? 'Siaga' : 'Bertugas'}
          </span>
          <button type="button" data-action="edit-team" data-id="${escapeHtml(t.team_id)}" class="text-[11px] font-medium text-zinc-600 hover:text-zinc-900">Edit</button>
          <button type="button" data-action="delete-team" data-id="${escapeHtml(t.team_id)}" class="text-[11px] font-medium text-rose-600 hover:text-rose-700">Hapus</button>
        </div>
      </div>`;
    })
    .join('');
}

function renderDispatchesFeed(): void {
  const feed = document.getElementById('dispatches-feed');
  const empty = document.getElementById('dispatches-empty-state');
  if (!feed || !empty) return;

  const q = state.dispatchesSearch.toLowerCase();
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
    feed.innerHTML = '';
    feed.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  feed.classList.remove('hidden');
  feed.innerHTML = filtered
    .map((d) => {
      const isCompleted = d.status === 'Completed';
      const specialtyLabel =
        d.team_specialty === 'Unknown' ? 'Umum' : SPECIALTY_LABELS[d.team_specialty];
      const urgencyColor =
        d.urgency === 'Critical'
          ? 'text-rose-600'
          : d.urgency === 'High'
          ? 'text-amber-700'
          : 'text-zinc-600';

      return `
      <article class="p-4 hover:bg-zinc-50/50 transition-colors ${isCompleted ? 'opacity-70' : ''}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 text-[11px] mb-1">
              <span class="font-mono text-zinc-400">${escapeHtml(d.dispatch_id)}</span>
              <span class="font-medium ${urgencyColor}">${escapeHtml(URGENCY_LABELS[d.urgency])}</span>
              <span class="text-zinc-300">·</span>
              <span class="inline-flex items-center gap-1.5 font-medium ${isCompleted ? 'text-emerald-700' : 'text-zinc-800'}">
                <span class="w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                ${isCompleted ? 'Selesai' : 'Aktif'}
              </span>
            </div>

            <h3 class="text-sm font-medium text-zinc-900">${escapeHtml(d.incident_location)}</h3>
            <p class="text-xs text-zinc-600 mt-1">
              Tujuan <span class="font-medium text-zinc-900">${escapeHtml(d.shelter_name)}</span>
              <span class="tabular-nums text-zinc-500">(+${d.evacuee_count} pengungsi)</span>
            </p>
            <p class="text-[11px] text-zinc-500 mt-0.5">
              Unit: ${escapeHtml(d.team_name)} (${escapeHtml(specialtyLabel)})
              ${d.completed_at ? ` · Selesai ${escapeHtml(formatTimestamp(d.completed_at))}` : ''}
            </p>
          </div>

          <span class="text-[11px] tabular-nums text-zinc-400 shrink-0">${escapeHtml(formatTimestamp(d.created_at))}</span>
        </div>

        <div class="mt-3 flex items-center justify-end gap-2">
          ${
            !isCompleted
              ? `<button type="button" data-action="complete-dispatch" data-id="${escapeHtml(d.dispatch_id)}" class="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-medium rounded-md transition-colors">Tandai Selesai</button>`
              : ''
          }
          <button type="button" data-action="edit-dispatch" data-id="${escapeHtml(d.dispatch_id)}" class="px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900">Edit</button>
          <button type="button" data-action="delete-dispatch" data-id="${escapeHtml(d.dispatch_id)}" class="px-2 py-1 text-[11px] font-medium text-rose-600 hover:text-rose-700">
            ${isCompleted ? 'Hapus' : 'Batalkan'}
          </button>
        </div>
      </article>`;
    })
    .join('');
}

function renderAll(): void {
  renderTelemetry();
  renderSheltersGrid();
  renderDispatchFormDropdowns();
  renderTeamsList();
  renderDispatchesFeed();
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
  document.getElementById('btn-open-create-shelter')?.addEventListener('click', () => {
    document.getElementById('modal-create-shelter')?.classList.remove('hidden');
  });
  document.getElementById('btn-open-create-team')?.addEventListener('click', () => {
    document.getElementById('modal-create-team')?.classList.remove('hidden');
  });
  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeAllModals);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  document.getElementById('btn-confirm-cancel')?.addEventListener('click', () => resolveConfirm(false));
  document.getElementById('btn-confirm-ok')?.addEventListener('click', () => resolveConfirm(true));

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
          'Hapus posko ini? Posko yang masih memiliki misi evakuasi aktif tidak dapat dihapus.'
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
      await refreshAllData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal menerbitkan misi.'), 'error');
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

  document.getElementById('filter-shelters-search')?.addEventListener('input', (e) => {
    state.sheltersSearch = (e.currentTarget as HTMLInputElement).value;
    renderSheltersGrid();
  });
  document.getElementById('filter-shelters-status')?.addEventListener('change', (e) => {
    state.sheltersStatus = (e.currentTarget as HTMLSelectElement).value;
    renderSheltersGrid();
  });
  document.getElementById('filter-dispatches-search')?.addEventListener('input', (e) => {
    state.dispatchesSearch = (e.currentTarget as HTMLInputElement).value;
    renderDispatchesFeed();
  });
  document.getElementById('filter-dispatches-status')?.addEventListener('change', (e) => {
    state.dispatchesStatus = (e.currentTarget as HTMLSelectElement).value;
    renderDispatchesFeed();
  });

  refreshAllData();
});
