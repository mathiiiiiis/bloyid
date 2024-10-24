let currentServer = null;
let currentChannel = null;
let messagePollingInterval = null;
let currentServerData = null;
let unsavedChanges = false;

document.getElementById('create-server-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    
    fetch('php/create_server.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            location.reload();
        } else {
            alert(data.message);
        }
    })
    .catch(error => console.error('Error:', error));
});

function hideModal() {
    document.getElementById('create-server-modal').style.display = 'none';
}

function showCreateServer() {
    document.getElementById('create-server-modal').style.display = 'flex';
}

function switchServer(serverId) {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    
    currentServer = serverId;
    
    document.querySelectorAll('.server-icon').forEach(icon => {
        icon.classList.remove('active');
    });
    
    const clickedServer = document.querySelector(`.server-icon[data-server-id="${serverId}"]`);
    if (clickedServer) {
        clickedServer.classList.add('active');
    }
    
    fetch(`php/get_server_details.php?server_id=${serverId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('current-server').textContent = data.server.name;
            
            if (data.server.banner_url) {
                document.querySelector('.main-content').style.backgroundImage = `url(${data.server.banner_url})`;
            }
            
            const channelsList = document.getElementById('channels-list');
            channelsList.innerHTML = '';
            
            data.channels.forEach(channel => {
                const channelDiv = document.createElement('div');
                channelDiv.className = 'channel-item';
                channelDiv.setAttribute('data-channel-id', channel.id);
                channelDiv.innerHTML = `
                    <i class="fas fa-hashtag"></i>
                    <span>${channel.name}</span>
                `;
                channelDiv.onclick = () => switchChannel(channel.id);
                channelsList.appendChild(channelDiv);
            });
            
            const membersList = document.querySelector('.friends-sidebar');
            if (membersList && data.members) {
                membersList.innerHTML = '<h3>Members</h3>';
                
                const onlineMembers = data.members.filter(m => m.status === 'online');
                const offlineMembers = data.members.filter(m => m.status === 'offline');
                
                membersList.innerHTML += `<div class="members-category">Online - ${onlineMembers.length}</div>`;
                onlineMembers.forEach(member => {
                    membersList.innerHTML += `
                        <div class="member-item">
                            <div class="user-avatar"></div>
                            <div>
                                <div class="member-name">${member.username}</div>
                                <div class="member-role">${member.role}</div>
                            </div>
                            <div class="status-indicator online"></div>
                        </div>
                    `;
                });
                
                membersList.innerHTML += `<div class="members-category">Offline - ${offlineMembers.length}</div>`;
                offlineMembers.forEach(member => {
                    membersList.innerHTML += `
                        <div class="member-item">
                            <div class="user-avatar"></div>
                            <div>
                                <div class="member-name">${member.username}</div>
                                <div class="member-role">${member.role}</div>
                            </div>
                            <div class="status-indicator offline"></div>
                        </div>
                    `;
                });
            }
            
            if (data.channels.length > 0) {
                switchChannel(data.channels[0].id);
            }
        })
        .catch(error => console.error('Error fetching server details:', error));
}

function switchChannel(channelId) {
    currentChannel = channelId;
    
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
    
    document.querySelectorAll('.channel-item').forEach(channel => {
        channel.classList.remove('active');
    });
    
    const selectedChannel = document.querySelector(`.channel-item[data-channel-id="${channelId}"]`);
    if (selectedChannel) {
        selectedChannel.classList.add('active');
    }
    
    loadMessages();
    messagePollingInterval = setInterval(loadMessages, 3000);
}

function loadMessages() {
    if (!currentChannel) return;
    
    fetch(`php/get_channel_messages.php?channel_id=${currentChannel}`)
        .then(response => response.json())
        .then(data => {
            const chatArea = document.getElementById('chat-area');
            chatArea.innerHTML = data.messages.map(message => `
                <div class="message">
                    <div class="message-header">
                        <div class="message-username">${message.username}</div>
                        <div class="message-timestamp">${message.timestamp}</div>
                    </div>
                    <div class="message-content">${message.content}</div>
                </div>
            `).join('');
            
            chatArea.scrollTop = chatArea.scrollHeight;
        })
        .catch(error => console.error('Error loading messages:', error));
}

document.getElementById('message-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const content = this.value.trim();
        
        if (content && currentChannel) {
            sendMessage(content);
            this.value = '';
        }
    }
});

document.getElementById('message-input').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

function sendMessage(content) {
    fetch('php/send_message.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            channel_id: currentChannel,
            content: content
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            loadMessages();
        } else {
            console.error('Error sending message:', data.message);
        }
    })
    .catch(error => console.error('Error:', error));
}

document.addEventListener('DOMContentLoaded', function() {
    const firstServer = document.querySelector('.server-icon:not(.create-server)');
    if (firstServer) {
        firstServer.click();
    }
});

function showServerSettings(serverId) {
    currentServer = serverId;
    loadServerData();
    document.getElementById('server-settings-modal').style.display = 'block';
}

function hideModal(modalId) {
    if (unsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
            return;
        }
    }
    document.getElementById(modalId).style.display = 'none';
    unsavedChanges = false;
}

async function loadServerData() {
    try {
        const response = await fetch(`php/get_server.php?id=${currentServer}`);
        if (!response.ok) throw new Error('Failed to fetch server data');
        
        currentServerData = await response.json();
        
        document.getElementById('server_name').value = currentServerData.name;
        document.getElementById('description').value = currentServerData.description;
        
        updateImagePreview('icon-preview', currentServerData.icon_url);
        updateImagePreview('banner-preview', currentServerData.banner_url);
    
        document.getElementById('server-name-confirm').textContent = currentServerData.name;
        
        await Promise.all([
            loadChannels(),
            loadMembers(),
            loadRoles()
        ]);
        
    } catch (error) {
        showError('Failed to load server data');
        console.error('Error loading server data:', error);
    }
}

function updateImagePreview(previewId, imageUrl) {
    const preview = document.getElementById(previewId);
    const removeButton = preview.parentElement.querySelector('.remove-button');
    
    if (imageUrl) {
        preview.style.backgroundImage = `url(${imageUrl})`;
        removeButton.hidden = false;
    } else {
        preview.style.backgroundImage = '';
        removeButton.hidden = true;
    }
}

function setupImageUpload(inputId, previewId, type) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const removeButton = preview.parentElement.querySelector('.remove-button');
    
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.style.backgroundImage = `url(${e.target.result})`;
                removeButton.hidden = false;
                unsavedChanges = true;
            };
            reader.readAsDataURL(file);
        }
    });
    
    removeButton.addEventListener('click', function() {
        input.value = '';
        preview.style.backgroundImage = '';
        removeButton.hidden = true;
        unsavedChanges = true;
    });
}

function setupTabs() {
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.settings-nav-item').forEach(i => {
                i.classList.remove('active');
            });
            document.querySelectorAll('.settings-tab').forEach(t => {
                t.classList.remove('active');
            });
            
            this.classList.add('active');
            const tabId = `${this.dataset.tab}-tab`;
            document.getElementById(tabId).classList.add('active');
        });
    });
}

async function saveServerSettings(formData) {
    try {
        const response = await fetch('php/update_server.php', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Failed to update server');
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('Server settings updated successfully');
            unsavedChanges = false;
            await loadServerData();
            updateUIElements(formData.get('server_name'));
        } else {
            throw new Error(result.message || 'Failed to update server');
        }
    } catch (error) {
        showError(error.message);
        console.error('Error saving server settings:', error);
        throw error;
    }
}

function updateUIElements(serverName) {
    document.querySelectorAll('.server-name').forEach(el => {
        el.textContent = serverName;
    });
}

function showCreateChannel() {
    document.getElementById('create-channel-modal').style.display = 'block';
}

async function loadChannels() {
    try {
        const response = await fetch(`php/get_server_channels.php?server_id=${currentServer}`);
        if (!response.ok) throw new Error('Failed to fetch channels');
        
        const channels = await response.json();
        const container = document.querySelector('.channels-list-settings');
        container.innerHTML = '';
        
        channels.forEach(channel => {
            const channelEl = createChannelElement(channel);
            container.appendChild(channelEl);
        });
    } catch (error) {
        showError('Failed to load channels');
        console.error('Error loading channels:', error);
    }
}

function createChannelElement(channel) {
    const div = document.createElement('div');
    div.className = 'channel-item';
    div.innerHTML = `
        <i class="fas fa-${channel.type === 'text' ? 'hashtag' : 'volume-up'}"></i>
        <span>${channel.name}</span>
        <div class="channel-actions">
            <button onclick="editChannel(${channel.id})">
                <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteChannel(${channel.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    return div;
}

async function loadMembers() {
    try {
        const response = await fetch(`php/get_server_members.php?server_id=${currentServer}`);
        if (!response.ok) throw new Error('Failed to fetch members');
        
        const members = await response.json();
        const container = document.querySelector('.members-list-settings');
        container.innerHTML = '';
        
        members.forEach(member => {
            const memberEl = createMemberElement(member);
            container.appendChild(memberEl);
        });
    } catch (error) {
        showError('Failed to load members');
        console.error('Error loading members:', error);
    }
}

function createMemberElement(member) {
    const div = document.createElement('div');
    div.className = 'member-item';
    div.innerHTML = `
        <img src="${member.avatar_url || 'default_avatar.png'}" alt="${member.username}">
        <div class="member-info">
            <span class="member-name">${member.username}</span>
            <span class="member-role">${member.role}</span>
        </div>
        <div class="member-actions">
            <button onclick="changeMemberRole(${member.id})">
                <i class="fas fa-user-shield"></i>
            </button>
            <button onclick="kickMember(${member.id})">
                <i class="fas fa-door-open"></i>
            </button>
            <button onclick="banMember(${member.id})">
                <i class="fas fa-ban"></i>
            </button>
        </div>
    `;
    return div;
}

function setupDeleteConfirmation() {
    const confirmInput = document.getElementById('delete-confirmation');
    const deleteButton = document.getElementById('delete-server-btn');
    const serverName = currentServerData?.name || '';
    
    confirmInput.addEventListener('input', function() {
        deleteButton.disabled = this.value !== serverName;
    });
    
    deleteButton.addEventListener('click', async function() {
        if (!confirm('Are you absolutely sure? This action cannot be undone!')) {
            return;
        }
        
        try {
            const response = await fetch('php/delete_server.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ server_id: currentServer })
            });
            
            if (!response.ok) throw new Error('Failed to delete server');
            
            const result = await response.json();
            
            if (result.success) {
                window.location.reload();
            } else {
                throw new Error(result.message || 'Failed to delete server');
            }
        } catch (error) {
            showError(error.message);
            console.error('Error deleting server:', error);
        }
    });
}

function showSuccess(message) {
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success';
    successAlert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        background-color: #4CAF50;
        color: white;
        border-radius: 4px;
        z-index: 1000;
        animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
    `;
    successAlert.textContent = message;
    document.body.appendChild(successAlert);
    
    setTimeout(() => {
        successAlert.remove();
    }, 3000);
}

function showError(message) {
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-error';
    errorAlert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        background-color: #f44336;
        color: white;
        border-radius: 4px;
        z-index: 1000;
        animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
    `;
    errorAlert.textContent = message;
    document.body.appendChild(errorAlert);
    
    setTimeout(() => {
        errorAlert.remove();
    }, 3000);
}

document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    
    setupImageUpload('icon-upload', 'icon-preview', 'icon');
    setupImageUpload('banner-upload', 'banner-preview', 'banner');
    
    setupDeleteConfirmation();
    
    const form = document.getElementById('server-settings-form');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        
        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Saving...';
            
            const formData = new FormData(this);
            formData.append('server_id', currentServer);
            
            await saveServerSettings(formData);
        } catch (error) {
            console.error('Form submission error:', error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
    
    form.addEventListener('change', function() {
        unsavedChanges = true;
    });
    
    document.getElementById('members-search')?.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('.member-item').forEach(item => {
            const name = item.querySelector('.member-name').textContent.toLowerCase();
            item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
        });
    });
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
});

// Role management (placeholder for future implementation)
async function loadRoles() {
    // ..
}