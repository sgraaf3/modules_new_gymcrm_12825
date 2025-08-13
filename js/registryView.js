import { getData, putData, deleteData, getAllData, setUserRole, getUserRole } from '../database.js';
import { showNotification } from './notifications.js';

export async function initRegistryView(showView) { // showView is passed for navigation
    console.log("User Registry View Initialized.");

    const membersList = document.getElementById('membersList');
    const memberForm = document.getElementById('memberForm');
    const memberIdInput = document.getElementById('memberId');
    const memberNameInput = document.getElementById('memberName');
    const memberEmailInput = document.getElementById('memberEmail');
    const memberPhoneInput = document.getElementById('memberPhone');
    const memberJoinDateInput = document.getElementById('memberJoinDate');
    const memberStatusSelect = document.getElementById('memberStatus');
    const memberRoleSelect = document.getElementById('memberRole');
    const clearMemberFormBtn = document.getElementById('clearMemberFormBtn');
    const memberSearchInput = document.getElementById('memberSearchInput');
    const memberFilterStatus = document.getElementById('memberFilterStatus');

    /**
     * Laadt, filtert, zoekt en toont alle leden uit de database.
     */
    async function loadMembers() {
        try {
            let members = await getAllData('registry');
            membersList.innerHTML = '';

            if (members.length === 0) {
                membersList.innerHTML = '<p class="text-gray-400">No users found.</p>';
                return;
            }

            // Apply search and filter
            const searchTerm = memberSearchInput.value.toLowerCase();
            const filterStatus = memberFilterStatus.value;

            members = members.filter(member => {
                const matchesSearch = (member.name && member.name.toLowerCase().includes(searchTerm)) ||
                                      (member.email && member.email.toLowerCase().includes(searchTerm));
                const matchesStatus = filterStatus === '' || (member.status && member.status === filterStatus);
                return matchesSearch && matchesStatus;
            });

            members.sort((a, b) => {
                // Sort by join date descending, then by name ascending
                const dateA = new Date(a.joinDate || 0); // Use 0 for invalid dates to push them to the beginning
                const dateB = new Date(b.joinDate || 0);
                if (dateB.getTime() !== dateA.getTime()) {
                    return dateB.getTime() - dateA.getTime();
                }
                return (a.name || '').localeCompare(b.name || '');
            });

            if (members.length === 0) {
                membersList.innerHTML = '<p class="text-gray-400">No matching users found.</p>';
                return;
            }

            for (const member of members) {
                const role = await getUserRole(member.id) || 'member'; // Get user role
                const memberCard = document.createElement('div');
                memberCard.className = 'data-card';
                memberCard.innerHTML = `
                    <div class="card-header"><h3>${member.name || 'N/A'}</h3></div>
                    <div class="sub-value">Email: ${member.email || 'N/A'}</div>
                    <div class="sub-value">Phone: ${member.phone || 'N/A'}</div>
                    <div class="sub-value">Joined: ${member.joinDate ? new Date(member.joinDate).toLocaleDateString() : 'N/A'}</div>
                    <div class="sub-value">Status: ${member.status || 'N/A'}</div>
                    <div class="sub-value">Role: ${role}</div>
                    <div class="flex justify-end mt-2">
                        <button class="text-green-400 hover:text-green-300 text-sm mr-2" data-action="view-profile" data-id="${member.id}">View Profile</button>
                        <button class="text-blue-400 hover:text-blue-300 text-sm mr-2" data-action="edit-member" data-id="${member.id}">Edit</button>
                        <button class="text-red-400 hover:text-red-300 text-sm" data-action="delete-member" data-id="${member.id}">Delete</button>
                    </div>
                `;
                membersList.appendChild(memberCard);
            }

            // Voeg event listeners toe voor bewerk/verwijder/view knoppen
            membersList.querySelectorAll('[data-action="edit-member"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const memberId = parseInt(event.target.dataset.id);
                    const member = await getData('registry', memberId);
                    if (member) {
                        memberIdInput.value = member.id;
                        memberNameInput.value = member.name || '';
                        memberEmailInput.value = member.email || '';
                        memberPhoneInput.value = member.phone || '';
                        memberJoinDateInput.value = member.joinDate || '';
                        memberStatusSelect.value = member.status || 'Active';
                        memberRoleSelect.value = await getUserRole(member.id) || 'member';
                        showNotification('User loaded for editing.', 'info');
                    }
                });
            });

            membersList.querySelectorAll('[data-action="delete-member"]').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const memberId = parseInt(event.target.dataset.id);
                    // For now using confirm, ideally replaced by custom modal
                    if (confirm('Are you sure you want to delete this user?')) {
                        try {
                            await deleteData('registry', memberId); // Delete from registry
                            await deleteData('userRoles', memberId); // Delete associated role
                            // Optionally, delete other user-specific data from other stores here
                            showNotification('User deleted!', 'success');
                            loadMembers(); // Reload the list
                        } catch (error) {
                            console.error("Error deleting user:", error);
                            showNotification('Error deleting user.', 'error');
                        }
                    }
                });
            });

            membersList.querySelectorAll('[data-action="view-profile"]').forEach(button => {
                button.addEventListener('click', (event) => {
                    const memberId = event.target.dataset.id;
                    if (showView) {
                        showView('memberSpecificprogressView', { userId: memberId }); // Navigate to specific progress view
                    } else {
                        showNotification('Navigation function (showView) not available.', 'error');
                    }
                });
            });

        } catch (error) {
            console.error("Error loading users:", error);
            showNotification("Error loading users.", "error");
        }
    }

    // Event listener for the member form submission (add/edit)
    if (memberForm) {
        memberForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const memberData = {
                id: memberIdInput.value ? parseInt(memberIdInput.value) : undefined, // Use undefined for autoIncrement
                name: memberNameInput.value,
                email: memberEmailInput.value,
                phone: memberPhoneInput.value,
                joinDate: memberJoinDateInput.value,
                status: memberStatusSelect.value
            };

            const role = memberRoleSelect.value;

            try {
                // Save member data to 'registry' store
                const savedMemberId = await putData('registry', memberData);
                // Set user role (use savedMemberId for new users, or existing ID for edits)
                await setUserRole(savedMemberId || memberData.id, role);

                showNotification('User saved!', 'success');
                memberForm.reset();
                memberIdInput.value = ''; // Clear hidden ID
                loadMembers(); // Reload the list
            } catch (error) {
                console.error("Error saving user:", error);
                showNotification('Error saving user.', 'error');
            }
        });
    }

    // Event listener for the "Clear Form" button
    if (clearMemberFormBtn) {
        clearMemberFormBtn.addEventListener('click', () => {
            memberForm.reset();
            memberIdInput.value = ''; // Clear hidden ID
            showNotification('Form cleared.', 'info');
        });
    }

    // Event listeners for search and filter
    if (memberSearchInput) {
        memberSearchInput.addEventListener('input', loadMembers);
    }
    if (memberFilterStatus) {
        memberFilterStatus.addEventListener('change', loadMembers);
    }

    // Initial load of members when the view is initialized
    await loadMembers();
}
