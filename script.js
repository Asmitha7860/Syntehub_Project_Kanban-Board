(() => {
  'use strict';
  const STORAGE_KEY = 'taskflow-pro-tasks-v1';
  const THEME_KEY = 'taskflow-pro-theme-v1';
  const statusNames = {todo:'To Do', doing:'In Progress', done:'Done'};
  const $ = (selector) => document.querySelector(selector);
  const board = $('#board');
  const form = $('#taskForm');
  const backdrop = $('#modalBackdrop');
  let editingId = null;
  let draggedId = null;
  let toastTimer;
  let tasks = loadTasks();

  function makeId(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function dateOffset(days){ const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function loadTasks(){
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved)) return saved.filter(t => t && t.id && typeof t.title === 'string' && statusNames[t.status]);
    } catch (error) { console.warn('Could not load saved tasks:', error); }
    return [
      {id:makeId(),title:'Plan my week',description:'Choose the three most important things to finish.',status:'todo',priority:'high',dueDate:dateOffset(1),createdAt:Date.now()-3000},
      {id:makeId(),title:'Practice JavaScript',description:'Spend 30 minutes learning array methods.',status:'todo',priority:'medium',dueDate:dateOffset(2),createdAt:Date.now()-2000},
      {id:makeId(),title:'Update my portfolio',description:'Polish the project section and check mobile layout.',status:'doing',priority:'high',dueDate:dateOffset(0),createdAt:Date.now()-1000},
      {id:makeId(),title:'Set up my workspace',description:'Organize folders and prepare the tools I need.',status:'done',priority:'low',dueDate:'',createdAt:Date.now()}
    ];
  }
  function saveTasks(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch(error) { showToast('Unable to save. Check your browser storage settings.'); console.error(error); } }
  function escapeHTML(value){ return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function formatDate(date){ if(!date) return 'No due date'; const parsed = new Date(`${date}T00:00:00`); return parsed.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
  function isOverdue(task){ return Boolean(task.dueDate && task.status !== 'done' && task.dueDate < dateOffset(0)); }
  function taskMatches(task){ const query = $('#searchInput').value.trim().toLowerCase(); const priority = $('#priorityFilter').value; const text = `${task.title} ${task.description}`.toLowerCase(); return (!query || text.includes(query)) && (priority === 'all' || task.priority === priority); }
  function render(){
    ['todo','doing','done'].forEach(status => {
      const list = $(`#list-${status}`);
      const filtered = tasks.filter(t => t.status === status && taskMatches(t)).sort((a,b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (b.createdAt||0)-(a.createdAt||0));
      $(`#count-${status}`).textContent = tasks.filter(t => t.status === status).length;
      if (!filtered.length) {
        const hasFilter = $('#searchInput').value.trim() || $('#priorityFilter').value !== 'all';
        list.innerHTML = `<div class="empty"><strong>${hasFilter ? '⌕' : '＋'}</strong>${hasFilter ? 'No matching tasks found.' : status === 'done' ? 'Completed tasks will appear here.' : 'Nothing here yet. Add a task or drag one in.'}</div>`;
        return;
      }
      list.innerHTML = filtered.map(task => {
        const overdue = isOverdue(task);
        return `<article class="task-card" draggable="true" data-id="${escapeHTML(task.id)}" tabindex="0" aria-label="${escapeHTML(task.title)}. Drag to change status">
          <div class="task-meta"><span class="priority ${escapeHTML(task.priority)}">${escapeHTML(task.priority)} priority</span><button class="mini-btn" data-action="edit" data-id="${escapeHTML(task.id)}" aria-label="Edit ${escapeHTML(task.title)}" title="Edit task">✎</button></div>
          <h3 class="task-title">${escapeHTML(task.title)}</h3>
          ${task.description ? `<p class="task-desc">${escapeHTML(task.description)}</p>` : ''}
          <div class="task-footer"><span class="due ${overdue?'overdue':''}" title="Due date">${overdue?'⚠':'◷'} ${escapeHTML(formatDate(task.dueDate))}${overdue?' · Overdue':''}</span><div class="card-actions"><button class="mini-btn" data-action="move" data-id="${escapeHTML(task.id)}" title="Move task to next column" aria-label="Move ${escapeHTML(task.title)} to next status">↗</button><button class="mini-btn" data-action="delete" data-id="${escapeHTML(task.id)}" title="Delete task" aria-label="Delete ${escapeHTML(task.title)}">⌫</button></div></div>
        </article>`;
      }).join('');
    });
    const total = tasks.length, doing = tasks.filter(t=>t.status==='doing').length, done = tasks.filter(t=>t.status==='done').length, overdue = tasks.filter(isOverdue).length;
    $('#totalStat').textContent = total; $('#doingStat').textContent = doing; $('#doneStat').textContent = done; $('#overdueStat').textContent = overdue;
    const percent = total ? Math.round(done/total*100) : 0; $('#progressFill').style.width = `${percent}%`; $('#doneFoot').textContent = `${percent}% of all tasks completed`;
  }
  function openModal(status='todo', task=null){
    editingId = task ? task.id : null;
    $('#modalTitle').textContent = task ? 'Edit task' : 'Create a task';
    $('#saveTaskBtn').textContent = task ? 'Save changes' : 'Save task';
    $('#taskTitle').value = task?.title || '';
    $('#taskDescription').value = task?.description || '';
    $('#taskStatus').value = task?.status || status;
    $('#taskPriority').value = task?.priority || 'medium';
    $('#taskDue').value = task?.dueDate || '';
    backdrop.classList.add('open'); document.body.style.overflow='hidden';
    setTimeout(()=>$('#taskTitle').focus(),50);
  }
  function closeModal(){ backdrop.classList.remove('open'); document.body.style.overflow=''; form.reset(); editingId=null; }
  function showToast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2500); }
  function moveTask(id){ const task=tasks.find(t=>t.id===id); if(!task)return; const next={todo:'doing',doing:'done',done:'todo'}[task.status]; task.status=next; saveTasks(); render(); showToast(`Moved to ${statusNames[next]}`); }

  $('#todayLabel').textContent = '📅 ' + new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  $('#topAddBtn').addEventListener('click',()=>openModal());
  document.querySelectorAll('.add-column-task').forEach(btn=>btn.addEventListener('click',()=>openModal(btn.dataset.status)));
  $('#closeModal').addEventListener('click',closeModal); $('#cancelModal').addEventListener('click',closeModal);
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop.classList.contains('open'))closeModal();});
  form.addEventListener('submit',e=>{
    e.preventDefault(); const title=$('#taskTitle').value.trim(); if(!title){$('#taskTitle').focus();return;}
    const data={title,description:$('#taskDescription').value.trim(),status:$('#taskStatus').value,priority:$('#taskPriority').value,dueDate:$('#taskDue').value};
    if(editingId){ const task=tasks.find(t=>t.id===editingId); if(task)Object.assign(task,data); showToast('Task updated successfully'); }
    else { tasks.unshift({id:makeId(),...data,createdAt:Date.now()}); showToast('New task added'); }
    saveTasks(); render(); closeModal();
  });
  board.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-action]'); if(!btn)return; const task=tasks.find(t=>t.id===btn.dataset.id); if(!task)return;
    if(btn.dataset.action==='edit')openModal(task.status,task);
    if(btn.dataset.action==='delete'){ if(confirm(`Delete “${task.title}”?`)){tasks=tasks.filter(t=>t.id!==task.id);saveTasks();render();showToast('Task deleted');} }
    if(btn.dataset.action==='move')moveTask(task.id);
  });
  board.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.task-card')){e.preventDefault();const task=tasks.find(t=>t.id===e.target.dataset.id);if(task)openModal(task.status,task);}});
  board.addEventListener('dragstart',e=>{const card=e.target.closest('.task-card');if(!card)return;draggedId=card.dataset.id;card.classList.add('dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedId);}});
  board.addEventListener('dragend',e=>{const card=e.target.closest('.task-card');if(card)card.classList.remove('dragging');document.querySelectorAll('.column').forEach(c=>c.classList.remove('drag-over'));draggedId=null;});
  document.querySelectorAll('.column').forEach(column=>{
    column.addEventListener('dragover',e=>{e.preventDefault();column.classList.add('drag-over');if(e.dataTransfer)e.dataTransfer.dropEffect='move';});
    column.addEventListener('dragleave',e=>{if(!column.contains(e.relatedTarget))column.classList.remove('drag-over');});
    column.addEventListener('drop',e=>{e.preventDefault();column.classList.remove('drag-over');const id=draggedId||(e.dataTransfer&&e.dataTransfer.getData('text/plain'));const task=tasks.find(t=>t.id===id);const next=column.dataset.status;if(task&&next&&task.status!==next){task.status=next;saveTasks();render();showToast(`Moved to ${statusNames[next]}`);}});
  });
  $('#searchInput').addEventListener('input',render); $('#priorityFilter').addEventListener('change',render);
  $('#clearSearchBtn').addEventListener('click',()=>{$('#searchInput').value='';$('#priorityFilter').value='all';render();});
  function applyTheme(theme){document.body.classList.toggle('dark',theme==='dark');$('#themeBtn').textContent=theme==='dark'?'☀':'☾';$('#themeBtn').title=theme==='dark'?'Switch to light mode':'Switch to dark mode';}
  let theme='light';try{theme=localStorage.getItem(THEME_KEY)||'light';}catch(e){}applyTheme(theme);
  $('#themeBtn').addEventListener('click',()=>{theme=document.body.classList.contains('dark')?'light':'dark';applyTheme(theme);try{localStorage.setItem(THEME_KEY,theme);}catch(e){};});
  saveTasks(); render();
})();
