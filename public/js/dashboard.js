// Dashboard functionality
class Dashboard {
    constructor() {
        this.currentUser = null;
        this.ads = [];
        this.stats = {};
        this.init();
    }

    async init() {
        // Check authentication
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        try {
            await this.loadUserData();
            await this.loadAds();
            await this.loadStats();
            this.setupEventListeners();
            this.renderDashboard();
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.handleError(error);
        }
    }

    async loadUserData() {
        const response = await fetch('/api/users/me', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user data');
        }

        this.currentUser = await response.json();
        this.updateUserInfo();
    }

    async loadAds() {
        const response = await fetch('/api/ads', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load ads');
        }

        this.ads = await response.json();
        this.renderAdsList();
    }

    async loadStats() {
        const response = await fetch('/api/analytics/summary', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }

        this.stats = await response.json();
        this.renderStats();
    }

    setupEventListeners() {
        // New Ad Button
        document.getElementById('newAdBtn')?.addEventListener('click', () => {
            this.showNewAdModal();
        });

        // Filter Ads
        document.getElementById('adFilter')?.addEventListener('change', (e) => {
            this.filterAds(e.target.value);
        });

        // Sort Ads
        document.getElementById('adSort')?.addEventListener('change', (e) => {
            this.sortAds(e.target.value);
        });

        // Logout Button
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });
    }

    renderDashboard() {
        this.renderAdsList();
        this.renderStats();
        this.renderUserInfo();
    }

    renderAdsList() {
        const adsContainer = document.getElementById('adsList');
        if (!adsContainer) return;

        adsContainer.innerHTML = this.ads.map(ad => `
            <div class="ad-card" data-id="${ad._id}">
                <h3>${ad.title}</h3>
                <p>${ad.description}</p>
                <div class="ad-stats">
                    <span>👁 ${ad.performance.impressions}</span>
                    <span>🖱 ${ad.performance.clicks}</span>
                    <span>💰 ${ad.performance.conversions}</span>
                </div>
                <div class="ad-actions">
                    <button onclick="dashboard.editAd('${ad._id}')">Edit</button>
                    <button onclick="dashboard.deleteAd('${ad._id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    renderStats() {
        const statsContainer = document.getElementById('statsOverview');
        if (!statsContainer || !this.stats) return;

        statsContainer.innerHTML = `
            <div class="stat-card">
                <h4>Total Impressions</h4>
                <p>${this.stats.totalImpressions}</p>
            </div>
            <div class="stat-card">
                <h4>Total Clicks</h4>
                <p>${this.stats.totalClicks}</p>
            </div>
            <div class="stat-card">
                <h4>Total Conversions</h4>
                <p>${this.stats.totalConversions}</p>
            </div>
            <div class="stat-card">
                <h4>Average CTR</h4>
                <p>${this.stats.averageCTR}%</p>
            </div>
        `;
    }

    renderUserInfo() {
        const userContainer = document.getElementById('userInfo');
        if (!userContainer || !this.currentUser) return;

        userContainer.innerHTML = `
            <div class="user-profile">
                <h3>Welcome, ${this.currentUser.name}</h3>
                <p>Plan: ${this.currentUser.subscription.plan}</p>
                <p>Credits: ${this.currentUser.credits}</p>
            </div>
        `;
    }

    async createNewAd(adData) {
        try {
            const response = await fetch('/api/ads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(adData)
            });

            if (!response.ok) {
                throw new Error('Failed to create ad');
            }

            const newAd = await response.json();
            this.ads.unshift(newAd);
            this.renderAdsList();
            this.hideNewAdModal();
        } catch (error) {
            console.error('Error creating ad:', error);
            this.handleError(error);
        }
    }

    async deleteAd(adId) {
        if (!confirm('Are you sure you want to delete this ad?')) return;

        try {
            const response = await fetch(`/api/ads/${adId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete ad');
            }

            this.ads = this.ads.filter(ad => ad._id !== adId);
            this.renderAdsList();
        } catch (error) {
            console.error('Error deleting ad:', error);
            this.handleError(error);
        }
    }

    showNewAdModal() {
        const modal = document.getElementById('newAdModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideNewAdModal() {
        const modal = document.getElementById('newAdModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    filterAds(filterValue) {
        // Implement ad filtering logic
    }

    sortAds(sortValue) {
        // Implement ad sorting logic
    }

    logout() {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }

    handleError(error) {
        // Show error notification
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = error.message;
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }
}

// Initialize dashboard
const dashboard = new Dashboard();
