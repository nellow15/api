class Dashboard {
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadStats();
        this.updateStatus();
        
        // Update status every 30 seconds
        setInterval(() => this.updateStatus(), 30000);
    }

    bindEvents() {
        // Message type toggle
        document.getElementById('messageType').addEventListener('change', (e) => {
            const mediaUrlGroup = document.getElementById('mediaUrlGroup');
            mediaUrlGroup.style.display = e.target.value === 'text' ? 'none' : 'block';
        });

        // Send form
        document.getElementById('sendForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
    }

    async sendMessage() {
        const formData = {
            apiKey: document.getElementById('apiKey').value,
            to: document.getElementById('toNumber').value,
            message: document.getElementById('message').value,
            type: document.getElementById('messageType').value
        };

        if (formData.type !== 'text') {
            formData.mediaUrl = document.getElementById('mediaUrl').value;
        }

        const responseArea = document.getElementById('responseArea');
        responseArea.innerHTML = '<div class="alert">Sending message...</div>';

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/whatsapp/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (data.success) {
                responseArea.innerHTML = `
                    <div class="alert alert-success">
                        Message sent successfully!<br>
                        Message ID: ${data.data.messageId}<br>
                        Time: ${new Date(data.data.timestamp * 1000).toLocaleString()}
                    </div>
                `;
                this.logActivity('Message sent successfully', 'success');
                this.updateStat('messagesSent');
            } else {
                responseArea.innerHTML = `
                    <div class="alert alert-error">
                        Failed to send message: ${data.error}
                    </div>
                `;
                this.logActivity(`Send failed: ${data.error}`, 'error');
            }
        } catch (error) {
            responseArea.innerHTML = `
                <div class="alert alert-error">
                    Network error: ${error.message}
                </div>
            `;
            this.logActivity(`Network error: ${error.message}`, 'error');
        }
    }

    async updateStatus() {
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/whatsapp/status?apiKey=${encodeURIComponent(apiKey)}`);
            const data = await response.json();
            
            const indicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');
            
            if (data.success && data.data.status === 'connected') {
                indicator.style.backgroundColor = 'var(--success)';
                statusText.textContent = 'Connected';
            } else {
                indicator.style.backgroundColor = 'var(--error)';
                statusText.textContent = data.data?.status || 'Disconnected';
            }
        } catch (error) {
            console.error('Status check failed:', error);
        }
    }

    async checkStatus() {
        this.logActivity('Checking WhatsApp status...', 'info');
        await this.updateStatus();
        this.logActivity('Status check completed', 'success');
    }

    async testConnection() {
        this.logActivity('Testing API connection...', 'info');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/health`);
            const data = await response.json();
            
            if (data.status === 'healthy') {
                this.logActivity('API connection test successful', 'success');
                alert('API connection test successful!');
            } else {
                this.logActivity('API connection test failed', 'error');
                alert('API connection test failed!');
            }
        } catch (error) {
            this.logActivity(`Connection test failed: ${error.message}`, 'error');
            alert('Connection test failed!');
        }
    }

    async getContacts() {
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey) {
            alert('Please enter your API key first');
            return;
        }

        this.logActivity('Fetching contacts...', 'info');

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/whatsapp/contacts?apiKey=${encodeURIComponent(apiKey)}&limit=10`);
            const data = await response.json();
            
            if (data.success) {
                let contactList = 'Contacts:\n\n';
                data.data.contacts.forEach(contact => {
                    contactList += `${contact.name} (${contact.id})\n`;
                });
                
                alert(contactList);
                this.logActivity(`Fetched ${data.data.contacts.length} contacts`, 'success');
            } else {
                this.logActivity(`Failed to fetch contacts: ${data.error}`, 'error');
                alert(`Failed to fetch contacts: ${data.error}`);
            }
        } catch (error) {
            this.logActivity(`Contact fetch failed: ${error.message}`, 'error');
            alert('Failed to fetch contacts!');
        }
    }

    loadStats() {
        // Simulate loading stats from localStorage or API
        const messagesSent = localStorage.getItem('messagesSent') || '0';
        const apiCalls = localStorage.getItem('apiCalls') || '0';
        
        document.getElementById('messagesSent').textContent = messagesSent;
        document.getElementById('apiCalls').textContent = apiCalls;
        
        // Simulate response time
        document.getElementById('responseTime').textContent = `${Math.floor(Math.random() * 200)}ms`;
    }

    updateStat(stat) {
        const element = document.getElementById(stat);
        if (element) {
            const current = parseInt(element.textContent) || 0;
            const newValue = current + 1;
            element.textContent = newValue;
            localStorage.setItem(stat, newValue.toString());
        }
    }

    logActivity(message, type = 'info') {
        const activityLog = document.getElementById('activityLog');
        const timestamp = new Date().toLocaleTimeString();
        
        let color = 'var(--light-gray)';
        if (type === 'success') color = 'var(--success)';
        if (type === 'error') color = 'var(--error)';
        if (type === 'warning') color = 'var(--warning)';
        
        const entry = document.createElement('div');
        entry.style.marginBottom = '0.5rem';
        entry.style.color = color;
        entry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
        
        activityLog.insertBefore(entry, activityLog.firstChild);
        
        // Limit to 10 entries
        if (activityLog.children.length > 10) {
            activityLog.removeChild(activityLog.lastChild);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});