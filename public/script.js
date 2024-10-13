// Global variables
let token = localStorage.getItem('token');
let userData = JSON.parse(localStorage.getItem('userData'));
let chart;
let $ = window.jQuery;
let currentShortUrl = '';
let urlsData = [];
let isAdmin = false;

// Main function to run after DOM is loaded
function initializeApp() {
    // Helper function to safely add event listeners
    function addEventListenerIfExists(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with id '${id}' not found`);
        }
    }

    // Add event listeners using the helper function
    addEventListenerIfExists('urlForm', 'submit', handleUrlShorten);
    addEventListenerIfExists('loginForm', 'submit', handleLogin);
    addEventListenerIfExists('registerForm', 'submit', handleRegister);
    addEventListenerIfExists('profileForm', 'submit', handleProfileUpdate);
    addEventListenerIfExists('settingsForm', 'submit', handleSettingsUpdate);
    addEventListenerIfExists('logoutButton', 'click', handleLogout);
    addEventListenerIfExists('dashboardLink', 'click', showDashboard);
    addEventListenerIfExists('profileLink', 'click', showProfile);
    addEventListenerIfExists('analyticsLink', 'click', showAnalytics);
    addEventListenerIfExists('settingsLink', 'click', showSettings);
    addEventListenerIfExists('editUrlForm', 'submit', handleEditUrl);
    addEventListenerIfExists('adminLink', 'click', showAdminDashboard);
    addEventListenerIfExists('adminDashboardLink', 'click', showAdminDashboard);
    // addEventListenerIfExists('urlSearchForm', 'submit', function(e) {
    //     e.preventDefault();
    //     const query = document.getElementById('urlSearchInput').value;
    //     searchUrls(query);
    // });

    // Handle auth tab switching
    const authTabs = document.querySelectorAll('#authTabs .nav-link');
    authTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = document.querySelector(tab.getAttribute('data-bs-target'));
            document.querySelectorAll('#authTabsContent .tab-pane').forEach(pane => pane.classList.remove('show', 'active'));
            target.classList.add('show', 'active');
        });
    });

    // Check if user is already logged in
    if (token) {
        fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Invalid token');
            }
        })
        .then(userData => {
            showLoggedInState(userData);
        })
        .catch(error => {
            console.error('Error checking user session:', error);
            localStorage.removeItem('token');
            token = null;
        });
    }

    const storedToken = localStorage.getItem('token');
    const storedUserData = localStorage.getItem('userData');

    if (storedToken && storedUserData) {
        token = storedToken;
        const userData = JSON.parse(storedUserData);
        showLoggedInState(userData);
    } else {
        showLoggedOutState();
    }

    initializeSidebar();
}

// Event listener for DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Functions
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
            const data = await response.json();
            token = data.token;
            userData = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('userData', JSON.stringify(userData));
            updateUIForUserRole(userData.role);
            showLoggedInState(userData);
        } else {
            const errorData = await response.json();
            showError(errorData.error);
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('An error occurred during login');
    }
}
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        showError('Registration successful. Please log in.', 'success');
        document.getElementById('registerForm').reset();
        if (data.role === 'admin') {
            showError('You have been registered as an admin. Please log in.', 'success');
        }
    } catch (error) {
        showError(error.message);
    }
}

function showSection(sectionId) {
    $('.section').removeClass('active');
    $(`#${sectionId}`).addClass('active');

    // Update sidebar active state
    $('.components a').removeClass('active');
    $(`#${sectionId}Link`).addClass('active');
}
function showDashboard() {
    showSection('dashboard');
    fetchUserUrls().catch(error => {
        console.error('Error in showDashboard:', error);
        showError('Failed to load dashboard');
    });
}

function showProfile() {
    showSection('profile');
    fetchUserProfile();
}

function showAnalytics() {
    showSection('analytics');
    fetchAnalytics(); // Make sure this line is present
}

async function showSettings() {
    showSection('settings');
    try {
        const settings = await fetchUserSettings();
        document.getElementById('defaultExpirationDays').value = settings.defaultExpirationDays;
        document.getElementById('enableNotifications').checked = settings.enableNotifications;
    } catch (error) {
        console.error('Error showing settings:', error);
        // Optionally, you can show a message to the user here
        showError('Failed to load settings. Please try again later.');
    }
}

function showAuth() {
    showSection('auth');
}

function generateQRCode(url) {
    const qrCodeDiv = document.getElementById('qrCode');
    if (!qrCodeDiv) {
        console.error('QR code div not found');
        return;
    }
    qrCodeDiv.innerHTML = '';
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrCodeDiv.innerHTML = qr.createImgTag(5);
}

function showSocialShareButtons(url) {
    const socialShareDiv = document.getElementById('socialShare');
    if (!socialShareDiv) {
        console.error('Social share div not found');
        return;
    }
    socialShareDiv.innerHTML = `
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" class="btn btn-outline-primary btn-sm me-2"><i class="fab fa-facebook"></i></a>
        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}" target="_blank" class="btn btn-outline-info btn-sm me-2"><i class="fab fa-twitter"></i></a>
        <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}" target="_blank" class="btn btn-outline-secondary btn-sm"><i class="fab fa-linkedin"></i></a>
    `;
}

function toggleExpirationDate() {
    const expirationDate = document.getElementById('expirationDate');
    expirationDate.style.display = this.checked ? 'block' : 'none';
}

function togglePasswordInput() {
    const urlPassword = document.getElementById('urlPassword');
    urlPassword.style.display = this.checked ? 'block' : 'none';
}

async function handleUrlShorten(e) {
    e.preventDefault();
    const longUrl = document.getElementById('urlInput').value;
    const customSlug = document.getElementById('customSlugInput').value;
    const expirationDate = document.getElementById('expirationDateInput').value;

    if (!longUrl) {
        showError('Please enter a URL to shorten');
        return;
    }

    try {
        const response = await fetch('/shorten', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url: longUrl, customSlug, expirationDate })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to shorten URL');
        }
        const data = await response.json();
        showResult('URL shortened successfully');
        
        // Clear the input fields
        document.getElementById('urlInput').value = '';
        document.getElementById('customSlugInput').value = '';
        document.getElementById('expirationDateInput').value = '';
        
        // Fetch and display the updated list of URLs
        await fetchUserUrls();
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}
function handleLogout() {
    token = null;
    localStorage.removeItem('token');
    showLoggedOutState();
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const username = document.getElementById('profileUsername').value;
    const email = document.getElementById('profileEmail').value;
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, email })
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                showLoggedOutState();
                throw new Error('Session expired. Please log in again.');
            }
            throw new Error('Failed to update profile');
        }

        const data = await response.json();
        showError('Profile updated successfully', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showError(error.message);
    }
}

