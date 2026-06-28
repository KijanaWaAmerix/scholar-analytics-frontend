/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Settings Page
   File: js/settings.js  Version: 3.1
   Connected to real backend
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   SECTION SWITCHING
══════════════════════════════════════════════════════════ */
const switchSection = (section) => {
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });
  document.querySelectorAll('.settings-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${section}`);
  });
};

document.querySelectorAll('.settings-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const section = item.dataset.section;
    if (section) switchSection(section);
  });
});

/* ══════════════════════════════════════════════════════════
   LOAD SETTINGS FROM API
══════════════════════════════════════════════════════════ */
const loadSettings = async () => {
  const result = await API.get('/settings');

  if (!result?.ok) {
    showToast('Failed to load settings.', 'error');
    return;
  }

  const { school, admin } = result.data;

  /* School info */
  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e && val !== undefined && val !== null) e.value = val;
  };

  set('schoolName',    school.schoolName);
  set('schoolMotto',   school.schoolMotto);
  set('schoolEmail',   school.schoolEmail);
  set('schoolPhone',   school.schoolPhone);
  set('schoolAddress', school.schoolAddress);

  /* Principal */
  set('principalName',  school.principal?.name);
  set('principalPhone', school.principal?.phone);

  /* Academic */
  set('currentYear',     school.academic?.currentYear);
  set('currentTerm',     school.academic?.currentTerm);
  set('termOpeningDate', school.academic?.termOpeningDate);
  set('termClosingDate', school.academic?.termClosingDate);
  set('nextTermDate',    school.academic?.nextTermDate);

  /* Security — account info */
  const emailEl  = document.getElementById('accountEmail');
  const roleEl   = document.getElementById('accountRole');
  const schoolEl = document.getElementById('accountSchool');

  if (emailEl)  emailEl.textContent  = user.email || admin?.email || '--';
  if (roleEl)   roleEl.textContent   = user.role?.charAt(0).toUpperCase()+user.role?.slice(1) || '--';
  if (schoolEl) schoolEl.textContent = school.schoolName || '--';

  /* Subscription */
  const subPlan     = document.getElementById('subPlanName');
  const subExpiry   = document.getElementById('subExpiry');
  const subDaysLeft = document.getElementById('subDaysLeft');
  const subAutoRenew= document.getElementById('subAutoRenew');
  const subFill     = document.getElementById('subProgressFill');
  const subLabel    = document.getElementById('subProgressLabel');
  const subBadge    = document.getElementById('subStatusBadge');

  if (subPlan)     subPlan.textContent    = school.subscription?.plan || 'standard';
  if (subAutoRenew)subAutoRenew.textContent = school.subscription?.autoLock ? 'Enabled' : 'Disabled';

  if (school.subscription?.expiryDate) {
    const expiry  = new Date(school.subscription.expiryDate);
    const days    = Math.ceil((expiry - new Date()) / (1000*60*60*24));
    const pct     = Math.max(0, Math.min(100, (days / 365) * 100));

    if (subExpiry)   subExpiry.textContent   = expiry.toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'});
    if (subDaysLeft) subDaysLeft.textContent = days > 0 ? `${days} days` : 'Expired';
    if (subFill)     subFill.style.width     = pct + '%';
    if (subLabel)    subLabel.textContent    = days > 0 ? `${days} days remaining` : 'Subscription expired';

    if (subFill) {
      subFill.style.background =
        days > 90  ? '#2ecc71' :
        days > 30  ? '#f39c12' :
        '#e74c3c';
    }

    if (subBadge) {
      subBadge.className = `badge badge-${
        school.status === 'active' ? 'success' :
        school.status === 'locked' ? 'danger'  :
        'warning'
      }`;
      subBadge.textContent = school.status?.charAt(0).toUpperCase()+school.status?.slice(1);
    }
  }
};

/* ══════════════════════════════════════════════════════════
   SAVE ALL SETTINGS
══════════════════════════════════════════════════════════ */
document.getElementById('saveAllBtn')?.addEventListener('click', saveAllSettings);

