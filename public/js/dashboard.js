// Enhanced Dashboard JavaScript with Role-Based Access Control
let currentUser = null;
let isAuthenticated = false;
let userNotifications = [];
let userBots = [];
let allBots = [];
let allUsers = [];
let notificationInterval = null;
let lastNotificationCount = 0;
let isNotificationPanelOpen = false;
let adminToken = null;

// Initialize theme on dashboard load
document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
    console.log("Dashboard page loaded - starting authentication");
    initializeDashboard();
});

// Theme management functions
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('sidebarThemeToggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}

// Generate secure admin token
function generateAdminToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 27; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Authentication Functions
function redirectToLogin() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login";
}

async function authenticateUser() {
    console.log("Starting authentication process...");

    try {
        const userData = localStorage.getItem("userData");
        if (!userData) {
            throw new Error("No user data found");
        }

        let user;
        try {
            user = JSON.parse(userData);
            if (!user || !user.username || !user.sessionToken) {
                throw new Error("Invalid user data structure");
            }
        } catch (error) {
            localStorage.clear();
            throw new Error("Invalid user data");
        }

        const response = await fetch("/api/auth/verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionToken: user.sessionToken }),
        });

        const data = await response.json();

        if (!data.success) {
            localStorage.clear();
            throw new Error("Session invalid");
        }

        console.log("Authentication successful");
        
        user.createdAt = data.data.createdAt;
        user.role = data.data.role || 'user';
        currentUser = user;
        isAuthenticated = true;

        return user;
    } catch (error) {
        console.log("Authentication failed:", error.message);
        currentUser = null;
        isAuthenticated = false;
        throw error;
    }
}

// UI Update Functions
function updateUsernameDisplays(username) {
    const usernameElements = ["sidebarUsername", "headerUsername", "welcomeUsername"];
    usernameElements.forEach((elementId) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = username;
        }
    });
}

function updateUserRole(role) {
    const roleElement = document.getElementById("userRole");
    if (roleElement) {
        roleElement.textContent = role.replace('_', ' ').toUpperCase();
    }

    // Show/hide admin panel based on role
    const adminMenuItem = document.getElementById("adminPanelMenuItem");
    if (adminMenuItem) {
        if (role === 'admin' || role === 'hr_admin' || role === 'owner') {
            adminMenuItem.style.display = "block";
        } else {
            adminMenuItem.style.display = "none";
        }
    }
}

function showDashboard() {
    document.getElementById("loadingScreen").style.display = "none";
    document.getElementById("authWall").style.display = "none";
    document.getElementById("dashboardContent").style.display = "flex";
}

function showAuthWall() {
    document.getElementById("loadingScreen").style.display = "none";
    document.getElementById("dashboardContent").style.display = "none";
    document.getElementById("authWall").style.display = "flex";
}

// Notification Functions
async function loadNotifications() {
    try {
        const response = await fetch(`/api/notifications/user/${currentUser.sessionToken}`);
        const data = await response.json();

        if (data.success) {
            // Filter notifications to only show those created after user signup
            const filteredNotifications = data.data.filter(notification => {
                const notificationDate = new Date(notification.createdAt);
                const userCreationDate = new Date(currentUser.createdAt);
                return notificationDate >= userCreationDate;
            });

            const newUnreadCount = filteredNotifications.filter((n) => !n.isRead).length;

            if (newUnreadCount > lastNotificationCount && lastNotificationCount > 0) {
                showNewNotificationAlert();
            }

            userNotifications = filteredNotifications;
            lastNotificationCount = newUnreadCount;
            updateNotificationBadge();

            if (isNotificationPanelOpen) {
                displayNotifications();
            }
        }
    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

function showNewNotificationAlert() {
    const alert = document.createElement("div");
    alert.className = "new-notification-alert";
    alert.innerHTML = `
        <i class="fas fa-bell"></i>
        <span>New notification received!</span>
    `;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 10001;
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    document.body.appendChild(alert);

    setTimeout(() => {
        alert.style.animation = "slideOutRight 0.3s ease";
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 300);
    }, 3000);
}

function startNotificationPolling() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
    }
    notificationInterval = setInterval(loadNotifications, 2000);
    console.log("Started notification polling");
}