async function handleSettingsUpdate(e) {
    e.preventDefault();
    const defaultExpirationDays = document.getElementById('defaultExpirationDays').value;
    const enableNotifications = document.getElementById('enableNotifications').checked;
    try {
        await updateSettings(defaultExpirationDays, enableNotifications);
        showError('Settings updated successfully');
    } catch (error) {
        showError(error.message);
    }
}

// API calls
async function login(email, password) {
    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
        throw new Error('Login failed');
    }
    return response.json();
}

async function register(username, email, password) {
    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    if (!response.ok) {
        throw new Error('Registration failed');
    }
    return response.json();
}

async function shortenUrl(url, customSlug, expirationDate) {
    const response = await fetch('/shorten', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            url,
            customSlug,
            expirationDate
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to shorten URL');
    }

    return response.json();
}

async function fetchUserUrls() {
    try {
        const response = await fetch('/api/urls', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch URLs');
        }
        const urls = await response.json();
        displayUrls(urls);
    } catch (error) {
        console.error('Error fetching user URLs:', error);
        showError(error.message);
    }
}
async function deleteUrl(shortUrl) {
    try {
        const response = await fetch(`/api/url/${shortUrl}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete URL');
        }

        const data = await response.json();
        showResult(data.message);
        await fetchUserUrls(); // Refresh the URL list
    } catch (error) {
        console.error('Error deleting URL:', error);
        showResult('Error deleting URL: ' + error.message, true);
    }
}
async function fetchUserProfile() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const response = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token is invalid or expired
                localStorage.removeItem('token');
                showLoggedOutState();
                throw new Error('Session expired. Please log in again.');
            }
            throw new Error('Failed to fetch user profile');
        }

        const profile = await response.json();
        document.getElementById('profileUsername').value = profile.username;
        document.getElementById('profileEmail').value = profile.email;
        updateUserInfo(profile.username);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        showError(error.message);
        if (error.message === 'No authentication token found' || error.message === 'Session expired. Please log in again.') {
            showLoggedOutState();
        }
    }
}

async function updateProfile(username, email) {
    const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({ username, email })
    });
    if (!response.ok) {
        throw new Error('Failed to update profile');
    }
}

async function fetchUserSettings() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const response = await fetch('/api/user/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            throw new Error(errorData.error || 'Failed to fetch user settings');
        }

        const settings = await response.json();
        return settings;
    } catch (error) {
        console.error('Error fetching user settings:', error);
        showError(error.message);
        throw error;
    }
}

async function updateSettings(defaultExpirationDays, enableNotifications) {
    const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({ defaultExpirationDays, enableNotifications })
    });
    if (!response.ok) {
        throw new Error('Failed to update settings');
    }
}

function updateAnalytics() {
    if (!urlsData || urlsData.length === 0) {
        console.log('No URL data available');
        return;
    }

    const totalUrls = urlsData.length;
    const totalClicks = urlsData.reduce((sum, url) => sum + (url.clicks || 0), 0);

    document.getElementById('totalUrls').textContent = totalUrls;
    document.getElementById('totalClicks').textContent = totalClicks;

    // Sort URLs by clicks and get top 5
    const topUrls = urlsData
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
        .slice(0, 5);

    const topUrlsList = document.getElementById('topUrlsList');
    topUrlsList.innerHTML = topUrls.map(url => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            ${url.shortUrl}
            <span class="badge bg-primary rounded-pill">${url.clicks || 0} clicks</span>
        </li>
    `).join('');
}

// Chart functions
function updateAnalyticsChart(urls) {
    const analyticsChartElement = document.getElementById('analyticsChart');
    if (!analyticsChartElement) return; // Exit if the chart element doesn't exist

    const ctx = analyticsChartElement.getContext('2d');
    if (chart) {
        chart.destroy();
    }
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: urls.map(url => url.shortUrl),
            datasets: [{
                label: 'Clicks',
                data: urls.map(url => url.clicks),
                backgroundColor: 'rgba(76, 175, 80, 0.6)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Utility functions
function showError(message, type = 'error') {
    const errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    } else {
        console.error('Error element not found in the DOM');
        alert(message);
    }
}
function updateUrlTable(urls) {
    urlsData = urls; // Store the URLs data globally
    const urlTableBody = document.getElementById('urlTableBody');
    if (!urlTableBody) {
        console.error('URL table body not found');
        return;
    }
    urlTableBody.innerHTML = urls.map(url => `
        <tr>
            <td>${truncateText(url.originalUrl, 30)}</td>
            <td><a href="#" onclick="handleUrlClick(event, '${url.shortUrl}')">${url.shortUrl}</a></td>
            <td>${url.clicks}</td>
            <td>${new Date(url.createdAt).toLocaleString()}</td>
            <td>${url.expiresAt ? new Date(url.expiresAt).toLocaleString() : 'Never'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="showQRCode('${url.shortUrl}')"><i class="fas fa-qrcode"></i></button>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="showEditModal('${url.shortUrl}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteUrl('${url.shortUrl.split('/').pop()}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function truncateText(text, maxLength) {
    if (!text) return ''; // Return an empty string if text is null or undefined
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function showResult(message, isError = false) {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) {
        console.error('Message container not found');
        return;
    }

    messageContainer.textContent = message;
    messageContainer.className = `alert ${isError ? 'alert-danger' : 'alert-success'}`;
    messageContainer.style.display = 'block';

    // Hide the message after 3 seconds
    setTimeout(() => {
        messageContainer.style.display = 'none';
    }, 3000);
}

function showLoggedInState(userDataParam) {
    const userData = userDataParam || JSON.parse(localStorage.getItem('userData'));
    if (!userData) {
        console.error('No user data available');
        showLoggedOutState();
        return;
    }

    document.getElementById('auth').style.display = 'none';
    document.getElementById('content').style.display = 'block';
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.display = 'block';
    }

    const contentElement = document.getElementById('content');
    if (contentElement) {
        contentElement.classList.add('with-sidebar');
    }

    // Show user info
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.style.display = 'flex';
    }

    // Update user info
    updateUserInfo(userData.username);

    // Update UI for user role
    updateUIForUserRole(userData.role);

    // Show dashboard
    showDashboard();
}

function showLoggedOutState() {
    token = null;
    userData = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('content').classList.remove('with-sidebar');
    document.getElementById('userInfo').style.display = 'none'; // Hide user info
    showAuth();
}

// Initialize the app
$(document).ready(function() {
    if (token) {
        showLoggedInState();
    } else {
        showLoggedOutState();
    }
});

async function handleUrlClick(event, shortUrl) {
    event.preventDefault();
    try {
        const response = await fetch(`/api/url/${shortUrl.split('/').pop()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to retrieve URL');
        }
        
        const data = await response.json();
        if (data.originalUrl) {
            window.open(data.originalUrl, '_blank');
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        console.error('Error accessing URL:', error);
        showError(`Error accessing URL: ${error.message}`);
    }
}

// Add these functions to your script.js file

function showEditModal(shortUrl) {
    currentShortUrl = shortUrl;
    const url = urlsData.find(u => u.shortUrl === shortUrl);
    if (url) {
        document.getElementById('editUrlInput').value = url.originalUrl;
        document.getElementById('editCustomSlugInput').value = shortUrl.split('/').pop();
        document.getElementById('editExpirationDateInput').value = url.expiresAt ? new Date(url.expiresAt).toISOString().split('T')[0] : '';
    }
    $('#editUrlModal').modal('show');
}

async function handleEditUrl(e) {
    e.preventDefault();
    const originalUrl = document.getElementById('editUrlInput').value;
    const customSlug = document.getElementById('editCustomSlugInput').value;
    const expirationDate = document.getElementById('editExpirationDateInput').value;

    if (!isValidUrl(originalUrl)) {
        showError('Please enter a valid URL');
        return;
    }

    try {
        const response = await fetch(`/api/url/${currentShortUrl.split('/').pop()}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ originalUrl, customSlug, expirationDate })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error updating URL:', errorData);
            throw new Error(errorData.error || 'Failed to update URL');
        }

        $('#editUrlModal').modal('hide');
        await fetchUserUrls();
        showResult('URL updated successfully');
    } catch (error) {
        showError(error.message);
    }
}
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function showQRCode(shortUrl) {
    const qrCodeDiv = document.getElementById('qrCodeModalBody');
    qrCodeDiv.innerHTML = ''; // Clear previous QR code
    
    const qr = qrcode(0, 'M');
    qr.addData(shortUrl);
    qr.make();
    
    const qrImg = qr.createImgTag(5);
    qrCodeDiv.innerHTML = qrImg;
    
    // Add social media share buttons
    const socialShareDiv = document.createElement('div');
    socialShareDiv.className = 'mt-3';
    socialShareDiv.innerHTML = `
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shortUrl)}" target="_blank" class="btn btn-outline-primary btn-sm me-2"><i class="fab fa-facebook"></i> Share</a>
        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(shortUrl)}" target="_blank" class="btn btn-outline-info btn-sm me-2"><i class="fab fa-twitter"></i> Tweet</a>
        <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shortUrl)}" target="_blank" class="btn btn-outline-secondary btn-sm"><i class="fab fa-linkedin"></i> Share</a>
    `;
    qrCodeDiv.appendChild(socialShareDiv);
    
    // Show the modal using Bootstrap's modal method
    const qrCodeModal = new bootstrap.Modal(document.getElementById('qrCodeModal'));
    qrCodeModal.show();
}

// Add a function to show the admin dashboard
function showAdminDashboard() {
    showSection('admin');
    fetchAdminData();
}

// Add a function to fetch all users (for admin)
async function fetchAdminData() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch admin data');
        }
        const data = await response.json();
        displayAdminData(data);
    } catch (error) {
        console.error('Error fetching admin data:', error);
        showError('Failed to fetch admin data');
    }
}

// Add a function to display users in the admin dashboard
function displayAdminData(users) {
    const userTableBody = document.getElementById('userTableBody');
    userTableBody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
        `;
        userTableBody.appendChild(row);
    });
}

