import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import { Alert } from '../types';
import { api } from '../services/api';

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'High': return 'bg-red-500 text-white';
    case 'Moderate': return 'bg-orange-500 text-white';
    case 'Low': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'High': return <AlertTriangle className="w-4 h-4" />;
    case 'Moderate': return <AlertTriangle className="w-4 h-4" />;
    case 'Low': return <CheckCircle className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
};

export function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch alerts from backend
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts(100);
      // Transform Wazuh alerts to Alert format
      const transformed = data
        .filter((alert: any) => alert.rule?.level >= 5) // Only show level 5+ as alerts
        .map((alert: any) => ({
          id: alert._id || alert.id,
          severity: alert.rule?.level >= 7 ? 'High' : alert.rule?.level >= 5 ? 'Moderate' : 'Low',
          title: alert.rule?.description || 'Security Alert',
          description: alert.rule?.description || alert.full_log?.substring(0, 150) || 'No details',
          fullDescription: alert.full_log || '',
          timestamp: alert.timestamp || alert.timestamp_raw || new Date().toISOString(),
          agentName: alert.agent?.name || alert.predecoder?.hostname || 'Unknown',
          logId: alert._id,
          acknowledged: false,
          // Map label from backend
          classification: alert.label === 'malicious' ? 'Malicious' : alert.label === 'safe' ? 'Non-Malicious' : undefined,
          _original: alert
        }));
      setAlerts(transformed);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
    toast.success('Alert acknowledged');
  };

  const handleIgnore = (alertId: string) => {
    setAlerts(prevAlerts =>
      prevAlerts.filter(alert => alert.id !== alertId)
    );
    toast.info('Alert ignored and removed');
  };

  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged);

  const alertCounts = {
    High: alerts.filter(alert => alert.severity === 'High' && !alert.acknowledged).length,
    Moderate: alerts.filter(alert => alert.severity === 'Moderate' && !alert.acknowledged).length,
    Low: alerts.filter(alert => alert.severity === 'Low' && !alert.acknowledged).length,
    Total: activeAlerts.length
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between">
        <div>
              <h1 className="text-2xl font-semibold">Security Alerts</h1>
              <p className="text-sm text-gray-600 mt-1">
                Monitor and manage security alerts
              </p>
            </div>
            <Button 
              onClick={loadAlerts} 
              disabled={loading}
              variant="outline"
              size="default"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Alert Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-b pb-6">
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Total Active</h3>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{alertCounts.Total}</div>
            <p className="text-xs text-gray-600 mt-1">Active alerts</p>
          </div>
          
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">High Severity</h3>
              <AlertTriangle className="w-5 h-5" />
        </div>
            <div className="text-2xl font-semibold">{alertCounts.High}</div>
            <p className="text-xs text-gray-600 mt-1">Critical threats</p>
      </div>

          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Moderate</h3>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{alertCounts.Moderate}</div>
            <p className="text-xs text-gray-600 mt-1">Warning level</p>
          </div>
          
          <div className="border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Low Severity</h3>
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-semibold">{alertCounts.Low}</div>
            <p className="text-xs text-gray-600 mt-1">Info level</p>
          </div>
      </div>

      {/* Active Alerts */}
        <div className="border overflow-hidden">
          <div className="border-b p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Active Alerts</h3>
              <span className="text-sm text-gray-600">
                {activeAlerts.length} {activeAlerts.length === 1 ? 'alert' : 'alerts'}
              </span>
            </div>
          </div>
          <div className="w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              <span className="text-sm text-gray-600">Loading alerts...</span>
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium mb-1">No active alerts</p>
              <p className="text-xs text-gray-600">Your system is secure</p>
            </div>
          ) : (
            <div className="w-full">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <colgroup>
                    <col className="w-[90px]" />
                    <col className="w-[200px]" />
                    <col className="w-auto" />
                    <col className="w-[110px]" />
                    <col className="w-[130px]" />
                    <col className="w-[200px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="font-medium whitespace-nowrap">Severity</TableHead>
                      <TableHead className="font-medium">Alert Title</TableHead>
                      <TableHead className="font-medium">Description</TableHead>
                      <TableHead className="font-medium whitespace-nowrap">Source</TableHead>
                      <TableHead className="font-medium whitespace-nowrap">Timestamp</TableHead>
                      <TableHead className="font-medium text-right whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {activeAlerts
                    .sort((a, b) => {
                      const severityOrder = { High: 3, Moderate: 2, Low: 1 };
                      return severityOrder[b.severity as keyof typeof severityOrder] - 
                             severityOrder[a.severity as keyof typeof severityOrder];
                    })
                    .map((alert) => (
                    <TableRow key={alert.id} className="border-b hover:bg-gray-50">
                      <TableCell className="py-4 align-top">
                        <Badge className={getSeverityColor(alert.severity)}>
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            {getSeverityIcon(alert.severity)}
                            <span className="text-xs font-semibold">{alert.severity}</span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <div className="font-medium text-sm line-clamp-2">{alert.title}</div>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <div className="text-sm text-gray-700 line-clamp-2" title={alert.description}>
                          {alert.description}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <div className="text-xs text-gray-600 truncate" title={alert.agentName || 'Unknown'}>
                          {alert.agentName || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <div className="font-mono text-xs text-gray-600 whitespace-nowrap">
                          {new Date(alert.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => handleAcknowledge(alert.id)}
                            title="Acknowledge alert"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            <span className="hidden sm:inline">Ack</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => handleIgnore(alert.id)}
                            title="Ignore alert"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            <span className="hidden sm:inline">Ignore</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => window.open(`#/dashboard?log=${alert.logId}`, '_blank')}
                            title="View log details"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </div>
          )}
            </div>
          </div>

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <div className="border overflow-hidden">
          <div className="border-b p-4 bg-gray-50">
            <h3 className="text-sm font-semibold">Acknowledged Alerts ({acknowledgedAlerts.length})</h3>
          </div>
          <div className="w-full">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <colgroup>
                  <col className="w-[90px]" />
                  <col className="w-[200px]" />
                  <col className="w-auto" />
                  <col className="w-[110px]" />
                  <col className="w-[130px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="font-medium whitespace-nowrap">Severity</TableHead>
                    <TableHead className="font-medium">Alert Title</TableHead>
                    <TableHead className="font-medium">Description</TableHead>
                    <TableHead className="font-medium whitespace-nowrap">Source</TableHead>
                    <TableHead className="font-medium whitespace-nowrap">Timestamp</TableHead>
                    <TableHead className="font-medium whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {acknowledgedAlerts.map((alert) => (
                  <TableRow key={alert.id} className="border-b opacity-60">
                    <TableCell className="py-4 align-top">
                      <Badge className={getSeverityColor(alert.severity)} variant="outline">
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <div className="font-medium text-sm line-clamp-2">{alert.title}</div>
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <div className="text-sm text-gray-700 line-clamp-2" title={alert.description}>
                        {alert.description}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <div className="text-xs text-gray-600 truncate" title={alert.agentName || 'Unknown'}>
                        {alert.agentName || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <div className="font-mono text-xs text-gray-600 whitespace-nowrap">
                        {new Date(alert.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-top">
                      <Badge variant="secondary" className="text-xs">Acknowledged</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}