function stopNotificationPolling() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
        console.log("Stopped notification polling");
    }
}

function updateNotificationBadge() {
    const unreadCount = userNotifications.filter((n) => !n.isRead).length;
    const badge = document.getElementById("notificationBadge");

    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = "block";
    } else {
        badge.style.display = "none";
    }
}

function displayNotifications() {
    const notificationsList = document.getElementById("notificationsList");

    if (userNotifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="no-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }

    notificationsList.innerHTML = userNotifications
        .map(
            (notification) => `
                <div class="notification-item ${notification.isRead ? "read" : "unread"}" data-id="${notification._id}">
                    <div class="notification-icon ${notification.type}">
                        <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <h4>${notification.title}</h4>
                        <p>${notification.message}</p>
                        <span class="notification-time">${new Date(notification.createdAt).toLocaleString()}</span>
                    </div>
                    ${!notification.isRead ? '<div class="unread-indicator"></div>' : ""}
                </div>
            `,
        )
        .join("");
}

async function markAllNotificationsAsRead() {
    try {
        const response = await fetch(`/api/notifications/mark-all-read/${currentUser.sessionToken}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (response.ok) {
            userNotifications = userNotifications.map((n) => ({ ...n, isRead: true }));
            updateNotificationBadge();
            displayNotifications();
        }
    } catch (error) {
        console.error("Error marking notifications as read:", error);
    }
}

async function clearAllNotifications() {
    try {
        const response = await fetch(`/api/notifications/clear-all/${currentUser.sessionToken}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (response.ok) {
            userNotifications = [];
            updateNotificationBadge();
            displayNotifications();
            showNotification("All notifications cleared", "success");
        }
    } catch (error) {
        console.error("Error clearing notifications:", error);
        showNotification("Failed to clear notifications", "error");
    }
}

function getNotificationIcon(type) {
    const icons = {
        info: "info-circle",
        success: "check-circle",
        warning: "exclamation-triangle",
        error: "exclamation-circle",
    };
    return icons[type] || "bell";
}

// Bot Management Functions
async function loadUserBots() {
    try {
        const response = await fetch(`/api/bots/user/${currentUser.sessionToken}`);
        const data = await response.json();

        if (data.success) {
            userBots = data.data;
            displayUserBots();
            updateBotStats();
            
            // Display shared bots if any
            if (data.sharedBots && data.sharedBots.length > 0) {
                displaySharedBots(data.sharedBots);
                document.getElementById("sharedBotsSection").style.display = "block";
            }
        }
    } catch (error) {
        console.error("Error loading user bots:", error);
    }
}

function displayUserBots() {
    const botGrid = document.getElementById("userBotGrid");

    if (userBots.length === 0) {
        botGrid.innerHTML = `
            <div class="no-bots-message">
                <i class="fas fa-robot"></i>
                <h3>No Bots Registered</h3>
                <p>No bots assigned to your account. Contact an admin to register a bot.</p>
            </div>
        `;
        return;
    }

    botGrid.innerHTML = userBots
        .map((bot) => {
            const statusClass = bot.status === "active" ? "online" : bot.status === "terminated" ? "terminated" : "offline";
            const statusText = bot.status === "active" ? "Active" : bot.status === "terminated" ? "Terminated" : "Inactive";
            const subscriptionBadgeClass = bot.subscriptionType === "hobby" ? "hobby" : bot.subscriptionType === "standard" ? "standard" : bot.subscriptionType === "pro" ? "pro" : "hobby";

            return `
                <div class="bot-card">
                    <div class="bot-status ${statusClass}"></div>
                    <div class="bot-info">
                        <h3>${bot.botName}</h3>
                        <p>Owner: ${bot.personName}</p>
                        <div class="bot-stats">
                            <span><i class="fas fa-link"></i> <a href="${bot.serverLink}" target="_blank">Server Link</a></span>
                            <span><i class="fas fa-tag"></i> Plan: <span class="subscription-badge ${subscriptionBadgeClass}">${bot.subscriptionType || "hobby"}</span></span>
                        </div>
                        <div class="bot-status-info">
                            <span class="status-badge ${bot.status}">${statusText}</span>
                            ${bot.terminationReason ? `<span class="reason-text">Reason: ${bot.terminationReason}</span>` : ""}
                        </div>
                        <div class="bot-actions">
                            <button class="btn btn-secondary btn-sm" onclick="shareBot('${bot._id}')">
                                <i class="fas fa-share"></i> Share
                            </button>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");
}

function displaySharedBots(sharedBots) {
    const sharedBotGrid = document.getElementById("sharedBotGrid");

    sharedBotGrid.innerHTML = sharedBots
        .map((bot) => {
            const statusClass = bot.status === "active" ? "online" : bot.status === "terminated" ? "terminated" : "offline";
            const statusText = bot.status === "active" ? "Active" : bot.status === "terminated" ? "Terminated" : "Inactive";
            const subscriptionBadgeClass = bot.subscriptionType === "hobby" ? "hobby" : bot.subscriptionType === "standard" ? "standard" : bot.subscriptionType === "pro" ? "pro" : "hobby";

            return `
                <div class="bot-card">
                    <div class="bot-status ${statusClass}"></div>
                    <div class="bot-info">
                        <h3>${bot.botName} <span class="shared-indicator">(Shared)</span></h3>
                        <p>Owner: ${bot.personName} (${bot.userId.username})</p>
                        <div class="bot-stats">
                            <span><i class="fas fa-link"></i> <a href="${bot.serverLink}" target="_blank">Server Link</a></span>
                            <span><i class="fas fa-tag"></i> Plan: <span class="subscription-badge ${subscriptionBadgeClass}">${bot.subscriptionType || "hobby"}</span></span>
                        </div>
                        <div class="bot-status-info">
                            <span class="status-badge ${bot.status}">${statusText}</span>
                            ${bot.terminationReason ? `<span class="reason-text">Reason: ${bot.terminationReason}</span>` : ""}
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");
}

function updateBotStats() {
    const totalBots = userBots.length;
    const activeBots = userBots.filter((bot) => bot.status === "active").length;

    document.getElementById("userBotCount").textContent = totalBots;
    document.getElementById("activeBotCount").textContent = activeBots;
    document.getElementById("totalBotsCount").textContent = totalBots;
    document.getElementById("activeBotsCount").textContent = activeBots;
    document.getElementById("inactiveBotsCount").textContent = totalBots - activeBots;
}

// Bot sharing function for regular users
async function shareBot(botId) {
    // Load users for sharing
    try {
        const response = await fetch("/api/users");
        const data = await response.json();

        if (data.success) {
            const shareWithUserSelect = document.getElementById("shareWithUser");
            shareWithUserSelect.innerHTML = '<option value="">Select a user...</option>';
            
            data.data.forEach((user) => {
                if (user._id !== currentUser.id) { // Don't include current user
                    const option = document.createElement("option");
                    option.value = user._id;
                    option.textContent = user.username;
                    shareWithUserSelect.appendChild(option);
                }
            });

            // Set the bot ID and show modal
            document.getElementById("shareBotId").value = botId;
            showModal("botSharingModal");
        }
    } catch (error) {
        console.error("Error loading users for sharing:", error);
        showNotification("Failed to load users", "error");
    }
}

// Admin Functions
async function openAdminPanel() {
    if (!currentUser || !['admin', 'hr_admin', 'owner'].includes(currentUser.role)) {
        showNotification("Access denied. Admin privileges required.", "error");
        return;
    }

    showModal("adminPanelModal");
    await loadAllBots();
    await loadUsers();
    populateBotSelects();
}

async function loadAllBots() {
    try {
        const response = await fetch("/api/bots");
        const data = await response.json();

        if (data.success) {
            allBots = data.data;
            displayAdminBots(data.data);
        }
    } catch (error) {
        console.error("Error loading all bots:", error);
    }
}

function displayAdminBots(bots) {
    const adminBotList = document.getElementById("adminBotList");

    adminBotList.innerHTML = bots
        .map((bot) => {
            const statusClass = bot.status === "active" ? "success" : bot.status === "terminated" ? "warning" : "error";
            const subscriptionBadgeClass = bot.subscriptionType === "hobby" ? "hobby" : bot.subscriptionType === "standard" ? "standard" : bot.subscriptionType === "pro" ? "pro" : "hobby";

            return `
                <div class="admin-bot-item">
                    <div class="bot-details">
                        <h4>${bot.botName}</h4>
                        <p>Owner: ${bot.personName} (${bot.userId.username})</p>
                        <p>Server: <a href="${bot.serverLink}" target="_blank">${bot.serverLink}</a></p>
                        <p>Subscription: <span class="subscription-badge ${subscriptionBadgeClass}">${bot.subscriptionType || "hobby"}</span></p>
                        <span class="status-badge ${statusClass}">${bot.status}</span>
                        ${bot.terminationReason ? `<p class="reason-text">Termination Reason: ${bot.terminationReason}</p>` : ""}
                    </div>
                    <div class="bot-actions">
                        <button class="btn btn-secondary" onclick="editBot('${bot._id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        ${bot.status === "terminated" ? 
                            `<button class="btn btn-success" onclick="reactivateBot('${bot._id}')">
                                <i class="fas fa-undo"></i> Reactivate
                            </button>` : 
                            `<button class="btn btn-warning" onclick="terminateBot('${bot._id}')">
                                <i class="fas fa-ban"></i> Terminate
                            </button>`
                        }
                        <button class="btn btn-error" onclick="deleteBot('${bot._id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        })
        .join("");
}

async function loadUsers() {
    try {
        const response = await fetch("/api/users");
        const data = await response.json();

        if (data.success) {
            allUsers = data.data;
            displayUsers(data.data);
            populateUserSelects(data.data);
        }
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

function displayUsers(users) {
    const adminUserList = document.getElementById("adminUserList");

    adminUserList.innerHTML = users
        .map(
            (user) => `
                <div class="admin-user-item">
                    <div class="user-details">
                        <h4>${user.username}</h4>
                        <p>Email: ${user.email || "Not provided"}</p>
                        <p>Role: <span class="status-badge ${user.role}">${user.role.replace('_', ' ').toUpperCase()}</span></p>
                        <p>Status: <span class="status-badge ${user.status}">${user.status}</span></p>
                        <p>Joined: ${new Date(user.createdAt).toLocaleDateString()}</p>
                        <p>Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}</p>
                    </div>
                    <div class="bot-actions">
                        <button class="btn btn-secondary" onclick="editUser('${user._id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-error" onclick="deleteUser('${user._id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `,
        )
        .join("");
}

function populateUserSelects(users) {
    const selects = ["targetUser", "shareUserSelect"];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = selectId === "targetUser" ? 
                '<option value="">All Users (Broadcast)</option>' : 
                '<option value="">Select a user...</option>';

            users.forEach((user) => {
                const option = document.createElement("option");
                option.value = user._id;
                option.textContent = user.username;
                select.appendChild(option);
            });
        }
    });
}

function populateBotSelects() {
    const shareBotSelect = document.getElementById("shareBotSelect");
    if (shareBotSelect) {
        shareBotSelect.innerHTML = '<option value="">Select a bot...</option>';
        
        allBots.forEach((bot) => {
            const option = document.createElement("option");
            option.value = bot._id;
            option.textContent = `${bot.botName} (${bot.personName})`;
            shareBotSelect.appendChild(option);
        });
    }
}

// Event Handlers
async function handleLogout() {
    console.log("Logout initiated");
    stopNotificationPolling();

    try {
        if (currentUser && currentUser.sessionToken) {
            await fetch("/api/auth/logout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ sessionToken: currentUser.sessionToken }),
            });
        }
    } catch (error) {
        console.log("Could not notify server of logout");
    }

    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login";
}

