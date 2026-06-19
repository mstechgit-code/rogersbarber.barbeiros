(function () {
  "use strict";

  const SERVICES = [
    { id: 'corte', name: 'Corte Masculino/Infantil', duration: 30, price: 50 },
    { id: 'barba', name: 'Barba Simples', duration: 20, price: 50 },
    { id: 'corte_barba', name: 'Corte + Barba', duration: 50, price: 80 },
    { id: 'sobrancelha', name: 'Sobrancelha', duration: 10, price: 15 },
    { id: 'bigode', name: 'Bigode', duration: 10, price: 15 },
    { id: 'corte_mensal', name: 'Corte mensal', period: 'mensal', price: 140 },
    { id: 'corte_mensal_barba', name: 'Corte mensal + barba', period: 'mensal', price: 240 }
  ];

  const AUTH_KEY = 'barberUserSession';

  function qs(selector) {
    return document.querySelector(selector);
  }

  function getAppointments() {
    try {
      return JSON.parse(localStorage.getItem('appointments') || '[]');
    } catch (error) {
      return [];
    }
  }

  function saveAppointments(appointments) {
    localStorage.setItem('appointments', JSON.stringify(appointments));
  }

  function getBarberUsers() {
    try {
      return JSON.parse(localStorage.getItem('barberUsers') || '[]');
    } catch (error) {
      return [];
    }
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem('history') || '[]');
    } catch (error) {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem('history', JSON.stringify(history));
  }

  function addHistoryEntry(action, appointmentName, details) {
    const history = getHistory();
    history.push({
      timestamp: new Date().toISOString(),
      action,
      appointmentName,
      details
    });
    saveHistory(history.slice(-1000));
  }

  function getSessionUser() {
    try {
      return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function setSessionUser(user) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
  }

  function clearSessionUser() {
    sessionStorage.removeItem(AUTH_KEY);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function findMatchingUser(login, password) {
    const normalizedLogin = normalize(login);
    return getBarberUsers().find((user) => {
      return user.role === 'barbeiro' && normalize(user.login) === normalizedLogin && String(user.password || '') === String(password || '');
    }) || null;
  }

  function getServiceName(serviceId) {
    const service = SERVICES.find((item) => item.id === serviceId);
    return service ? service.name : serviceId;
  }

  function getAssignedAppointments(userId) {
    return getAppointments().filter((appointment) => {
      const assignedId = String(appointment.assignedBarberId || '');
      const status = appointment.status || 'pending';
      return assignedId === String(userId) || (!assignedId && status === 'pending');
    }).sort((a, b) => {
      return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    });
  }

  function setStatus(message, type) {
    const status = qs('#barber-auth-status');
    if (!status) return;
    status.textContent = message;
    status.className = `status ${type || ''}`.trim();
  }

  function setVisible(isVisible) {
    const modal = qs('#barber-auth-modal');
    const content = qs('#barber-content');
    if (modal) modal.style.display = isVisible ? 'none' : 'flex';
    if (content) content.style.display = isVisible ? 'block' : 'none';
  }

  function renderHeader(user) {
    const info = qs('#barber-user-info');
    const roleChip = qs('#barber-role-chip');
    if (info) info.textContent = `${user.name} (@${user.login})`;
    if (roleChip) roleChip.textContent = user.role === 'barbeiro' ? 'Barbeiro ativo' : user.role;
  }

  function renderStats(user) {
    const appointments = getAssignedAppointments(user.id);
    const ownAppointments = getAppointments().filter((appointment) => String(appointment.assignedBarberId || '') === String(user.id));
    const openAppointments = getAppointments().filter((appointment) => !appointment.assignedBarberId && (appointment.status || 'pending') === 'pending');
    const pending = ownAppointments.filter((appointment) => (appointment.status || 'pending') === 'pending');
    const done = ownAppointments.filter((appointment) => appointment.status === 'completed');

    const bind = (selector, value) => {
      const target = qs(selector);
      if (target) target.textContent = String(value);
    };

    bind('#barber-open-count', appointments.filter((appointment) => (appointment.status || 'pending') === 'pending').length);
    bind('#barber-stat-open', openAppointments.length);
    bind('#barber-stat-mine', ownAppointments.length);
    bind('#barber-stat-pending', pending.length);
    bind('#barber-stat-done', done.length);
  }

  function renderWorkList(user) {
    const list = qs('#barber-work-list');
    const empty = qs('#barber-empty');
    if (!list) return;

    const appointments = getAssignedAppointments(user.id);
    list.innerHTML = '';

    const visible = appointments.filter((appointment) => {
      const assignedId = String(appointment.assignedBarberId || '');
      const status = appointment.status || 'pending';
      return assignedId === String(user.id) || (!assignedId && status === 'pending');
    });

    if (visible.length === 0) {
      if (empty) empty.textContent = 'Nenhum atendimento na sua fila no momento.';
      return;
    }

    if (empty) empty.textContent = '';

    visible.forEach((appointment) => {
      const li = document.createElement('li');
      li.className = 'appointment-item';

      const serviceName = getServiceName(appointment.service);
      const status = appointment.status || 'pending';
      const assigned = appointment.assignedBarberId ? 'Atendimento assumido' : 'Disponivel';

      li.innerHTML = `
        <div>
          <strong>${appointment.name}</strong> - ${serviceName}
          <br><span class="muted">${appointment.date} ${appointment.time} - ${appointment.phone || 'sem telefone'}</span>
          <br><span class="muted">${assigned}</span>
        </div>
      `;

      const actions = document.createElement('div');
      actions.className = 'appointment-actions';

      if (!appointment.assignedBarberId && status === 'pending') {
        const claim = document.createElement('button');
        claim.className = 'btn btn-success';
        claim.textContent = 'Assumir';
        claim.addEventListener('click', () => claimAppointment(user, appointment.id));
        actions.appendChild(claim);
      }

      if (String(appointment.assignedBarberId || '') === String(user.id) && status === 'pending') {
        const done = document.createElement('button');
        done.className = 'btn btn-success';
        done.textContent = 'Concluir';
        done.addEventListener('click', () => updateAppointmentStatus(user, appointment.id, 'completed'));
        actions.appendChild(done);

        const cancel = document.createElement('button');
        cancel.className = 'btn btn-danger';
        cancel.textContent = 'Cancelar';
        cancel.addEventListener('click', () => updateAppointmentStatus(user, appointment.id, 'cancelled'));
        actions.appendChild(cancel);

        const release = document.createElement('button');
        release.className = 'btn btn-secondary';
        release.textContent = 'Liberar';
        release.addEventListener('click', () => releaseAppointment(user, appointment.id));
        actions.appendChild(release);
      }

      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function renderPortal(user) {
    renderHeader(user);
    renderStats(user);
    renderWorkList(user);
  }

  function claimAppointment(user, appointmentId) {
    const appointments = getAppointments();
    const index = appointments.findIndex((item) => item.id === appointmentId);
    if (index < 0) return;

    appointments[index].assignedBarberId = user.id;
    saveAppointments(appointments);
    addHistoryEntry('claimed', appointments[index].name, `${user.name} assumiu o atendimento.`);
    renderPortal(user);
  }

  function updateAppointmentStatus(user, appointmentId, status) {
    const appointments = getAppointments();
    const index = appointments.findIndex((item) => item.id === appointmentId);
    if (index < 0) return;

    appointments[index].status = status;
    saveAppointments(appointments);
    addHistoryEntry(status, appointments[index].name, `${user.name} marcou o atendimento como ${status}.`);
    renderPortal(user);
  }

  function releaseAppointment(user, appointmentId) {
    const appointments = getAppointments();
    const index = appointments.findIndex((item) => item.id === appointmentId);
    if (index < 0) return;

    appointments[index].assignedBarberId = '';
    saveAppointments(appointments);
    addHistoryEntry('released', appointments[index].name, `${user.name} liberou o atendimento.`);
    renderPortal(user);
  }

  function initLogin() {
    const formButton = qs('#barber-login-btn');
    const loginInput = qs('#barber-login');
    const passwordInput = qs('#barber-password');
    const logoutButton = qs('#barber-logout');
    const refreshButton = qs('#barber-refresh');

    function tryLogin() {
      const user = findMatchingUser(loginInput?.value, passwordInput?.value);
      if (!user) {
        setStatus('Login ou senha invalidos.', 'error');
        return;
      }

      setSessionUser(user);
      setStatus('', '');
      renderPortal(user);
      setVisible(true);
    }

    if (formButton) formButton.addEventListener('click', tryLogin);

    passwordInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') tryLogin();
    });

    loginInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') tryLogin();
    });

    logoutButton?.addEventListener('click', (event) => {
      event.preventDefault();
      clearSessionUser();
      setVisible(false);
      loginInput.value = '';
      passwordInput.value = '';
      setStatus('', '');
    });

    refreshButton?.addEventListener('click', () => {
      const user = getSessionUser();
      if (user) renderPortal(user);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const year = qs('#year-barber');
    if (year) year.textContent = new Date().getFullYear();

    initLogin();

    const sessionUser = getSessionUser();
    if (sessionUser && sessionUser.role === 'barbeiro' && findMatchingUser(sessionUser.login, sessionUser.password)) {
      setVisible(true);
      renderPortal(sessionUser);
    } else {
      clearSessionUser();
      setVisible(false);
    }
  });
})();
