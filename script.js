// Script completo de admin com todas as features
(function(){
  const SERVICES = [
    {id:'corte', name:'Corte Masculino/Infantil', duration:30, price:50},
    {id:'barba', name:'Barba Simples', duration:20, price:50},
    {id:'corte_barba', name:'Corte + Barba', duration:50, price:80},
    {id:'sobrancelha', name:'Sobrancelha', duration:10, price:15},
    {id:'bigode', name:'Bigode', duration:10, price:15},
    {id:'corte_mensal', name:'Corte mensal', period:'mensal', price:140},
    {id:'corte_mensal_barba', name:'Corte mensal + barba', period:'mensal', price:240}
  ];

  let charts = {};
  let currentPage = 1;
  let itemsPerPage = 10;
  let currentSort = 'date-asc';
  let selectedAppointments = new Set();
  let currentFilter = {search: '', status: '', dateFrom: '', dateTo: ''};
  const ADMIN_PASSWORD = '1234';
  const ADMIN_AUTH_KEY = 'barberAdminAuthenticated';

  function qs(sel){return document.querySelector(sel)}
  function qsa(sel){return document.querySelectorAll(sel)}

  // AUTH
  function initAuth(){
    const modal = qs('#auth-modal');
    const content = qs('#admin-content');
    const passwordInput = qs('#admin-password');
    const loginBtn = qs('#admin-login');
    const logoutBtn = qs('#admin-logout');

    function showAdmin(){
      if(modal) modal.style.display = 'none';
      if(content) content.style.display = 'block';
    }

    function showLogin(){
      if(modal) modal.style.display = 'flex';
      if(content) content.style.display = 'none';
      passwordInput?.focus();
    }

    function login(){
      if(passwordInput?.value === ADMIN_PASSWORD){
        sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
        passwordInput.value = '';
        showAdmin();
      } else {
        alert('Senha incorreta.');
        if(passwordInput) passwordInput.value = '';
        passwordInput?.focus();
      }
    }

    if(sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true') showAdmin();
    else showLogin();

    loginBtn?.addEventListener('click', login);
    passwordInput?.addEventListener('keydown', (event)=>{
      if(event.key === 'Enter') login();
    });
    logoutBtn?.addEventListener('click', (event)=>{
      event.preventDefault();
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
      showLogin();
    });
  }
  
  // DARK MODE
  function initDarkMode(){
    const toggle = qs('#dark-mode-toggle');
    const icon = qs('#theme-icon');
    const html = document.documentElement;
    const saved = localStorage.getItem('darkMode') === 'true';
    if(saved) html.classList.add('dark-mode');
    
    toggle.addEventListener('click', ()=>{
      html.classList.toggle('dark-mode');
      const isDark = html.classList.contains('dark-mode');
      localStorage.setItem('darkMode', isDark);
      icon.textContent = isDark ? '☀️' : '🌙';
    });
  }

  // TAB SYSTEM
  function initTabs(){
    qsa('.tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const tabId = btn.dataset.tab;
        qsa('.tab-content').forEach(t=>t.classList.remove('active'));
        qsa('.tab-btn').forEach(b=>b.classList.remove('active'));
        qs(`#${tabId}`)?.classList.add('active');
        btn.classList.add('active');
        
        if(tabId === 'dashboard') renderCharts();
        if(tabId === 'timeline') renderTimeline();
        if(tabId === 'users') renderUsers();
      });
    });
  }

  // UTILITIES
  function getAppointments(){
    try{return JSON.parse(localStorage.getItem('appointments')||'[]')}catch(e){return[]}
  }
  function saveAppointments(arr){localStorage.setItem('appointments',JSON.stringify(arr))}
  function getHistory(){
    try{return JSON.parse(localStorage.getItem('history')||'[]')}catch(e){return[]}
  }
  function saveHistory(arr){localStorage.setItem('history',JSON.stringify(arr))}
  function getBarberUsers(){
    try{return JSON.parse(localStorage.getItem('barberUsers')||'[]')}catch(e){return[]}
  }
  function saveBarberUsers(arr){localStorage.setItem('barberUsers',JSON.stringify(arr))}
  function addHistoryEntry(action, appointmentName, details){
    const history = getHistory();
    history.push({
      timestamp: new Date().toISOString(),
      action,
      appointmentName,
      details
    });
    saveHistory(history.slice(-1000)); // Keep last 1000
  }

  function setUserStatus(message, type){
    const status = qs('#user-status');
    if(!status) return;
    status.textContent = message;
    status.className = `status ${type || ''}`.trim();
  }

  // DASHBOARD & CHARTS
  function updateStats(){
    const appts = getAppointments();
    const today = new Date().toISOString().slice(0,10);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().slice(0,10);
    
    const todayAppts = appts.filter(a => a.date === today);
    const weekAppts = appts.filter(a => a.date >= weekStartStr);
    const completed = appts.filter(a => a.status === 'completed');
    const cancelled = appts.filter(a => a.status === 'cancelled');
    const pending = appts.filter(a => !a.status || a.status === 'pending');
    
    let revenue = 0;
    completed.forEach(a => {
      const service = SERVICES.find(s => s.id === a.service);
      if(service) revenue += service.price || 0;
    });
    
    let duration = 0;
    completed.forEach(a => {
      const service = SERVICES.find(s => s.id === a.service);
      if(service && service.duration) duration += service.duration;
    });
    
    qs('#stat-today').textContent = todayAppts.length;
    qs('#stat-week').textContent = weekAppts.length;
    qs('#stat-completed').textContent = completed.length;
    qs('#stat-cancelled').textContent = cancelled.length;
    qs('#stat-revenue').textContent = `R$ ${revenue.toFixed(2).replace('.',',')}`;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    qs('#stat-duration').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    // Update badge
    qs('#pending-badge').textContent = pending.length;
  }

  function renderCharts(){
    if(charts.revenue) return; // Already rendered
    
    const appts = getAppointments();
    const last7Days = [];
    for(let i=6; i>=0; i--){
      const d = new Date(); d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().slice(0,10));
    }
    
    const revenueByDay = {};
    last7Days.forEach(d => revenueByDay[d] = 0);
    appts.filter(a=>a.status==='completed').forEach(a=>{
      const service = SERVICES.find(s=>s.id===a.service);
      if(service && revenueByDay[a.date] !== undefined) revenueByDay[a.date] += service.price || 0;
    });
    
    // Revenue Chart
    const revenueCtx = qs('#revenue-chart')?.getContext('2d');
    if(revenueCtx){
      charts.revenue = new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels: last7Days.map(d=>new Date(d).toLocaleDateString('pt-BR')),
          datasets: [{
            label: 'Receita (R$)',
            data: last7Days.map(d=>revenueByDay[d]),
            borderColor: '#111',
            backgroundColor: 'rgba(0,0,0,0.05)',
            tension: 0.4,
            fill: true
          }]
        },
        options: { responsive: true, maintainAspectRatio: true }
      });
    }
    
    // Services Chart
    const serviceCount = {};
    SERVICES.forEach(s=>serviceCount[s.name]=0);
    appts.forEach(a=>{
      const service = SERVICES.find(s=>s.id===a.service);
      if(service) serviceCount[service.name]++;
    });
    
    const servicesCtx = qs('#services-chart')?.getContext('2d');
    if(servicesCtx){
      charts.services = new Chart(servicesCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(serviceCount),
          datasets: [{
            data: Object.values(serviceCount),
            backgroundColor: ['#111','#333','#555','#777','#999','#bbb','#ddd']
          }]
        },
        options: { responsive: true, maintainAspectRatio: true }
      });
    }
    
    // Cancellation Chart
    const total = appts.length;
    const cancelledCount = appts.filter(a=>a.status==='cancelled').length;
    const cancellationCtx = qs('#cancellation-chart')?.getContext('2d');
    if(cancellationCtx){
      charts.cancellation = new Chart(cancellationCtx, {
        type: 'pie',
        data: {
          labels: ['Completados', 'Cancelados', 'Pendentes'],
          datasets: [{
            data: [
              appts.filter(a=>a.status==='completed').length,
              cancelledCount,
              appts.filter(a=>!a.status||a.status==='pending').length
            ],
            backgroundColor: ['#111','#999','#ddd']
          }]
        },
        options: { responsive: true, maintainAspectRatio: true }
      });
    }
  }

  // APPOINTMENTS LIST WITH PAGINATION & SORTING
  function getFilteredAndSorted(){
    let appts = getAppointments();
    
    if(currentFilter.search){
      const search = currentFilter.search.toLowerCase();
      appts = appts.filter(a => 
        a.name.toLowerCase().includes(search) || 
        a.phone.includes(currentFilter.search)
      );
    }
    
    if(currentFilter.status){
      appts = appts.filter(a => (a.status || 'pending') === currentFilter.status);
    }
    
    if(currentFilter.dateFrom) appts = appts.filter(a => a.date >= currentFilter.dateFrom);
    if(currentFilter.dateTo) appts = appts.filter(a => a.date <= currentFilter.dateTo);
    
    // Sort
    appts.sort((a,b)=>{
      if(currentSort === 'date-asc') return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
      if(currentSort === 'date-desc') return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
      if(currentSort === 'name') return a.name.localeCompare(b.name);
      if(currentSort === 'price-desc'){
        const priceA = (SERVICES.find(s=>s.id===a.service)?.price || 0);
        const priceB = (SERVICES.find(s=>s.id===b.service)?.price || 0);
        return priceB - priceA;
      }
      return 0;
    });
    
    return appts;
  }

  function renderAppointments(){
    const list = qs('#appointments-list');
    const no = qs('#no-appointments');
    if(!list) return;
    
    const filtered = getFilteredAndSorted();
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paged = filtered.slice(start, end);
    
    qs('#appt-count').textContent = `(${filtered.length})`;
    
    if(filtered.length === 0){
      no.textContent = 'Nenhum agendamento encontrado.';
      list.innerHTML = '';
      renderPagination(0);
      return;
    }
    
    no.textContent = '';
    list.innerHTML = '';
    paged.forEach(a=>{
      const li = document.createElement('li');
      const service = SERVICES.find(s=>s.id===a.service);
      const statusClass = a.status === 'completed' ? 'status-completed' : (a.status === 'cancelled' ? 'status-cancelled' : 'status-pending');
      const statusText = a.status === 'completed' ? ' ✓' : (a.status === 'cancelled' ? ' ✗' : '');
      
      li.className = `appointment-item ${statusClass}`;
      li.innerHTML = `
        <div class="checkbox-wrapper">
          <input type="checkbox" data-id="${a.id}" class="appt-checkbox">
        </div>
        <div>
          <strong>${a.name}${statusText}</strong> — ${service?service.name:a.service}
          <br><span class="muted">${a.date} ${a.time} — ${a.phone}</span>
        </div>
      `;
      
      const actions = document.createElement('div');
      actions.className = 'appointment-actions';
      
      if(a.status !== 'completed' && a.status !== 'cancelled'){
        const done = document.createElement('button');
        done.className = 'btn btn-success';
        done.textContent = 'Feito';
        done.addEventListener('click', ()=>markDone(a.id));
        actions.appendChild(done);
        
        const cancel = document.createElement('button');
        cancel.className = 'btn btn-danger';
        cancel.textContent = 'Cancelar';
        cancel.addEventListener('click', ()=>markCancelled(a.id));
        actions.appendChild(cancel);
        
        const edit = document.createElement('button');
        edit.className = 'btn btn-info';
        edit.textContent = 'Editar';
        edit.addEventListener('click', ()=>openEditModal(a));
        actions.appendChild(edit);
      } else {
        const reactivate = document.createElement('button');
        reactivate.className = 'btn btn-warning';
        reactivate.textContent = 'Reativar';
        reactivate.addEventListener('click', ()=>reactivate_(a.id));
        actions.appendChild(reactivate);
      }
      
      const del = document.createElement('button');
      del.className = 'btn btn-danger';
      del.textContent = 'Remover';
      del.addEventListener('click', ()=>deleteAppointment(a.id));
      actions.appendChild(del);
      
      li.appendChild(actions);
      list.appendChild(li);
      
      // Add checkbox listener
      li.querySelector('.appt-checkbox').addEventListener('change', (e)=>{
        if(e.target.checked) selectedAppointments.add(a.id);
        else selectedAppointments.delete(a.id);
        updateBatchActions();
      });
    });
    
    renderPagination(Math.ceil(filtered.length / itemsPerPage));
  }

  function renderPagination(totalPages){
    const pagination = qs('#pagination');
    if(!pagination || totalPages <= 1){
      pagination.innerHTML = '';
      return;
    }
    
    pagination.innerHTML = '';
    
    if(currentPage > 1){
      const prev = document.createElement('button');
      prev.textContent = 'Anterior';
      prev.addEventListener('click', ()=>{
        currentPage--;
        renderAppointments();
        window.scrollTo(0, 0);
      });
      pagination.appendChild(prev);
    }
    
    for(let i=1; i<=totalPages; i++){
      const btn = document.createElement('button');
      btn.textContent = i;
      if(i === currentPage) btn.classList.add('active');
      btn.addEventListener('click', ()=>{
        currentPage = i;
        renderAppointments();
        window.scrollTo(0, 0);
      });
      pagination.appendChild(btn);
    }
    
    if(currentPage < totalPages){
      const next = document.createElement('button');
      next.textContent = 'Próximo';
      next.addEventListener('click', ()=>{
        currentPage++;
        renderAppointments();
        window.scrollTo(0, 0);
      });
      pagination.appendChild(next);
    }
  }

  function markDone(id){
    const appts = getAppointments();
    const idx = appts.findIndex(x=>x.id===id);
    if(idx>=0){
      const appt = appts[idx];
      appt.status = 'completed';
      saveAppointments(appts);
      addHistoryEntry('completed', appt.name, `Marcado como feito em ${new Date().toLocaleString('pt-BR')}`);
      updateStats();
      renderAppointments();
    }
  }

  function markCancelled(id){
    const appts = getAppointments();
    const idx = appts.findIndex(x=>x.id===id);
    if(idx>=0){
      const appt = appts[idx];
      appt.status = 'cancelled';
      saveAppointments(appts);
      addHistoryEntry('cancelled', appt.name, `Cancelado em ${new Date().toLocaleString('pt-BR')}`);
      updateStats();
      renderAppointments();
    }
  }

  function reactivate_(id){
    const appts = getAppointments();
    const idx = appts.findIndex(x=>x.id===id);
    if(idx>=0){
      const appt = appts[idx];
      appt.status = 'pending';
      saveAppointments(appts);
      addHistoryEntry('reactivated', appt.name, `Reativado em ${new Date().toLocaleString('pt-BR')}`);
      updateStats();
      renderAppointments();
    }
  }

  function deleteAppointment(id){
    if(confirm('Tem certeza?')){
      const appts = getAppointments();
      const appt = appts.find(x=>x.id===id);
      const filtered = appts.filter(x=>x.id!==id);
      saveAppointments(filtered);
      if(appt) addHistoryEntry('deleted', appt.name, `Deletado em ${new Date().toLocaleString('pt-BR')}`);
      updateStats();
      renderAppointments();
    }
  }

  function openEditModal(appt){
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Editar</h3>
        <p><strong>${appt.name}</strong></p>
        <label>Data: <input type="date" id="modal-date" value="${appt.date}"></label>
        <label>Hora: <input type="time" id="modal-time" value="${appt.time}"></label>
        <div class="modal-buttons">
          <button class="btn" id="modal-save">Salvar</button>
          <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    qs('#modal-save').addEventListener('click', ()=>{
      const newDate = qs('#modal-date').value;
      const newTime = qs('#modal-time').value;
      if(newDate && newTime){
        const appts = getAppointments();
        const idx = appts.findIndex(x=>x.id===appt.id);
        if(idx>=0){
          appts[idx].date = newDate;
          appts[idx].time = newTime;
          saveAppointments(appts);
          addHistoryEntry('edited', appt.name, `Data alterada para ${newDate} ${newTime}`);
          updateStats();
          renderAppointments();
          modal.remove();
        }
      }
    });
    
    qs('#modal-cancel').addEventListener('click', ()=>modal.remove());
    modal.addEventListener('click', (e)=>{if(e.target===modal) modal.remove()});
  }

  // BATCH ACTIONS
  function updateBatchActions(){
    const container = qs('#batch-actions');
    if(selectedAppointments.size > 0){
      container.style.display = 'flex';
    } else {
      container.style.display = 'none';
    }
  }

  function batchAction(action){
    const appts = getAppointments();
    selectedAppointments.forEach(id=>{
      const idx = appts.findIndex(x=>x.id===id);
      if(idx>=0){
        const appt = appts[idx];
        if(action === 'done') appt.status = 'completed';
        if(action === 'cancel') appt.status = 'cancelled';
        if(action === 'delete'){
          appts.splice(idx, 1);
        }
      }
    });
    saveAppointments(appts);
    selectedAppointments.clear();
    updateStats();
    renderAppointments();
    updateBatchActions();
  }

  // TIMELINE
  function renderTimeline(){
    const dateInput = qs('#timeline-date');
    const view = qs('#timeline-view');
    if(!dateInput) return;
    
    const date = dateInput.value || new Date().toISOString().slice(0,10);
    const appts = getAppointments().filter(a=>a.date===date).sort((a,b)=>a.time.localeCompare(b.time));
    
    view.innerHTML = '';
    for(let h=9; h<=19; h++){
      const timeStr = `${String(h).padStart(2,'0')}:00`;
      const slotAppts = appts.filter(a=>a.time.substring(0,2)==String(h).padStart(2,'0'));
      
      const slot = document.createElement('div');
      slot.className = 'timeline-slot';
      slot.innerHTML = `<div class="timeline-time">${timeStr}</div><div class="timeline-appointments"></div>`;
      
      const apptContainer = slot.querySelector('.timeline-appointments');
      if(slotAppts.length === 0){
        apptContainer.innerHTML = '<div class="timeline-appointment free">Disponível</div>';
      } else {
        slotAppts.forEach(a=>{
          const service = SERVICES.find(s=>s.id===a.service);
          const apptEl = document.createElement('div');
          apptEl.className = 'timeline-appointment';
          apptEl.textContent = `${a.name} - ${service?service.name:a.service}`;
          apptContainer.appendChild(apptEl);
        });
      }
      
      view.appendChild(slot);
    }
  }

  // HISTORY
  function renderHistory(){
    const list = qs('#history-list');
    const filter = qs('#history-filter')?.value || '';
    const dateFilter = qs('#history-date')?.value;
    
    let history = getHistory();
    if(filter) history = history.filter(h=>h.action===filter);
    if(dateFilter) history = history.filter(h=>h.timestamp.substring(0,10)===dateFilter);
    
    list.innerHTML = '';
    history.slice().reverse().forEach(entry=>{
      const li = document.createElement('li');
      li.className = 'history-item';
      const date = new Date(entry.timestamp).toLocaleString('pt-BR');
      li.innerHTML = `
        <div class="history-time">${date}</div>
        <div class="history-action">${entry.action}</div>
        <div class="history-detail">${entry.appointmentName}</div>
      `;
      list.appendChild(li);
    });
  }

  // USERS
  function renderUsers(){
    const list = qs('#barber-users-list');
    const count = qs('#user-count');
    if(!list) return;

    const users = getBarberUsers();
    if(count) count.textContent = `(${users.length})`;

    list.innerHTML = '';

    if(users.length === 0){
      const empty = document.createElement('li');
      empty.className = 'history-item';
      empty.textContent = 'Nenhum usuario cadastrado.';
      list.appendChild(empty);
      return;
    }

    users.slice().reverse().forEach((user)=>{
      const li = document.createElement('li');
      li.className = 'history-item user-card';
      const roleLabel = user.role === 'recepcao' ? 'Recepcao' : 'Barbeiro';
      const maskedPassword = user.password ? '*'.repeat(Math.max(4, user.password.length)) : '****';

      li.innerHTML = `
        <div class="user-card-header">
          <div>
            <div class="history-action">${user.name}</div>
            <div class="history-detail">@${user.login}</div>
          </div>
          <div class="user-role">${roleLabel}</div>
        </div>
        <div class="user-card-meta">Senha: ${maskedPassword}</div>
        <div class="user-actions">
          <button class="btn btn-danger" data-user-delete="${user.id}">Remover</button>
        </div>
      `;

      list.appendChild(li);
      li.querySelector('[data-user-delete]')?.addEventListener('click', ()=>{
        if(confirm(`Remover o usuario ${user.name}?`)){
          const updated = getBarberUsers().filter((item)=>item.id !== user.id);
          saveBarberUsers(updated);
          setUserStatus('Usuario removido.', 'success');
          renderUsers();
        }
      });
    });
  }

  function initUsers(){
    const form = qs('#user-form');
    if(!form) return;

    renderUsers();

    form.addEventListener('submit', (event)=>{
      event.preventDefault();

      const name = qs('#user-name')?.value.trim();
      const login = qs('#user-login')?.value.trim().toLowerCase();
      const password = qs('#user-password')?.value;
      const role = qs('#user-role')?.value || 'barbeiro';

      if(!name || !login || !password){
        setUserStatus('Preencha nome, login e senha.', 'error');
        return;
      }

      const users = getBarberUsers();
      if(users.some((user)=>String(user.login || '').toLowerCase() === login)){
        setUserStatus('Ja existe um usuario com esse login.', 'error');
        return;
      }

      users.push({
        id: Date.now(),
        name,
        login,
        password,
        role,
        createdAt: new Date().toISOString()
      });

      saveBarberUsers(users);
      form.reset();
      const roleSelect = qs('#user-role');
      if(roleSelect) roleSelect.value = 'barbeiro';
      setUserStatus('Usuario criado com sucesso.', 'success');
      renderUsers();
    });
  }

  // CONFIGURAÇÕES
  function initSettings(){
    const downloadBtn = qs('#backup-download');
    const uploadBtn = qs('#backup-upload');
    const fileInput = qs('#backup-file');
    const clearBtn = qs('#backup-clear');
    
    downloadBtn?.addEventListener('click', ()=>{
      const data = {
        appointments: getAppointments(),
        history: getHistory(),
        users: getBarberUsers(),
        settings: {
          whatsapp: qs('#setting-whatsapp')?.value,
          email: qs('#setting-email')?.value
        }
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
    });
    
    uploadBtn?.addEventListener('click', ()=>fileInput?.click());
    fileInput?.addEventListener('change', (e)=>{
      const file = e.target.files?.[0];
      if(file){
        const reader = new FileReader();
        reader.onload = (event)=>{
          try{
            const data = JSON.parse(event.target?.result);
            localStorage.setItem('appointments', JSON.stringify(data.appointments || []));
            localStorage.setItem('history', JSON.stringify(data.history || []));
            localStorage.setItem('barberUsers', JSON.stringify(data.users || []));
            alert('Backup restaurado com sucesso!');
            location.reload();
          } catch(err){
            alert('Erro ao restaurar backup');
          }
        };
        reader.readAsText(file);
      }
    });
    
    clearBtn?.addEventListener('click', ()=>{
      if(confirm('ATENÇÃO: Isso deletará TODOS os dados! Tem certeza?')){
        if(confirm('Última confirmação - Isso é irreversível!')){
          localStorage.clear();
          location.reload();
        }
      }
    });
  }

  // INIT
  document.addEventListener('DOMContentLoaded', ()=>{
    // Set year
    qs('#year-admin').textContent = new Date().getFullYear();
    
    initAuth();
    initDarkMode();
    initTabs();
    updateStats();
    renderAppointments();
    initSettings();
    initUsers();
    
    // Filters
    qs('#filter-apply')?.addEventListener('click', ()=>{
      currentFilter = {
        search: qs('#filter-search')?.value || '',
        status: qs('#filter-status')?.value || '',
        dateFrom: qs('#filter-date-from')?.value || '',
        dateTo: qs('#filter-date-to')?.value || ''
      };
      currentPage = 1;
      renderAppointments();
    });
    
    qs('#filter-reset')?.addEventListener('click', ()=>{
      qs('#filter-search').value = '';
      qs('#filter-status').value = '';
      qs('#filter-date-from').value = '';
      qs('#filter-date-to').value = '';
      currentFilter = {search: '', status: '', dateFrom: '', dateTo: ''};
      currentPage = 1;
      renderAppointments();
    });
    
    qs('#filter-sort')?.addEventListener('change', (e)=>{
      currentSort = e.target.value;
      currentPage = 1;
      renderAppointments();
    });
    
    // Batch actions
    qs('#select-all-appts')?.addEventListener('change', (e)=>{
      qsa('.appt-checkbox').forEach(cb=>{
        cb.checked = e.target.checked;
        if(e.target.checked) selectedAppointments.add(parseInt(cb.dataset.id));
        else selectedAppointments.delete(parseInt(cb.dataset.id));
      });
      updateBatchActions();
    });
    
    qs('#batch-done')?.addEventListener('click', ()=>batchAction('done'));
    qs('#batch-cancel')?.addEventListener('click', ()=>batchAction('cancel'));
    qs('#batch-delete')?.addEventListener('click', ()=>{
      if(confirm('Deletar selecionados?')) batchAction('delete');
    });
    
    // Timeline
    qs('#timeline-today')?.addEventListener('click', ()=>{
      qs('#timeline-date').value = new Date().toISOString().slice(0,10);
      renderTimeline();
    });
    
    qs('#timeline-date')?.addEventListener('change', renderTimeline);
    
    // History filters
    qs('#history-filter')?.addEventListener('change', renderHistory);
    qs('#history-date')?.addEventListener('change', renderHistory);
    
    // Export
    qs('#filter-export')?.addEventListener('click', ()=>{
      const appts = getFilteredAndSorted();
      let csv = 'Nome,Telefone,Serviço,Data,Hora,Status\n';
      appts.forEach(a => {
        const service = SERVICES.find(s=>s.id===a.service);
        const status = a.status === 'completed' ? 'Feito' : (a.status === 'cancelled' ? 'Cancelado' : 'Pendente');
        csv += `"${a.name}","${a.phone}","${service?service.name:a.service}","${a.date}","${a.time}","${status}"\n`;
      });
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `agendamentos_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
    });
    
    // Print
    qs('#filter-print')?.addEventListener('click', ()=>{
      const appts = getFilteredAndSorted();
      let html = '<h2>Relatório de Agendamentos</h2>';
      html += `<p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>`;
      html += '<table style="width:100%;border-collapse:collapse;"><tr style="border:1px solid #000;"><th style="border:1px solid #000;padding:8px;">Nome</th><th style="border:1px solid #000;padding:8px;">Tel</th><th style="border:1px solid #000;padding:8px;">Serviço</th><th style="border:1px solid #000;padding:8px;">Data</th><th style="border:1px solid #000;padding:8px;">Hora</th><th style="border:1px solid #000;padding:8px;">Status</th></tr>';
      appts.forEach(a => {
        const service = SERVICES.find(s=>s.id===a.service);
        const status = a.status === 'completed' ? 'Feito' : (a.status === 'cancelled' ? 'Cancelado' : 'Pendente');
        html += `<tr style="border:1px solid #000;"><td style="border:1px solid #000;padding:8px;">${a.name}</td><td style="border:1px solid #000;padding:8px;">${a.phone}</td><td style="border:1px solid #000;padding:8px;">${service?service.name:a.service}</td><td style="border:1px solid #000;padding:8px;">${a.date}</td><td style="border:1px solid #000;padding:8px;">${a.time}</td><td style="border:1px solid #000;padding:8px;">${status}</td></tr>`;
      });
      html += '</table>';
      const win = window.open('', '', 'width=800,height=600');
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 250);
    });
  });
})();