// Modal Functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = "flex";
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

// Notification System
function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification-toast ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 10001;
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 250px;
        font-weight: 500;
    `;

    // Add type-specific styling
    const colors = {
        success: "var(--success-color)",
        error: "var(--error-color)",
        warning: "var(--warning-color)",
        info: "var(--primary-color)"
    };

    notification.style.borderLeftColor = colors[type] || colors.info;
    notification.style.borderLeftWidth = "4px";

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = "slideOutRight 0.3s ease";
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Global Admin Functions
window.editBot = (botId) => {
    const bot = allBots.find((b) => b._id === botId);
    if (bot) {
        document.getElementById("editBotId").value = bot._id;
        document.getElementById("editPersonName").value = bot.personName;
        document.getElementById("editBotName").value = bot.botName;
        document.getElementById("editServerLink").value = bot.serverLink;
        document.getElementById("editSubscriptionType").value = bot.subscriptionType || "hobby";
        document.getElementById("editStatus").value = bot.status;

        const terminationReasonGroup = document.getElementById("terminationReasonGroup");
        if (bot.status === "terminated") {
            terminationReasonGroup.style.display = "block";
            document.getElementById("terminationReason").value = bot.terminationReason || "";
        } else {
            terminationReasonGroup.style.display = "none";
        }

        showModal("botEditModal");
    }
};

window.deleteBot = async (botId) => {
    if (confirm("Are you sure you want to delete this bot?")) {
        try {
            const response = await fetch(`/api/bots/${botId}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (data.success) {
                await loadAllBots();
                showNotification("Bot deleted successfully!", "success");
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || "Failed to delete bot", "error");
        }
    }
};

