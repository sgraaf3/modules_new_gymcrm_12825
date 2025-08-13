import { getData, putData, deleteData, getAllData } from '../database.js';
import { showNotification } from './notifications.js';

const allPermissions = [
    'view_dashboard', 'manage_users', 'view_reports', 'manage_schedules', 
    'manage_subscriptions', 'manage_finances', 'view_logs', 'manage_settings'
];

export async function initPermissionsView() {
    console.log("Permissions View Initialized.");

    const roleForm = document.getElementById('roleForm');
    const roleIdInput = document.getElementById('roleId');
    const roleNameInput = document.getElementById('roleName');
    const permissionsCheckboxes = document.getElementById('permissionsCheckboxes');
    const rolesTableContainer = document.getElementById('rolesTableContainer');
    const clearRoleFormBtn = document.getElementById('clearRoleFormBtn');

    function renderPermissionsCheckboxes() {
        permissionsCheckboxes.innerHTML = '';
        allPermissions.forEach(permission => {
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'flex items-center';
            checkboxContainer.innerHTML = `
                <input type="checkbox" id="perm_${permission}" name="${permission}" class="form-checkbox h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500">
                <label for="perm_${permission}" class="ml-2 text-gray-300">${permission.replace('_', ' ')}</label>
            `;
            permissionsCheckboxes.appendChild(checkboxContainer);
        });
    }

    async function loadRoles() {
        try {
            const roles = await getAllData('roles');
            rolesTableContainer.innerHTML = '';

            if (roles.length === 0) {
                rolesTableContainer.innerHTML = '<p class="text-gray-400">No roles found.</p>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'min-w-full bg-gray-800';
            table.innerHTML = `
                <thead class="bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Permissions</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-700"></tbody>
            `;

            const tbody = table.querySelector('tbody');
            roles.forEach(role => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${role.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${role.permissions.join(', ')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="text-blue-400 hover:text-blue-300" data-action="edit-role" data-id="${role.id}">Edit</button>
                        <button class="text-red-400 hover:text-red-300 ml-4" data-action="delete-role" data-id="${role.id}">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            rolesTableContainer.appendChild(table);

            rolesTableContainer.querySelectorAll('[data-action="edit-role"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const roleId = parseInt(event.target.dataset.id);
                    const role = await getData('roles', roleId);
                    if (role) {
                        roleIdInput.value = role.id;
                        roleNameInput.value = role.name;
                        document.querySelectorAll('#permissionsCheckboxes input[type="checkbox"]').forEach(checkbox => {
                            checkbox.checked = role.permissions.includes(checkbox.name);
                        });
                    }
                });
            });

            rolesTableContainer.querySelectorAll('[data-action="delete-role"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const roleId = parseInt(event.target.dataset.id);
                    if (confirm('Are you sure you want to delete this role?')) {
                        try {
                            await deleteData('roles', roleId);
                            showNotification('Role deleted!', 'success');
                            loadRoles();
                        } catch (error) {
                            console.error("Error deleting role:", error);
                            showNotification('Error deleting role.', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Error loading roles:", error);
            showNotification("Error loading roles.", "error");
        }
    }

    if (roleForm) {
        roleForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const selectedPermissions = [];
            document.querySelectorAll('#permissionsCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
                selectedPermissions.push(checkbox.name);
            });

            const role = {
                id: roleIdInput.value ? parseInt(roleIdInput.value) : undefined,
                name: roleNameInput.value,
                permissions: selectedPermissions
            };

            try {
                await putData('roles', role);
                showNotification('Role saved!', 'success');
                roleForm.reset();
                roleIdInput.value = '';
                loadRoles();
            } catch (error) {
                console.error("Error saving role:", error);
                showNotification('Error saving role.', 'error');
            }
        });
    }

    if (clearRoleFormBtn) {
        clearRoleFormBtn.addEventListener('click', () => {
            roleForm.reset();
            roleIdInput.value = '';
            showNotification('Form cleared.', 'info');
        });
    }

    renderPermissionsCheckboxes();
    await loadRoles();
}
