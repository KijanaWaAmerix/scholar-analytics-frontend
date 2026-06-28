/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Classes Page
   File: js/classes.js
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const state = {
  classes  : [],
  editingId: null,
  deleteId : null,
};

/* ══════════════════════════════════════════════════════════
   LOAD CLASSES
══════════════════════════════════════════════════════════ */
const loadClasses = async () => {
  const grid = document.getElementById('classesGrid');
  if (grid) grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-soft);">
      <i class="fas fa-spinner fa-spin" style="font-size:24px;"></i>
      <p style="margin-top:12px;">Loading classes...</p>
    </div>`;

  const result = await API.get('/classes');

  if (!result?.ok) {
    showToast('Failed to load classes.', 'error');
    return;
  }

  state.classes = result.data.classes || [];
  renderStats();
  renderGrid();
};

/* ══════════════════════════════════════════════════════════
   RENDER STATS
══════════════════════════════════════════════════════════ */
const renderStats = () => {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('totalClasses',    state.classes.length);
  set('grade7Count',     state.classes.filter(c => c.grade === 7).length);
  set('grade8Count',     state.classes.filter(c => c.grade === 8).length);
  set('grade9Count',     state.classes.filter(c => c.grade === 9).length);
  set('totalStudentsAll',state.classes.reduce((sum, c) => sum + (c.studentCount || 0), 0));
};

/* ══════════════════════════════════════════════════════════
   RENDER GRID
══════════════════════════════════════════════════════════ */
const gradeColours = {
  7: { bg:'rgba(52,152,219,0.08)', border:'rgba(52,152,219,0.20)', colour:'#2e86c1', icon:'#3498db' },
  8: { bg:'rgba(39,174,96,0.08)',  border:'rgba(39,174,96,0.20)',  colour:'#1e8449', icon:'#27ae60' },
  9: { bg:'rgba(142,68,173,0.08)', border:'rgba(142,68,173,0.20)',colour:'#7d3c98', icon:'#8e44ad' },
};

const renderGrid = () => {
  const grid = document.getElementById('classesGrid');
  if (!grid) return;

  if (!state.classes.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px;
        background:white;border-radius:var(--radius-md);
        border:2px dashed rgba(209,220,235,0.8);">
        <i class="fas fa-school" style="font-size:40px;opacity:0.2;display:block;margin-bottom:16px;"></i>
        <h3 style="color:var(--text-dark);margin-bottom:8px;">No classes yet</h3>
        <p style="color:var(--text-soft);font-size:0.875rem;margin-bottom:20px;">
          Add your first class or use Seed Default Classes to create Grade 7–9.
        </p>
        <button class="btn-primary" onclick="openAddModal()">
          <i class="fas fa-plus"></i> Add First Class
        </button>
      </div>`;
    return;
  }

  grid.innerHTML = state.classes.map(cls => {
    const col = gradeColours[cls.grade] || gradeColours[7];
    const pct = cls.capacity
      ? Math.min(100, Math.round(((cls.studentCount||0)/cls.capacity)*100))
      : 0;

    return `
      <div class="class-card" style="
        background:white;
        border-radius:var(--radius-md);
        border:1px solid ${col.border};
        box-shadow:0 2px 10px rgba(0,0,0,0.05);
        overflow:hidden;
        transition:transform 0.2s,box-shadow 0.2s;
      " onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.10)'"
         onmouseleave="this.style.transform='';this.style.boxShadow='0 2px 10px rgba(0,0,0,0.05)'">

        <!-- Card top bar -->
        <div style="height:5px;background:linear-gradient(90deg,${col.icon},${col.colour});"></div>

        <div style="padding:20px;">
          <!-- Header -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:46px;height:46px;border-radius:12px;
                background:${col.bg};border:1px solid ${col.border};
                display:flex;align-items:center;justify-content:center;
                font-size:20px;color:${col.icon};">
                <i class="fas fa-school"></i>
              </div>
              <div>
                <h3 style="font-size:1rem;font-weight:700;color:var(--text-dark);margin-bottom:2px;">
                  ${cls.name}
                </h3>
                <span style="font-size:0.72rem;font-weight:700;
                  background:${col.bg};color:${col.colour};
                  padding:2px 10px;border-radius:999px;border:1px solid ${col.border};">
                  Grade ${cls.grade}${cls.stream ? ' — ' + cls.stream : ''}
                </span>
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button onclick="openEditModal('${cls._id}')"
                style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border-input);
                background:white;color:var(--text-soft);cursor:pointer;font-size:13px;
                display:flex;align-items:center;justify-content:center;transition:all 0.2s;"
                onmouseenter="this.style.background='var(--primary)';this.style.color='white';this.style.borderColor='var(--primary)'"
                onmouseleave="this.style.background='white';this.style.color='var(--text-soft)';this.style.borderColor='var(--border-input)'"
                title="Edit">
                <i class="fas fa-pen"></i>
              </button>
              <button onclick="openDeleteModal('${cls._id}','${cls.name.replace(/'/g,"\\'")}')"
                style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border-input);
                background:white;color:var(--text-soft);cursor:pointer;font-size:13px;
                display:flex;align-items:center;justify-content:center;transition:all 0.2s;"
                onmouseenter="this.style.background='#e74c3c';this.style.color='white';this.style.borderColor='#e74c3c'"
                onmouseleave="this.style.background='white';this.style.color='var(--text-soft)';this.style.borderColor='var(--border-input)'"
                title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Stats row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
            <div style="background:var(--bg-light);border-radius:8px;padding:10px;text-align:center;">
              <p style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;color:${col.colour};">
                ${cls.studentCount || 0}
              </p>
              <p style="font-size:0.68rem;font-weight:700;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;">
                Students
              </p>
            </div>
            <div style="background:var(--bg-light);border-radius:8px;padding:10px;text-align:center;">
              <p style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;color:var(--text-dark);">
                ${cls.capacity || 45}
              </p>
              <p style="font-size:0.68rem;font-weight:700;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;">
                Capacity
              </p>
            </div>
          </div>

          <!-- Capacity bar -->
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
              <span style="font-size:0.72rem;color:var(--text-soft);">Occupancy</span>
              <span style="font-size:0.72rem;font-weight:700;color:${col.colour};">${pct}%</span>
            </div>
            <div style="height:6px;background:rgba(209,220,235,0.5);border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${col.icon},${col.colour});border-radius:999px;transition:width 0.5s ease;"></div>
            </div>
          </div>

          <!-- Quick links -->
          <div style="display:flex;gap:6px;margin-top:14px;">
            <a href="subjects.html?class=${cls._id}&name=${encodeURIComponent(cls.name)}"
              style="flex:1;padding:7px;background:${col.bg};border:1px solid ${col.border};
              border-radius:8px;font-size:0.74rem;font-weight:600;color:${col.colour};
              text-align:center;text-decoration:none;transition:opacity 0.2s;"
              onmouseenter="this.style.opacity='0.7'"
              onmouseleave="this.style.opacity='1'">
              <i class="fas fa-book-open"></i> Subjects
            </a>
            <a href="exams.html?class=${cls._id}&name=${encodeURIComponent(cls.name)}"
              style="flex:1;padding:7px;background:${col.bg};border:1px solid ${col.border};
              border-radius:8px;font-size:0.74rem;font-weight:600;color:${col.colour};
              text-align:center;text-decoration:none;transition:opacity 0.2s;"
              onmouseenter="this.style.opacity='0.7'"
              onmouseleave="this.style.opacity='1'">
              <i class="fas fa-calendar-check"></i> Exams
            </a>
            <a href="students.html?class=${cls._id}"
              style="flex:1;padding:7px;background:${col.bg};border:1px solid ${col.border};
              border-radius:8px;font-size:0.74rem;font-weight:600;color:${col.colour};
              text-align:center;text-decoration:none;transition:opacity 0.2s;"
              onmouseenter="this.style.opacity='0.7'"
              onmouseleave="this.style.opacity='1'">
              <i class="fas fa-users"></i> Students
            </a>
          </div>
        </div>
      </div>`;
  }).join('');
};

