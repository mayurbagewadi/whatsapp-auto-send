/**
 * Users Management Page
 * Handles user CRUD operations, search, filtering
 */

let currentPage = 1;
const USERS_PER_PAGE = 20;
let allUsers = [];
let filteredUsers = [];
let editingUserId = null;

export async function initUsers(adminAPI) {
  try {
    // Load all users
    await loadUsers(adminAPI);

    // Setup event listeners
    setupUserEventListeners(adminAPI);

  } catch (error) {
    console.error('Users init error:', error);
    showUserError('Failed to load users');
  }
}

async function loadUsers(adminAPI) {
  try {
    const response = await adminAPI.getAllUsers(1, 1000);
    allUsers = Array.isArray(response) ? response : (response?.users || []);
    filteredUsers = [...allUsers];
    displayUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    showUserError('Failed to load users from database');
  }
}

function displayUsers() {
  const tbody = document.getElementById('usersTableBody');
  const startIdx = (currentPage - 1) * USERS_PER_PAGE;
  const endIdx = startIdx + USERS_PER_PAGE;
  const pageUsers = filteredUsers.slice(startIdx, endIdx);

  if (pageUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found</td></tr>';
    document.getElementById('usersPagination').style.display = 'none';
    return;
  }

  const html = pageUsers.map(user => `
    <tr>
      <td>${user.email}</td>
      <td>${user.phone || '-'}</td>
      <td>${user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free'}</td>
      <td>
        <span class="status-badge ${user.status || 'active'}">
          ${user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Active'}
        </span>
      </td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm" onclick="editUser('${user.id}')">Edit</button>
          ${user.status === 'suspended'
            ? `<button class="btn btn-sm btn-success" onclick="unsuspendUser('${user.id}')">Unsuspend</button>`
            : `<button class="btn btn-sm btn-warning" onclick="suspendUserConfirm('${user.id}')">Suspend</button>`
          }
          <button class="btn btn-sm btn-danger" onclick="deleteUserConfirm('${user.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = html;

  // Show pagination if needed
  if (filteredUsers.length > USERS_PER_PAGE) {
    document.getElementById('usersPagination').style.display = 'flex';
    updatePagination();
  } else {
    document.getElementById('usersPagination').style.display = 'none';
  }
}

function updatePagination() {
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage === totalPages;
}

function setupUserEventListeners(adminAPI) {
  // Create user button
  document.getElementById('createUserBtn')?.addEventListener('click', () => {
    editingUserId = null;
    openUserModal('Create User');
  });

  // Search users
  document.getElementById('userSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    filteredUsers = allUsers.filter(user =>
      user.email.toLowerCase().includes(query) ||
      (user.phone && user.phone.toLowerCase().includes(query))
    );
    currentPage = 1;
    displayUsers();
  });

  // Filter by status
  document.getElementById('userStatusFilter')?.addEventListener('change', (e) => {
    const status = e.target.value;
    filteredUsers = allUsers.filter(user => {
      if (!status) return true;
      return user.status === status;
    });
    currentPage = 1;
    displayUsers();
  });

  // Pagination
  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      displayUsers();
      window.scrollTo(0, 0);
    }
  });

  document.getElementById('nextPage')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      displayUsers();
      window.scrollTo(0, 0);
    }
  });

  // User form submit
  document.getElementById('userForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveUser(adminAPI);
  });
}

function openUserModal(title) {
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  const titleEl = document.getElementById('userModalTitle');

  titleEl.textContent = title;
  form.reset();

  if (editingUserId) {
    const user = allUsers.find(u => u.id === editingUserId);
    if (user) {
      document.getElementById('userEmail').value = user.email;
      document.getElementById('userName').value = user.phone || '';
      document.getElementById('userActive').checked = user.status === 'active';
      const planSelect = document.getElementById('userPlan');
      if (planSelect) planSelect.value = user.plan || '';
    }
  }

  modal.style.display = 'flex';
}

async function saveUser(adminAPI) {
  const email = document.getElementById('userEmail').value;
  const phone = document.getElementById('userName').value;
  const isActive = document.getElementById('userActive').checked;
  const plan = document.getElementById('userPlan')?.value || null;

  try {
    if (editingUserId) {
      // Update user
      const updates = {
        email,
        phone: phone || null,
        status: isActive ? 'active' : 'suspended'
      };
      if (plan) updates.plan = plan;
      await adminAPI.updateUser(editingUserId, updates);
      showUserSuccess('User updated successfully');
    } else {
      // Create user
      await adminAPI.createUser({
        email,
        phone: phone || null,
        status: isActive ? 'active' : 'suspended'
      });
      showUserSuccess('User created successfully');
    }

    document.getElementById('userModal').style.display = 'none';
    await loadUsers(adminAPI);
  } catch (error) {
    console.error('Error saving user:', error);
    showUserError('Failed to save user: ' + error.message);
  }
}

async function editUser(userId) {
  editingUserId = userId;
  openUserModal('Edit User');
}

async function suspendUserConfirm(userId) {
  if (confirm('Are you sure you want to suspend this user?')) {
    try {
      const adminAPI = window.adminAPI;
      await adminAPI.suspendUser(userId, 'Suspended by admin');
      showUserSuccess('User suspended');
      await loadUsers(adminAPI);
    } catch (error) {
      showUserError('Failed to suspend user: ' + error.message);
    }
  }
}

async function unsuspendUser(userId) {
  try {
    const adminAPI = window.adminAPI;
    await adminAPI.unsuspendUser(userId);
    showUserSuccess('User unsuspended');
    await loadUsers(adminAPI);
  } catch (error) {
    showUserError('Failed to unsuspend user: ' + error.message);
  }
}

async function deleteUserConfirm(userId) {
  if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
    try {
      const adminAPI = window.adminAPI;
      await adminAPI.deleteUser(userId);
      showUserSuccess('User deleted');
      await loadUsers(adminAPI);
    } catch (error) {
      showUserError('Failed to delete user: ' + error.message);
    }
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function showUserSuccess(message) {
  console.log('✓ ' + message);
  window.showToast?.(message, 'success');
}

function showUserError(message) {
  console.error('✗ ' + message);
  window.showToast?.(message, 'error');
}

// Make functions globally available
window.editUser = editUser;
window.suspendUserConfirm = suspendUserConfirm;
window.unsuspendUser = unsuspendUser;
window.deleteUserConfirm = deleteUserConfirm;
