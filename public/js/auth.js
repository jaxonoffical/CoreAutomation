document.addEventListener("DOMContentLoaded", () => {
    console.log("Authentication page loaded - clearing all stored data");

    // Clear all stored data
    localStorage.clear();
    sessionStorage.clear();

    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // Initialize theme
    initializeTheme();

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Enhanced notification function
    function showNotification(message, type = "info") {
        const notification = document.createElement("div");
        notification.className = `notification-toast ${type}`;

        const iconMap = {
            success: "check-circle",
            error: "exclamation-circle",
            warning: "exclamation-triangle",
            info: "info-circle",
        };

        notification.innerHTML = `
            <i class="fas fa-${iconMap[type]}"></i>
            <span>${message}</span>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            z-index: 10001;
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
        `;

        // Add type-specific styling
        const colors = {
            success: 'var(--success-color)',
            error: 'var(--error-color)',
            warning: 'var(--warning-color)',
            info: 'var(--primary-color)'
        };

        notification.style.borderLeftColor = colors[type];
        notification.style.borderLeftWidth = '4px';

        document.body.appendChild(notification);

        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = "slideOutRight 0.3s ease";
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Add animation styles
    const style = document.createElement("style");
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);

    // Toggle between login and signup
    document.getElementById("loginToggle").addEventListener("click", () => {
        document.getElementById("loginContainer").classList.remove("hidden");
        document.getElementById("signupContainer").classList.add("hidden");
        document.getElementById("loginToggle").classList.add("active");
        document.getElementById("signupToggle").classList.remove("active");
    });

    document.getElementById("signupToggle").addEventListener("click", () => {
        document.getElementById("loginContainer").classList.add("hidden");
        document.getElementById("signupContainer").classList.remove("hidden");
        document.getElementById("loginToggle").classList.remove("active");
        document.getElementById("signupToggle").classList.add("active");
    });

    // Toggle password visibility
    document.getElementById("toggleLoginPassword").addEventListener("click", function () {
        togglePasswordVisibility("password", this.querySelector("i"));
    });

    document.getElementById("toggleSignupPassword").addEventListener("click", function () {
        togglePasswordVisibility("signup-password", this.querySelector("i"));
    });

    document.getElementById("toggleConfirmPassword").addEventListener("click", function () {
        togglePasswordVisibility("confirm-password", this.querySelector("i"));
    });

    function togglePasswordVisibility(inputId, icon) {
        const passwordInput = document.getElementById(inputId);

        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            icon.className = "fas fa-eye-slash";
        } else {
            passwordInput.type = "password";
            icon.className = "fas fa-eye";
        }
    }

    // Enhanced form validation with visual feedback
    function addShakeAnimation(element) {
        element.style.animation = "shake 0.6s";
        setTimeout(() => {
            element.style.animation = "";
        }, 600);
    }

    function addPulseAnimation(element) {
        element.style.animation = "pulse 0.5s";
        setTimeout(() => {
            element.style.animation = "";
        }, 500);
    }

    // Login form submission
    document.getElementById("loginForm").addEventListener("submit", async function (e) {
        e.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const rememberMe = document.getElementById("remember").checked;

        if (!username || !password) {
            showNotification("Please fill in all fields", "error");
            addShakeAnimation(this);
            return;
        }

        const submitBtn = this.querySelector(".submit-btn");
        const btnText = this.querySelector(".btn-text");
        const btnLoader = this.querySelector(".btn-loader");

        // Show loading state
        submitBtn.classList.add("loading");
        btnText.style.opacity = "0";
        btnLoader.style.display = "block";
        submitBtn.disabled = true;

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log("Login successful - received session token");

                // Save user data with session token
                localStorage.setItem("userData", JSON.stringify(data.data));

                showNotification("Login successful! Redirecting...", "success");

                // Add success animation to the form
                submitBtn.style.background = "var(--success-color)";
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Success!';

                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 1500);
            } else {
                throw new Error(data.message || "Login failed");
            }
        } catch (error) {
            console.error("Login error:", error);
            showNotification(error.message || "An error occurred during login", "error");
            addShakeAnimation(this);

            // Add error styling to inputs
            document.getElementById("username").style.borderColor = "var(--error-color)";
            document.getElementById("password").style.borderColor = "var(--error-color)";

            setTimeout(() => {
                document.getElementById("username").style.borderColor = "";
                document.getElementById("password").style.borderColor = "";
            }, 3000);
        } finally {
            // Reset button state
            setTimeout(() => {
                submitBtn.classList.remove("loading");
                btnText.style.opacity = "1";
                btnLoader.style.display = "none";
                submitBtn.disabled = false;
                submitBtn.style.background = "";
                submitBtn.innerHTML = '<span class="btn-text">Sign In</span><div class="btn-loader"><div class="spinner"></div></div>';
            }, 1000);
        }
    });

    // Signup form submission
    document.getElementById("signupForm").addEventListener("submit", async function (e) {
        e.preventDefault();

        const username = document.getElementById("signup-username").value.trim();
        const password = document.getElementById("signup-password").value;
        const confirmPassword = document.getElementById("confirm-password").value;
        const termsAccepted = document.getElementById("terms").checked;

        // Enhanced validation with visual feedback
        if (!username || !password || !confirmPassword) {
            showNotification("Please fill in all fields", "error");
            addShakeAnimation(this);
            return;
        }

        if (username.length < 3) {
            showNotification("Username must be at least 3 characters long", "error");
            addShakeAnimation(document.getElementById("signup-username"));
            return;
        }

        if (password !== confirmPassword) {
            showNotification("Passwords do not match", "error");
            addShakeAnimation(document.getElementById("signup-password"));
            addShakeAnimation(document.getElementById("confirm-password"));

            // Add error styling
            document.getElementById("signup-password").style.borderColor = "var(--error-color)";
            document.getElementById("confirm-password").style.borderColor = "var(--error-color)";

            setTimeout(() => {
                document.getElementById("signup-password").style.borderColor = "";
                document.getElementById("confirm-password").style.borderColor = "";
            }, 3000);
            return;
        }

        if (password.length < 6) {
            showNotification("Password must be at least 6 characters long", "error");
            addShakeAnimation(document.getElementById("signup-password"));
            return;
        }

        if (!termsAccepted) {
            showNotification("Please accept the Terms of Service", "error");
            addPulseAnimation(document.querySelector(".checkbox-container"));
            return;
        }

        const submitBtn = this.querySelector(".submit-btn");
        const btnText = this.querySelector(".btn-text");
        const btnLoader = this.querySelector(".btn-loader");

        // Show loading state
        submitBtn.classList.add("loading");
        btnText.style.opacity = "0";
        btnLoader.style.display = "block";
        submitBtn.disabled = true;

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showNotification("Account created successfully! Please sign in.", "success");

                // Add success animation
                submitBtn.style.background = "var(--success-color)";
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Account Created!';

                // Switch to login form after a short delay
                setTimeout(() => {
                    document.getElementById("loginToggle").click();
                    document.getElementById("username").value = username;
                    addPulseAnimation(document.getElementById("username"));

                    // Reset signup form
                    this.reset();
                }, 2000);
            } else {
                throw new Error(data.message || "Registration failed");
            }
        } catch (error) {
            console.error("Registration error:", error);
            showNotification(error.message || "An error occurred during registration", "error");
            addShakeAnimation(this);
        } finally {
            // Reset button state
            setTimeout(() => {
                submitBtn.classList.remove("loading");
                btnText.style.opacity = "1";
                btnLoader.style.display = "none";
                submitBtn.disabled = false;
                submitBtn.style.background = "";
                submitBtn.innerHTML = '<span class="btn-text">Create Account</span><div class="btn-loader"><div class="spinner"></div></div>';
            }, 1000);
        }
    });

    // Enhanced input focus effects
    const inputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="email"]');
    inputs.forEach((input) => {
        input.addEventListener("focus", function () {
            this.parentElement.style.transform = "translateY(-2px)";
            this.parentElement.style.boxShadow = "0 8px 25px rgba(37, 99, 235, 0.15)";
        });

        input.addEventListener("blur", function () {
            this.parentElement.style.transform = "";
            this.parentElement.style.boxShadow = "";
        });
    });

    console.log("Professional authentication system initialized");
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
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}