window.terminateBot = async (botId) => {
    const reason = prompt("Please provide a reason for termination:");
    if (reason) {
        try {
            const response = await fetch(`/api/bots/${botId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    status: "terminated",
                    terminationReason: reason,
                }),
            });

            const data = await response.json();

            if (data.success) {
                await loadAllBots();
                showNotification("Bot terminated successfully", "warning");
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || "Failed to terminate bot", "error");
        }
    }
};

window.reactivateBot = async (botId) => {
    if (confirm("Are you sure you want to reactivate this bot?")) {
        try {
            const response = await fetch(`/api/bots/${botId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    status: "active",
                    terminationReason: "",
                }),
            });

            const data = await response.json();

            if (data.success) {
                await loadAllBots();
                showNotification("Bot reactivated successfully", "success");
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || "Failed to reactivate bot", "error");
        }
    }
};

window.editUser = (userId) => {
    const user = allUsers.find((u) => u._id === userId);
    if (user) {
        document.getElementById("editUserId").value = user._id;
        document.getElementById("editUsername").value = user.username;
        document.getElementById("editEmail").value = user.email || "";
        document.getElementById("editRole").value = user.role;
        document.getElementById("editUserStatus").value = user.status;
        showModal("userEditModal");
    }
};

window.deleteUser = async (userId) => {
    if (confirm("Are you sure you want to delete this user? This will also delete all their bots.")) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (data.success) {
                await loadUsers();
                await loadAllBots();
                showNotification("User and associated bots deleted successfully!", "success");
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || "Failed to delete user", "error");
        }
    }
};

