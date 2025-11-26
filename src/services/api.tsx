// API service for backend communication
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8081';
const API_KEY = 'devkey'; // TODO: Move to env variable

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

  // Classify an alert as malicious or safe
  async classifyAlert(alertId: string, label: 'malicious' | 'safe') {
    try {
      const response = await fetch(`${API_BASE_URL}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          _id: alertId,
          label: label
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to classify alert:', error);
      throw error;
    }
  },

  // Get classification for an alert
  async getClassification(alertId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/classify/${alertId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get classification:', error);
      return null;
    }
  },

  // Evaluate ML model on labeled data
  async evaluateModel() {
    try {
      const response = await fetch(`${API_BASE_URL}/ml/evaluate`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to evaluate model:', error);
      return null;
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

