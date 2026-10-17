/* ===== TaskFlow 看板应用 ===== */
(function () {
    'use strict';

    const STORAGE_KEY = 'taskflow_tasks_v1';
    const COLUMNS = ['todo', 'progress', 'review', 'done'];
    const COLUMN_LABELS = { todo: '待办', progress: '进行中', review: '审核中', done: '已完成' };

    let tasks = [];
    let editingId = null;
    let currentFilter = 'all';
    let searchQuery = '';
    let dragId = null;

    /* ----- 数据持久化 ----- */
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            tasks = raw ? JSON.parse(raw) : [];
        } catch (e) { tasks = []; }
        if (tasks.length === 0) tasks = seedData();
        save();
    }
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

    function seedData() {
        const now = Date.now();
        const day = 86400000;
        return [
            { id: nextId(), title: '设计看板首页原型', desc: '完成 Linear 风格深色主题看板的视觉设计稿', priority: 'high', column: 'done', tags: ['设计', 'UI'], due: now - day * 2, created: now - day * 5 },
            { id: nextId(), title: '搭建项目脚手架', desc: '初始化 HTML/CSS/JS 项目结构', priority: 'medium', column: 'done', tags: ['工程'], due: now - day, created: now - day * 4 },
            { id: nextId(), title: '实现拖拽排序功能', desc: '支持卡片在列间拖拽及列内排序，带动画反馈', priority: 'high', column: 'progress', tags: ['交互', '前端'], due: now + day, created: now - day * 2 },
            { id: nextId(), title: '接入 localStorage 持久化', desc: '任务数据自动保存到本地，刷新不丢失', priority: 'medium', column: 'progress', tags: ['存储'], due: now + day * 2, created: now - day },
            { id: nextId(), title: '编写使用文档', desc: '', priority: 'low', column: 'todo', tags: ['文档'], due: now + day * 5, created: now - day },
            { id: nextId(), title: '修复卡片拖拽闪烁问题', desc: '拖拽过程中偶现的闪烁与位置跳动', priority: 'urgent', column: 'review', tags: ['Bug'], due: now + day * 3, created: now },
            { id: nextId(), title: '添加任务搜索与筛选', desc: '支持按标题搜索、按优先级筛选', priority: 'medium', column: 'todo', tags: ['功能'], due: 0, created: now },
        ];
    }

    let _idCounter = 0;
    function nextId() {
        _idCounter++;
        return 'TF-' + String(_idCounter).padStart(4, '0');
    }

    /* ----- 工具函数 ----- */
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function formatDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }
    function dueStatus(ts) {
        if (!ts) return '';
        const diff = ts - Date.now();
        if (diff < 0) return 'overdue';
        if (diff < 86400000 * 2) return 'soon';
        return '';
    }
    const PRIORITY_LABEL = { urgent: '紧急', high: '高', medium: '中', low: '低' };

    /* ----- 渲染 ----- */
    function render() {
        COLUMNS.forEach(col => {
            const body = document.querySelector(`.column-body[data-column="${col}"]`);
            const count = document.querySelector(`.column[data-column="${col}"] .column-count`);
            let list = tasks.filter(t => t.column === col);
            list = applyFilter(list);
            list = applySearch(list);

            body.innerHTML = '';
            count.textContent = list.length;

            if (list.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'column-empty';
                empty.textContent = searchQuery || currentFilter !== 'all' ? '无匹配任务' : '暂无任务，点击 + 添加';
                body.appendChild(empty);
                return;
            }

            list.forEach(task => body.appendChild(createCard(task)));
        });
        updateStats();
    }

    function applyFilter(list) {
        if (currentFilter === 'all') return list;
        if (currentFilter === 'urgent') return list.filter(t => t.priority === 'urgent');
        if (currentFilter === 'high') return list.filter(t => t.priority === 'high' || t.priority === 'urgent');
        if (currentFilter === 'overdue') return list.filter(t => t.due && t.due < Date.now() && t.column !== 'done');
        return list;
    }
    function applySearch(list) {
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(t =>
            t.title.toLowerCase().includes(q) ||
            (t.desc && t.desc.toLowerCase().includes(q)) ||
            (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
        );
    }

    function createCard(task) {
        const card = document.createElement('div');
        card.className = 'card' + (task.column === 'done' ? ' done' : '');
        card.dataset.id = task.id;
        card.dataset.priority = task.priority;
        card.draggable = true;

        const priorityBar = '<div class="card-priority-bar"></div>';
        const flag = (task.priority === 'urgent' || task.priority === 'high')
            ? `<span class="card-priority-flag ${task.priority}">${task.priority === 'urgent' ? '▲' : '◐'}</span>`
            : '';

        let html = priorityBar;
        html += `<div class="card-top"><div class="card-title">${escapeHtml(task.title)}</div>${flag}</div>`;
        if (task.desc) html += `<div class="card-desc">${escapeHtml(task.desc)}</div>`;
        if (task.tags && task.tags.length) {
            html += '<div class="card-tags">' + task.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('') + '</div>';
        }
        const footerLeft = task.due
            ? `<span class="card-due ${dueStatus(task.due)}"><span class="card-due-icon">◷</span>${formatDate(task.due)}</span>`
            : `<span class="card-id">${task.id}</span>`;
        html += `<div class="card-footer">${footerLeft}<span class="card-id">${task.id}</span></div>`;
        card.innerHTML = html;

        card.addEventListener('click', () => openModal(task.id));
        card.addEventListener('dragstart', onDragStart);
        card.addEventListener('dragend', onDragEnd);

        return card;
    }

    /* ----- 统计 ----- */
    function updateStats() {
        const total = tasks.length;
        const done = tasks.filter(t => t.column === 'done').length;
        const rate = total ? Math.round(done / total * 100) : 0;
        document.getElementById('totalCount').textContent = total;
        document.getElementById('completionRate').textContent = rate + '%';
        document.getElementById('completionBar').style.width = rate + '%';
    }

    /* ----- 拖拽 ----- */
    function onDragStart(e) {
        dragId = e.currentTarget.dataset.id;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragId);
    }
    function onDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.column-body').forEach(b => b.classList.remove('drag-over'));
        dragId = null;
    }

    document.querySelectorAll('.column-body').forEach(body => {
        body.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            body.classList.add('drag-over');
        });
        body.addEventListener('dragleave', e => {
            if (!body.contains(e.relatedTarget)) body.classList.remove('drag-over');
        });
        body.addEventListener('drop', e => {
            e.preventDefault();
            body.classList.remove('drag-over');
            if (!dragId) return;
            const targetCol = body.dataset.column;
            const dragTask = tasks.find(t => t.id === dragId);
            if (!dragTask) return;

            const afterCard = getCardAfterY(body, e.clientY);
            const colTasks = tasks.filter(t => t.column === targetCol && t.id !== dragId);
            if (afterCard) {
                const idx = colTasks.findIndex(t => t.id === afterCard.dataset.id);
                colTasks.splice(idx, 0, dragTask);
            } else {
                colTasks.push(dragTask);
            }
            colTasks.forEach((t, i) => { t.order = i; });
            dragTask.column = targetCol;

            tasks = tasks.filter(t => t.id !== dragId);
            colTasks.forEach(t => tasks.push(t));
            save();
            render();
            showToast('已移动到「' + COLUMN_LABELS[targetCol] + '」');
        });
    });

    function getCardAfterY(container, y) {
        const cards = [...container.querySelectorAll('.card:not(.dragging)')];
        return cards.reduce((closest, card) => {
            const box = card.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, card };
            return closest;
        }, { offset: -Infinity }).card;
    }

    /* ----- 模态框 ----- */
    const modalOverlay = document.getElementById('modalOverlay');
    let modalTags = [];

    function openModal(id) {
        editingId = id || null;
        modalTags = [];
        const task = id ? tasks.find(t => t.id === id) : null;

        document.getElementById('modalTitle').textContent = id ? '编辑任务' : '新建任务';
        document.getElementById('taskTitle').value = task ? task.title : '';
        document.getElementById('taskDesc').value = task ? (task.desc || '') : '';
        document.getElementById('taskDue').value = task && task.due ? new Date(task.due).toISOString().slice(0, 10) : '';

        const priority = task ? task.priority : 'high';
        document.querySelectorAll('.priority-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.priority === priority);
        });

        modalTags = task && task.tags ? [...task.tags] : [];
        renderTags();

        document.getElementById('modalDelete').style.display = id ? 'block' : 'none';
        modalOverlay.classList.add('show');
        setTimeout(() => document.getElementById('taskTitle').focus(), 50);
    }

    function closeModal() {
        modalOverlay.classList.remove('show');
        editingId = null;
        modalTags = [];
    }

    function renderTags() {
        const list = document.getElementById('tagList');
        list.innerHTML = modalTags.map((t, i) =>
            `<span class="tag-chip">${escapeHtml(t)}<span data-i="${i}">×</span></span>`
        ).join('');
        list.querySelectorAll('span[data-i]').forEach(s => {
            s.onclick = () => { modalTags.splice(+s.dataset.i, 1); renderTags(); };
        });
    }

    function saveTask() {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) { showToast('请输入任务标题'); return; }
        const desc = document.getElementById('taskDesc').value.trim();
        const dueStr = document.getElementById('taskDue').value;
        const due = dueStr ? new Date(dueStr).getTime() : 0;
        const priority = document.querySelector('.priority-btn.active').dataset.priority;

        if (editingId) {
            const task = tasks.find(t => t.id === editingId);
            if (task) {
                task.title = title; task.desc = desc; task.due = due;
                task.priority = priority; task.tags = [...modalTags];
            }
            showToast('任务已更新');
        } else {
            const col = modalOverlay.dataset.targetColumn || 'todo';
            tasks.push({
                id: nextId(), title, desc, priority,
                column: col, tags: [...modalTags], due, created: Date.now()
            });
            showToast('任务已创建');
        }
        save();
        render();
        closeModal();
    }

    function deleteTask() {
        if (!editingId) return;
        tasks = tasks.filter(t => t.id !== editingId);
        save();
        render();
        closeModal();
        showToast('任务已删除');
    }

    /* ----- Toast ----- */
    let toastTimer;
    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    /* ----- 事件绑定 ----- */
    document.getElementById('addTaskBtn').onclick = () => { modalOverlay.dataset.targetColumn = 'todo'; openModal(null); };
    document.querySelectorAll('.column-add').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            modalOverlay.dataset.targetColumn = btn.dataset.column;
            openModal(null);
        };
    });

    document.getElementById('modalClose').onclick = closeModal;
    document.getElementById('modalCancel').onclick = closeModal;
    document.getElementById('modalSave').onclick = saveTask;
    document.getElementById('modalDelete').onclick = deleteTask;
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };

    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    document.getElementById('tagInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value.trim();
            if (val && !modalTags.includes(val) && modalTags.length < 6) {
                modalTags.push(val);
                renderTags();
            }
            e.target.value = '';
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('show')) closeModal();
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
            e.preventDefault();
            modalOverlay.dataset.targetColumn = 'todo';
            openModal(null);
        }
    });

    document.getElementById('searchInput').addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        render();
    });

    document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
        item.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            currentFilter = item.dataset.filter;
            document.querySelector('.breadcrumb-current').textContent = item.querySelector('span:nth-child(2)').textContent;
            render();
        };
    });

    /* ----- 启动 ----- */
    load();
    render();
    showToast('TaskFlow 已就绪 · 按 ⌘N 新建任务');
})();