async function saveAllSettings() {
  const btn     = document.getElementById('saveAllBtn');
  const text    = document.getElementById('saveAllText');
  const spinner = document.getElementById('saveAllSpinner');

  if (btn)     btn.disabled         = true;
  if (text)    text.style.display   = 'none';
  if (spinner) spinner.style.display= 'inline';

  const payload = {
    schoolName    : document.getElementById('schoolName')?.value.trim(),
    schoolMotto   : document.getElementById('schoolMotto')?.value.trim(),
    schoolEmail   : document.getElementById('schoolEmail')?.value.trim(),
    schoolPhone   : document.getElementById('schoolPhone')?.value.trim(),
    schoolAddress : document.getElementById('schoolAddress')?.value.trim(),
    principalName : document.getElementById('principalName')?.value.trim(),
    principalPhone: document.getElementById('principalPhone')?.value.trim(),
    currentYear   : document.getElementById('currentYear')?.value.trim(),
    currentTerm   : document.getElementById('currentTerm')?.value,
    termOpeningDate:document.getElementById('termOpeningDate')?.value.trim(),
    termClosingDate:document.getElementById('termClosingDate')?.value.trim(),
    nextTermDate  : document.getElementById('nextTermDate')?.value.trim(),
  };

  /* Validate */
  if (!payload.schoolName) {
    showToast('School name is required.', 'warning');
    if (btn)     btn.disabled         = false;
    if (text)    text.style.display   = 'inline';
    if (spinner) spinner.style.display= 'none';
    switchSection('school');
    return;
  }

  const result = await API.put('/settings/school', payload);

  if (btn)     btn.disabled         = false;
  if (text)    text.style.display   = 'inline';
  if (spinner) spinner.style.display= 'none';

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to save settings.', 'error');
    return;
  }

  /* Update last saved */
  const savedInfo = document.getElementById('lastSavedInfo');
  const savedTime = document.getElementById('lastSavedTime');
  if (savedInfo) savedInfo.style.display = 'flex';
  if (savedTime) savedTime.textContent   = new Date().toLocaleTimeString('en-KE',{
    hour:'2-digit', minute:'2-digit',
  });

  showToast('All settings saved successfully!', 'success');
}

/* ══════════════════════════════════════════════════════════
   CHANGE PASSWORD
══════════════════════════════════════════════════════════ */
document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
  const current = document.getElementById('currentPassword')?.value;
  const newPw   = document.getElementById('newPassword')?.value;
  const confirm = document.getElementById('confirmPassword')?.value;

  if (!current) { showToast('Enter your current password.', 'warning'); return; }
  if (!newPw || newPw.length < 8) {
    showToast('New password must be at least 8 characters.', 'warning');
    return;
  }
  if (newPw !== confirm) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  const btn = document.getElementById('changePasswordBtn');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Updating...'; }

  const result = await API.put('/settings/password', {
    currentPassword: current,
    newPassword    : newPw,
  });

  if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-key"></i> Update Password'; }

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to change password.', 'error');
    return;
  }

  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value     = '';
  document.getElementById('confirmPassword').value = '';
  document.getElementById('pwStrengthWrap').style.display = 'none';

  showToast('Password changed successfully!', 'success');
});

/* ══════════════════════════════════════════════════════════
   PASSWORD STRENGTH METER
══════════════════════════════════════════════════════════ */
document.getElementById('newPassword')?.addEventListener('input', function () {
  const pw   = this.value;
  const wrap = document.getElementById('pwStrengthWrap');
  const fill = document.getElementById('pwStrengthFill');
  const label= document.getElementById('pwStrengthLabel');

  if (!pw) {
    if (wrap) wrap.style.display = 'none';
    return;
  }

  if (wrap) wrap.style.display = 'flex';

  let strength = 0;
  if (pw.length >= 8)                strength++;
  if (/[A-Z]/.test(pw))             strength++;
  if (/[0-9]/.test(pw))             strength++;
  if (/[^A-Za-z0-9]/.test(pw))      strength++;

  const levels = [
    { pct:0,   text:'Too short',  color:'#cbd5e0' },
    { pct:25,  text:'Weak',       color:'#e74c3c' },
    { pct:50,  text:'Fair',       color:'#f39c12' },
    { pct:75,  text:'Good',       color:'#2e86c1' },
    { pct:100, text:'Strong',     color:'#27ae60' },
  ];

  const lvl = pw.length < 8 ? 0 : Math.min(strength, 4);
  const info = levels[lvl];

  if (fill)  { fill.style.width = info.pct + '%'; fill.style.background = info.color; }
  if (label) { label.textContent = info.text; label.style.color = info.color; }
});

