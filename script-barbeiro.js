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
  const CURRENCY = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  let calendarAnchor = new Date();

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

  function getServicePrice(serviceId) {
    const service = SERVICES.find((item) => item.id === serviceId);
    return service ? Number(service.price || 0) : 0;
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

  function getOwnedAppointments(userId) {
    return getAppointments().filter((appointment) => String(appointment.assignedBarberId || '') === String(userId));
  }

  function getCompletedAppointments(userId) {
    return getOwnedAppointments(userId).filter((appointment) => appointment.status === 'completed');
  }

  function getMonthlyAppointments(userId, anchorDate) {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return getCompletedAppointments(userId).filter((appointment) => String(appointment.date || '').startsWith(monthPrefix));
  }

  function getMonthlyRevenue(userId, anchorDate) {
    return getMonthlyAppointments(userId, anchorDate).reduce((total, appointment) => {
      return total + getServicePrice(appointment.service);
    }, 0);
  }

  function getCompletedClientCount(userId, anchorDate) {
    return getMonthlyAppointments(userId, anchorDate).length;
  }

  function formatMoney(value) {
    return CURRENCY.format(Number(value || 0));
  }

  function getMonthLabel(date) {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getCalendarMatrix(anchorDate) {
    const firstDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - startDay);

    const matrix = [];
    const cursor = new Date(startDate);
    for (let week = 0; week < 6; week += 1) {
      const row = [];
      for (let day = 0; day < 7; day += 1) {
        row.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      matrix.push(row);
    }
    return matrix;
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
    const ownAppointments = getOwnedAppointments(user.id);
    const openAppointments = getAppointments().filter((appointment) => !appointment.assignedBarberId && (appointment.status || 'pending') === 'pending');
    const done = ownAppointments.filter((appointment) => appointment.status === 'completed');
    const monthlyRevenue = getMonthlyRevenue(user.id, calendarAnchor);
    const monthlyClients = getCompletedClientCount(user.id, calendarAnchor);
    const monthlyDone = getMonthlyAppointments(user.id, calendarAnchor).length;

    const bind = (selector, value) => {
      const target = qs(selector);
      if (target) target.textContent = String(value);
    };

    bind('#barber-stat-revenue', formatMoney(monthlyRevenue));
    bind('#barber-stat-clients', monthlyClients);
    bind('#barber-stat-done', monthlyDone);
    bind('#barber-open-count', appointments.filter((appointment) => (appointment.status || 'pending') === 'pending').length);
    bind('#barber-stat-open', openAppointments.length);
  }

  function renderCalendar(user) {
    const grid = qs('#barber-calendar');
    const title = qs('#calendar-month-title');
    const note = qs('#barber-calendar-note');
    if (!grid) return;

    const monthAppointments = getMonthlyAppointments(user.id, calendarAnchor);
    const appointmentMap = new Map();
    monthAppointments.forEach((appointment) => {
      if (!appointment.date) return;
      const current = appointmentMap.get(appointment.date) || [];
      current.push(appointment);
      appointmentMap.set(appointment.date, current);
    });

    if (title) title.textContent = getMonthLabel(calendarAnchor);
    grid.innerHTML = '';

    const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
    weekLabels.forEach((label) => {
      const header = document.createElement('div');
      header.className = 'calendar-weekday';
      header.textContent = label;
      grid.appendChild(header);
    });

    const today = toLocalDateKey(new Date());
    const matrix = getCalendarMatrix(calendarAnchor);

    matrix.forEach((week) => {
      week.forEach((day) => {
        const cell = document.createElement('button');
        const dateKey = toLocalDateKey(day);
        const isCurrentMonth = day.getMonth() === calendarAnchor.getMonth();
        const appointments = appointmentMap.get(dateKey) || [];
        const totalRevenue = appointments.reduce((sum, appointment) => sum + getServicePrice(appointment.service), 0);

        cell.type = 'button';
        cell.className = 'calendar-day';
        if (!isCurrentMonth) cell.classList.add('outside');
        if (dateKey === today) cell.classList.add('today');
        if (appointments.length > 0) cell.classList.add('has-appointments');

        cell.innerHTML = `
          <span class="calendar-day-number">${day.getDate()}</span>
          <span class="calendar-day-count">${appointments.length ? `${appointments.length} corte${appointments.length > 1 ? 's' : ''}` : 'Livre'}</span>
          <span class="calendar-day-money">${appointments.length ? formatMoney(totalRevenue) : ''}</span>
        `;

        cell.addEventListener('click', () => {
          if (!note) return;
          if (appointments.length === 0) {
            note.textContent = `${day.toLocaleDateString('pt-BR')} sem atendimentos concluidos.`;
            return;
          }

          const summary = appointments
            .map((appointment) => `${appointment.time} - ${appointment.name} (${getServiceName(appointment.service)})`)
            .join(' | ');
          note.textContent = `${day.toLocaleDateString('pt-BR')}: ${summary}`;
        });

        grid.appendChild(cell);
      });
    });

    if (note) {
      if (monthAppointments.length === 0) {
        note.textContent = 'Nenhum atendimento concluido neste mes ainda.';
      } else {
        note.textContent = `${monthAppointments.length} atendimento${monthAppointments.length > 1 ? 's' : ''} concluido${monthAppointments.length > 1 ? 's' : ''} neste mes.`;
      }
    }
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
    renderCalendar(user);
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
    const prevButton = qs('#calendar-prev');
    const nextButton = qs('#calendar-next');

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

    prevButton?.addEventListener('click', () => {
      calendarAnchor = new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() - 1, 1);
      const user = getSessionUser();
      if (user) renderPortal(user);
    });

    nextButton?.addEventListener('click', () => {
      calendarAnchor = new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() + 1, 1);
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
      calendarAnchor = new Date();
      setVisible(true);
      renderPortal(sessionUser);
    } else {
      clearSessionUser();
      setVisible(false);
    }
  });
})();