// Add a function to display pagination
function displayPagination(currentPage, totalPages) {
    const paginationElement = document.getElementById('urlPagination');
    paginationElement.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        const pageLink = document.createElement('li');
        pageLink.classList.add('page-item');
        if (i === currentPage) {
            pageLink.classList.add('active');
        }
        pageLink.innerHTML = `<a class="page-link" href="#" onclick="fetchUserUrls(${i})">${i}</a>`;
        paginationElement.appendChild(pageLink);
    }
}

// Add a function to search URLs
async function searchUrls(query) {
    try {
        const response = await fetch(`/api/urls/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to search URLs');
        }
        const urls = await response.json();
        displayUrls(urls);
    } catch (error) {
        console.error('Error searching URLs:', error);
        showError(error.message);
    }
}

// Add this function
function displayUrls(urls) {
    const urlTableBody = document.getElementById('urlTableBody');
    if (!urlTableBody) {
        console.error('URL table body not found');
        return;
    }
    urlTableBody.innerHTML = '';
    if (urls.length === 0) {
        urlTableBody.innerHTML = '<tr><td colspan="6">No URLs found</td></tr>';
        return;
    }
    urls.forEach(url => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${truncateText(url.originalUrl, 30)}</td>
            <td><a href="${url.shortUrl}" target="_blank">${url.shortUrl}</a></td>
            <td>${url.clicks || 0}</td>
            <td>${new Date(url.createdAt).toLocaleDateString()}</td>
            <td>${url.expiresAt ? new Date(url.expiresAt).toLocaleDateString() : 'Never'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="copyToClipboard('${url.shortUrl.split('/').pop()}')"><i class="fas fa-copy"></i></button>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="showQRCode('${url.shortUrl}')"><i class="fas fa-qrcode"></i></button>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="showEditModal('${url.shortUrl}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteUrl('${url.shortUrl}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        urlTableBody.appendChild(row);
    });
}

// Add this function to handle copying the URL
function copyToClipboard(text) {
    // Create the full URL by combining the current origin with the short URL
    const fullUrl = `${window.location.origin}/${text}`;
    
    navigator.clipboard.writeText(fullUrl).then(() => {
        showResult('Link copied to clipboard!');
    }, (err) => {
        console.error('Could not copy text: ', err);
        showError('Failed to copy link');
    });
}

// Add this function to your existing script.js
function initializeSidebar() {
    $('#sidebarCollapse').on('click', function () {
        $('#sidebar, #content').toggleClass('active');
    });

    $('.components a').on('click', function () {
        $('.components a').removeClass('active');
        $(this).addClass('active');
    });
}

// Add this function to update user info
function updateUserInfo(username) {
    $('#userGreeting').text(`Welcome, ${username}!`);
}

function updateUIForUserRole(role) {
    const adminLink = document.getElementById('adminLink');
    if (adminLink) {
        if (role === 'admin') {
            adminLink.style.display = 'block';
            console.log('Admin link displayed');
        } else {
            adminLink.style.display = 'none';
            console.log('Admin link hidden');
        }
    } else {
        console.error('Admin link element not found');
    }
}

async function fetchAnalytics() {
    try {
        const response = await fetch('/api/analytics', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch analytics');
        }
        const data = await response.json();
        console.log('Analytics data:', data); // Keep this line for debugging

        // Update the UI with the fetched data
        document.getElementById('totalUrls').textContent = data.totalUrls || 0;
        document.getElementById('totalClicks').textContent = data.totalClicks || 0;

        // Update top URLs list
        const topUrlsList = document.getElementById('topUrlsList');
        topUrlsList.innerHTML = '';
        if (data.topUrls && data.topUrls.length > 0) {
            data.topUrls.forEach(url => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    ${url.originalUrl || url.shortUrl}
                    <span class="badge bg-primary rounded-pill">${url.clicks || 0} clicks</span>
                `;
                topUrlsList.appendChild(li);
            });
        } else {
            topUrlsList.innerHTML = '<li class="list-group-item">No data available</li>';
        }

        // Update the chart if it exists
        if (typeof updateAnalyticsChart === 'function') {
            updateAnalyticsChart(data.topUrls || []);
        }

    } catch (error) {
        console.error('Error fetching analytics:', error);
        showError('Failed to fetch analytics data');
    }
}

// Add this function to your existing script.js
function animateElement(element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    setTimeout(() => {
        element.style.transition = 'opacity 0.5s, transform 0.5s';
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    }, 100);
}

// Modify your showSection function to include the animation
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    const activeSection = document.getElementById(sectionId);
    activeSection.classList.add('active');
    animateElement(activeSection);
}

// Add this to animate elements when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.fade-in');
    elements.forEach(element => animateElement(element));
});