window.shareBot = shareBot;

// Initialization
async function initializeDashboard() {
    try {
        const user = await authenticateUser();

        updateUsernameDisplays(user.username);
        updateUserRole(user.role);
        showDashboard();
        setupEventListeners();

        await Promise.all([
            loadUserBots(),
            loadNotifications(),
        ]);

        startNotificationPolling();

        setTimeout(() => {
            showNotification(`Welcome back, ${user.username}!`, "success");
        }, 1000);

        console.log("Dashboard fully initialized");
    } catch (error) {
        console.log("Dashboard initialization failed");
        showAuthWall();
    }
}

function setupEventListeners() {
    console.log("Setting up event listeners");

    // Theme toggle
    const sidebarThemeToggle = document.getElementById("sidebarThemeToggle");
    if (sidebarThemeToggle) {
        sidebarThemeToggle.addEventListener("click", toggleTheme);
    }

    // Basic navigation
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }

    // Admin panel access
    const adminPanelLink = document.getElementById("adminPanelLink");
    if (adminPanelLink) {
        adminPanelLink.addEventListener("click", (e) => {
            e.preventDefault();
            openAdminPanel();
        });
    }

    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById("mobileMenuToggle");
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener("click", () => {
            const sidebar = document.querySelector(".sidebar");
            sidebar.classList.toggle("open");
        });
    }

    // Admin tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const tabName = btn.getAttribute("data-tab");

            document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach((c) => {
                c.classList.remove("active");
                c.style.display = "none";
            });

            btn.classList.add("active");
            const tabContent = document.getElementById(tabName + "Tab");
            if (tabContent) {
                tabContent.classList.add("active");
                tabContent.style.display = "block";
            }
        });
    });

    // Notifications
    document.getElementById("notificationBtn").addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const panel = document.getElementById("notificationsPanel");

        if (panel.style.display === "none" || !panel.style.display) {
            panel.style.display = "block";
            isNotificationPanelOpen = true;
            await loadNotifications();
            displayNotifications();
        } else {
            panel.style.display = "none";
            isNotificationPanelOpen = false;
            await markAllNotificationsAsRead();
        }
    });

    document.getElementById("closeNotifications").addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById("notificationsPanel").style.display = "none";
        isNotificationPanelOpen = false;
        await markAllNotificationsAsRead();
    });

    // Clear notifications button
    document.getElementById("clearNotificationsBtn").addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you want to clear all notifications?")) {
            await clearAllNotifications();
        }
    });

    // Close notifications when clicking outside
    document.addEventListener("click", (e) => {
        const panel = document.getElementById("notificationsPanel");
        const notificationBtn = document.getElementById("notificationBtn");

        if (panel.style.display === "block" && !panel.contains(e.target) && !notificationBtn.contains(e.target)) {
            panel.style.display = "none";
            isNotificationPanelOpen = false;
            markAllNotificationsAsRead();
        }
    });

    // Modal close handlers
    document.querySelectorAll(".modal-close").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal");
            if (modal) {
                modal.style.display = "none";
            }
        });
    });

    // Refresh buttons
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadUserBots);
    }

    const refreshAdminBots = document.getElementById("refreshAdminBots");
    if (refreshAdminBots) {
        refreshAdminBots.addEventListener("click", loadAllBots);
    }

    const refreshUsers = document.getElementById("refreshUsers");
    if (refreshUsers) {
        refreshUsers.addEventListener("click", loadUsers);
    }

    // Form submissions
    setupFormHandlers();

    console.log("Event listeners setup complete");
}

