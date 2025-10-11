// API service for backend communication
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

export const api = {
  // Get all alerts from MongoDB
  async getAlerts(limit = 100, skip = 0) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts?limit=${limit}&skip=${skip}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.alerts || [];
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      return [];
    }
  },

  // Get alert count
  async getAlertsCount() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts/count`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('Failed to fetch alert count:', error);
      return 0;
    }
  },

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
};