/* ══════════════════════════════════════════════════════════
   PASSWORD VISIBILITY TOGGLES
══════════════════════════════════════════════════════════ */
document.querySelectorAll('.settings-pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    const isPassword = target.type === 'password';
    target.type = isPassword ? 'text' : 'password';
    btn.querySelector('i').className = `fas fa-eye${isPassword ? '-slash' : ''}`;
  });
});

/* ══════════════════════════════════════════════════════════
   LOGO UPLOAD
══════════════════════════════════════════════════════════ */
document.getElementById('uploadLogoBtn')?.addEventListener('click', () => {
  document.getElementById('logoFileInput')?.click();
});

document.getElementById('logoFileInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('Logo must be under 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const preview = document.getElementById('logoPreview');
    if (preview) {
      preview.innerHTML = `
        <img src="${ev.target.result}"
          style="width:100%;height:100%;object-fit:cover;border-radius:16px;"
          alt="School Logo"/>`;
    }
  };
  reader.readAsDataURL(file);
  showToast('Logo preview updated. Save settings to apply.', 'info');
});

/* ══════════════════════════════════════════════════════════
   CTRL+S TO SAVE
══════════════════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    saveAllSettings();
  }
});

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
switchSection('school');
loadSettings();

/* ══════════════════════════════════════════════════════════
   SMS PANEL
══════════════════════════════════════════════════════════ */
const loadSmsExams = async () => {
  const result = await API.get('/exams');
  if (!result?.ok) return;

  const sel = document.getElementById('smsExamSelect');
  if (!sel) return;

  sel.innerHTML = '<option value="">-- Select Exam --</option>' +
    (result.data.exams || []).map(e =>
      `<option value="${e._id}">[T${e.term}] ${e.name} — ${e.class?.name || ''}</option>`
    ).join('');
};

/* Test SMS */
document.getElementById('sendTestSmsBtn')?.addEventListener('click', async () => {
  const phone   = document.getElementById('testSmsPhone')?.value.trim();
  const message = document.getElementById('testSmsMsg')?.value.trim();
  const result  = document.getElementById('testSmsResult');

  if (!phone) { showToast('Enter a phone number.', 'warning'); return; }

  const btn = document.getElementById('sendTestSmsBtn');
  if (btn) btn.disabled = true;

  const res = await API.post('/sms/test', { phone, message });

  if (btn) btn.disabled = false;

  if (!res?.ok) {
    showToast('SMS failed. Check your AT credentials in .env', 'error');
    if (result) result.innerHTML =
      `<span style="color:var(--danger);font-size:0.8rem;">Failed: ${res?.data?.message || 'Check .env'}</span>`;
    return;
  }

  showToast('Test SMS sent!', 'success');
  if (result) result.innerHTML =
    `<span style="color:var(--success);font-size:0.8rem;">✓ SMS sent to ${phone}</span>`;
});

/* Notify at-risk */
document.getElementById('notifyAtRiskBtn')?.addEventListener('click', async () => {
  const examId = document.getElementById('smsExamSelect')?.value;
  if (!examId) { showToast('Select an exam first.', 'warning'); return; }

  if (!confirm('Send SMS to parents of all at-risk students?')) return;

  const btn = document.getElementById('notifyAtRiskBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; }

  const res = await API.post('/sms/notify-at-risk', { examId });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Notify At-Risk Parents'; }

  if (!res?.ok) { showToast('Failed to send SMS.', 'error'); return; }

  showToast(res.data.message, 'success');
});

/* Load exams when SMS section is opened */
document.querySelectorAll('.settings-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (item.dataset.section === 'sms') loadSmsExams();
  });
});