function setupFormHandlers() {
    // Bot registration form (admin)
    const botRegistrationForm = document.getElementById("botRegistrationForm");
    if (botRegistrationForm) {
        botRegistrationForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const botData = {
                personName: formData.get("personName"),
                botName: formData.get("botName"),
                serverLink: formData.get("serverLink"),
                subscriptionType: formData.get("subscriptionType"),
                userId: currentUser.id // For admin-created bots, assign to current admin
            };

            try {
                const response = await fetch("/api/admin/bots", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(botData),
                });

                const data = await response.json();

                if (data.success) {
                    hideModal("botRegistrationModal");
                    e.target.reset();
                    await loadAllBots();
                    showNotification("Bot registered successfully!", "success");
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                showNotification(error.message || "Failed to register bot", "error");
            }
        });
    }

    // Bot edit form
    const botEditForm = document.getElementById("botEditForm");
    if (botEditForm) {
        botEditForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const botId = formData.get("botId");
            const botData = {
                personName: formData.get("personName"),
                botName: formData.get("botName"),
                serverLink: formData.get("serverLink"),
                subscriptionType: formData.get("subscriptionType"),
                status: formData.get("status"),
                terminationReason: formData.get("terminationReason")
            };

            try {
                const response = await fetch(`/api/bots/${botId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(botData),
                });

                const data = await response.json();

                if (data.success) {
                    hideModal("botEditModal");
                    await loadAllBots();
                    showNotification("Bot updated successfully!", "success");
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                showNotification(error.message || "Failed to update bot", "error");
            }
        });
    }

    // Bot sharing form
    const botSharingForm = document.getElementById("botSharingForm");
    if (botSharingForm) {
        botSharingForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const shareData = {
                sessionToken: currentUser.sessionToken,
                targetUserId: formData.get("targetUserId"),
                permissions: formData.get("permissions")
            };

            const botId = formData.get("botId");

            try {
                const response = await fetch(`/api/bots/${botId}/share`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(shareData),
                });

                const data = await response.json();

                if (data.success) {
                    hideModal("botSharingModal");
                    e.target.reset();
                    showNotification("Bot shared successfully!", "success");
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                showNotification(error.message || "Failed to share bot", "error");
            }
        });
    }

    // Admin bot sharing
    const shareBotBtn = document.getElementById("shareBotBtn");
    if (shareBotBtn) {
        shareBotBtn.addEventListener("click", async () => {
            const botId = document.getElementById("shareBotSelect").value;
            const userId = document.getElementById("shareUserSelect").value;
            const permissions = document.getElementById("sharePermissions").value;

            if (!botId || !userId) {
                showNotification("Please select both a bot and a user", "error");
                return;
            }

            try {
                const response = await fetch(`/api/bots/${botId}/share`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sessionToken: currentUser.sessionToken,
                        targetUserId: userId,
                        permissions: permissions
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    document.getElementById("shareBotSelect").value = "";
                    document.getElementById("shareUserSelect").value = "";
                    showNotification("Bot shared successfully!", "success");
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                showNotification(error.message || "Failed to share bot", "error");
            }
        });
    }

    // Notification form
    const notificationForm = document.getElementById("notificationForm");
    if (notificationForm) {
        notificationForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const notificationData = {
                title: formData.get("title"),
                message: formData.get("message"),
                type: formData.get("type"),
                targetUser: formData.get("targetUser") || null,
            };

            try {
                const response = await fetch("/api/notifications", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(notificationData),
                });

                const data = await response.json();

                if (data.success) {
                    e.target.reset();
                    showNotification("Notification sent successfully!", "success");
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                showNotification(error.message || "Failed to send notification", "error");
            }
        });
    }

    // User registration form
    const userRegistrationForm = document.getElementById("userRegistrationForm");
    if (userRegistrationForm) {
        userRegistrationForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const userData = {
                username: formData.get("username"),
                password: formData.get("password"),
                email: formData.get("email"),
                role: formData.get("role"),
            };

            try {
                const response = await fetch("/api/admin/users", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(userData),
                });

                const data = await response.json();

                if (data.success) {
                    hideModal("userRegistrationModal");
                    e.target.reset();
                    await loadUsers();
                    showNotification("User created successfully!", "success");
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                showNotification(error.message || "Failed to create user", "error");
            }
        });
    }

    // Create bot button
    const createAdminBotBtn = document.getElementById("createAdminBotBtn");
    if (createAdminBotBtn) {
        createAdminBotBtn.addEventListener("click", () => {
            showModal("botRegistrationModal");
        });
    }

    // Create user button
    const createUserBtn = document.getElementById("createUserBtn");
    if (createUserBtn) {
        createUserBtn.addEventListener("click", () => {
            showModal("userRegistrationModal");
        });
    }

    // Status change handler for bot edit form
    const editStatus = document.getElementById("editStatus");
    if (editStatus) {
        editStatus.addEventListener("change", (e) => {
            const terminationReasonGroup = document.getElementById("terminationReasonGroup");
            if (e.target.value === "terminated") {
                terminationReasonGroup.style.display = "block";
            } else {
                terminationReasonGroup.style.display = "none";
            }
        });
    }

    // Cancel buttons
    document.querySelectorAll('[id^="cancel"]').forEach(btn => {
        btn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal");
            if (modal) {
                modal.style.display = "none";
            }
        });
    });

    // Close modal buttons
    document.querySelectorAll('[id^="close"][id$="Modal"]').forEach(btn => {
        btn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal");
            if (modal) {
                modal.style.display = "none";
            }
        });
    });
}

// Security measures
window.addEventListener("beforeunload", () => {
    stopNotificationPolling();
});

window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});