/* ══════════════════════════════════════════════════════════
   ADD / EDIT MODAL
══════════════════════════════════════════════════════════ */
const openAddModal = () => {
  state.editingId = null;
  document.getElementById('classModalTitle').textContent = 'Add New Class';
  document.getElementById('saveClassText').textContent   = 'Save Class';
  document.getElementById('className').value    = '';
  document.getElementById('classGrade').value   = '';
  document.getElementById('classStream').value  = '';
  document.getElementById('classCapacity').value= '45';
  document.getElementById('classModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('className').focus();
};

const openEditModal = async (id) => {
  const cls = state.classes.find(c => c._id === id);
  if (!cls) return;

  state.editingId = id;
  document.getElementById('classModalTitle').textContent = 'Edit Class';
  document.getElementById('saveClassText').textContent   = 'Update Class';
  document.getElementById('className').value    = cls.name;
  document.getElementById('classGrade').value   = cls.grade;
  document.getElementById('classStream').value  = cls.stream || '';
  document.getElementById('classCapacity').value= cls.capacity || 45;
  document.getElementById('classModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

const closeClassModal = () => {
  document.getElementById('classModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  state.editingId = null;
};

const saveClass = async () => {
  const name     = document.getElementById('className').value.trim();
  const grade    = document.getElementById('classGrade').value;
  const stream   = document.getElementById('classStream').value.trim();
  const capacity = document.getElementById('classCapacity').value;

  if (!name) {
    showToast('Class name is required.', 'warning');
    document.getElementById('className').focus();
    return;
  }

  if (!grade) {
    showToast('Please select a grade.', 'warning');
    return;
  }

  const btn = document.getElementById('saveClassBtn');
  if (btn) btn.disabled = true;

  const payload = { name, grade: Number(grade), stream, capacity: Number(capacity) };

  let result;
  if (state.editingId) {
    result = await API.put(`/classes/${state.editingId}`, payload);
  } else {
    result = await API.post('/classes', payload);
  }

  if (btn) btn.disabled = false;

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to save class.', 'error');
    return;
  }

  showToast(
    state.editingId ? `${name} updated successfully.` : `${name} created successfully.`,
    'success'
  );

  closeClassModal();
  loadClasses();
};

/* ══════════════════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════════════════ */
const openDeleteModal = (id, name) => {
  state.deleteId = id;
  document.getElementById('deleteClassName').textContent = name;
  document.getElementById('deleteClassOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

const closeDeleteModal = () => {
  document.getElementById('deleteClassOverlay').classList.remove('open');
  document.body.style.overflow = '';
  state.deleteId = null;
};

const confirmDelete = async () => {
  if (!state.deleteId) return;

  const result = await API.delete(`/classes/${state.deleteId}`);

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to delete class.', 'error');
    return;
  }

  showToast('Class deleted successfully.', 'success');
  closeDeleteModal();
  loadClasses();
};

/* ══════════════════════════════════════════════════════════
   SEED DEFAULT CLASSES
══════════════════════════════════════════════════════════ */
const seedDefaults = async () => {
  const btn = document.getElementById('seedDefaultsBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Seeding...'; }

  const result = await API.post('/classes/seed-defaults', { academicYear: '2024' });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Seed Default Classes'; }

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to seed classes.', 'error');
    return;
  }

  const { created, skipped } = result.data;
  showToast(
    `${created.length} classes created, ${skipped.length} already existed.`,
    'success'
  );
  loadClasses();
};

/* ══════════════════════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════════════════════ */
document.getElementById('addClassBtn')?.addEventListener('click', openAddModal);
document.getElementById('seedDefaultsBtn')?.addEventListener('click', seedDefaults);
document.getElementById('saveClassBtn')?.addEventListener('click', saveClass);
document.getElementById('classModalClose')?.addEventListener('click', closeClassModal);
document.getElementById('classModalCancel')?.addEventListener('click', closeClassModal);
document.getElementById('deleteClassClose')?.addEventListener('click', closeDeleteModal);
document.getElementById('deleteClassCancel')?.addEventListener('click', closeDeleteModal);
document.getElementById('confirmDeleteClass')?.addEventListener('click', confirmDelete);

window.openEditModal   = openEditModal;
window.openDeleteModal = openDeleteModal;
window.openAddModal    = openAddModal;

loadClasses();