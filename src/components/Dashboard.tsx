import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Eye, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { LogEntry } from '../types';
import { api } from '../services/api';

const getThreatLevelColor = (level: string) => {
  switch (level) {
    case 'High': return 'bg-red-500 text-white';
    case 'Moderate': return 'bg-orange-500 text-white';
    case 'Low': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getThreatLevelIcon = (level: string) => {
  switch (level) {
    case 'High': return <AlertTriangle className="w-4 h-4" />;
    case 'Moderate': return <AlertTriangle className="w-4 h-4" />;
    case 'Low': return <CheckCircle className="w-4 h-4" />;
    default: return null;
  }
};

export function Dashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [threatFilter, setThreatFilter] = useState<string>('all');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Fetch alerts from backend
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const alerts = await api.getAlerts(100);
      // Transform Wazuh alerts to frontend format
      const transformed = alerts.map((alert: any) => ({
        id: alert._id || alert.id,
        timestamp: alert.timestamp || alert.timestamp_raw || new Date().toISOString(),
        sourceIp: alert.agent?.ip || alert.data?.srcip || '-',
        hostname: alert.agent?.name || alert.predecoder?.hostname || '-',
        logType: alert.decoder?.name || alert.location || 'Unknown',
        threatLevel: alert.rule?.level >= 7 ? 'High' : alert.rule?.level >= 4 ? 'Moderate' : 'Low',
        description: alert.rule?.description || alert.full_log?.substring(0, 100) || 'No description',
        rawLog: alert.full_log || JSON.stringify(alert, null, 2),
        classification: undefined,
        isCorrect: undefined,
        // Keep original alert data
        _original: alert
      }));
      setLogs(transformed);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.sourceIp.includes(searchTerm) ||
                           log.hostname.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesThreat = threatFilter === 'all' || log.threatLevel === threatFilter;
      const matchesType = logTypeFilter === 'all' || log.logType === logTypeFilter;
      
      return matchesSearch && matchesThreat && matchesType;
    });
  }, [logs, searchTerm, threatFilter, logTypeFilter]);

  const handleClassification = (logId: string, classification: 'Malicious' | 'Non-Malicious') => {
    setLogs(prevLogs =>
      prevLogs.map(log =>
        log.id === logId ? { ...log, classification } : log
      )
    );
  };

  const logTypes = [...new Set(logs.map(log => log.logType))];

  const threatCounts = {
    High: logs.filter(log => log.threatLevel === 'High').length,
    Moderate: logs.filter(log => log.threatLevel === 'Moderate').length,
    Low: logs.filter(log => log.threatLevel === 'Low').length
  };

  return (
    <div className="p-8 space-y-8" style={{ animation: 'slide-in 0.5s ease-out' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Security Dashboard</h1>
          <p className="text-muted-foreground mt-3 text-lg font-medium">Monitor and analyze security logs with ML-powered threat detection</p>
        </div>
        <Button 
          onClick={loadAlerts} 
          disabled={loading} 
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/30 hover:shadow-2xl transition-all duration-300 px-6 h-12 rounded-xl font-semibold"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Threat Level Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden group hover:scale-105 transition-all duration-300 border-0 shadow-xl hover:shadow-2xl" style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.1) 100%)',
          borderLeft: '4px solid rgb(239, 68, 68)'
        }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
            <CardTitle className="text-base font-bold text-foreground">High Threats</CardTitle>
            <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform duration-300">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 relative z-10">
            <div className="text-5xl font-black text-red-600 mb-2">{threatCounts.High}</div>
            <p className="text-sm text-muted-foreground font-semibold">Requires immediate attention</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden group hover:scale-105 transition-all duration-300 border-0 shadow-xl hover:shadow-2xl" style={{
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, rgba(249, 115, 22, 0.1) 100%)',
          borderLeft: '4px solid rgb(249, 115, 22)'
        }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
            <CardTitle className="text-base font-bold text-foreground">Moderate Threats</CardTitle>
            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform duration-300">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 relative z-10">
            <div className="text-5xl font-black text-orange-600 mb-2">{threatCounts.Moderate}</div>
            <p className="text-sm text-muted-foreground font-semibold">Monitor closely</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden group hover:scale-105 transition-all duration-300 border-0 shadow-xl hover:shadow-2xl" style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.1) 100%)',
          borderLeft: '4px solid rgb(34, 197, 94)'
        }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
            <CardTitle className="text-base font-bold text-foreground">Low Threats</CardTitle>
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform duration-300">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 relative z-10">
            <div className="text-5xl font-black text-green-600 mb-2">{threatCounts.Low}</div>
            <p className="text-sm text-muted-foreground font-semibold">Routine monitoring</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="glass-effect border-primary/20 shadow-xl">
        <CardHeader className="pb-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
          <CardTitle className="flex items-center gap-3 text-lg font-bold">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Filter className="w-5 h-5 text-white" />
            </div>
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col md:flex-row gap-5">
            <div className="flex-1">
              <div className="relative group">
                <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search by description, IP, or hostname..."
                  className="pl-12 h-14 text-base border-2 border-primary/20 focus:border-primary rounded-xl shadow-sm focus:shadow-lg transition-all duration-300 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={threatFilter} onValueChange={setThreatFilter}>
              <SelectTrigger className="w-[200px] h-14 border-2 border-primary/20 focus:border-primary rounded-xl shadow-sm focus:shadow-lg transition-all duration-300 font-semibold bg-white">
                <SelectValue placeholder="Threat Level" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-2xl">
                <SelectItem value="all">All Threats</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Moderate">Moderate</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
              <SelectTrigger className="w-[220px] h-14 border-2 border-primary/20 focus:border-primary rounded-xl shadow-sm focus:shadow-lg transition-all duration-300 font-semibold bg-white">
                <SelectValue placeholder="Log Type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-2xl">
                <SelectItem value="all">All Types</SelectItem>
                {logTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="glass-effect border-primary/20 shadow-xl">
        <CardHeader className="pb-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
          <CardTitle className="text-xl font-bold">Security Logs ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading alerts from database...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-orange-500" />
              <h3 className="text-lg font-medium mb-2">No alerts found</h3>
              <p>Send some alerts to the backend to see them here.</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2">
                  <TableHead className="py-4 font-medium">Timestamp</TableHead>
                  <TableHead className="py-4 font-medium">Source</TableHead>
                  <TableHead className="py-4 font-medium">Log Type</TableHead>
                  <TableHead className="py-4 font-medium">Threat Level</TableHead>
                  <TableHead className="py-4 font-medium">Description</TableHead>
                  <TableHead className="py-4 font-medium">Classification</TableHead>
                  <TableHead className="py-4 font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono py-4">{log.timestamp}</TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-1">
                        <div className="font-medium">{log.sourceIp}</div>
                        <div className="text-sm text-muted-foreground">{log.hostname}</div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="px-3 py-1">
                        {log.logType}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge className={getThreatLevelColor(log.threatLevel)}>
                        <div className="flex items-center gap-2">
                          {getThreatLevelIcon(log.threatLevel)}
                          {log.threatLevel}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-sm py-4">
                      <div className="truncate" title={log.description}>
                        {log.description}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {log.classification ? (
                        <Badge variant={log.classification === 'Malicious' ? 'destructive' : 'secondary'} className="px-3 py-1">
                          {log.classification}
                        </Badge>
                      ) : (
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                            onClick={() => handleClassification(log.id, 'Malicious')}
                          >
                            <XCircle className="w-3 h-3 mr-2" />
                            Malicious
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50 h-8"
                            onClick={() => handleClassification(log.id, 'Non-Malicious')}
                          >
                            <CheckCircle className="w-3 h-3 mr-2" />
                            Safe
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-4"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Details
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader className="pb-6">
                          <DialogTitle className="text-xl">Log Details</DialogTitle>
                        </DialogHeader>
                        {selectedLog && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="font-medium">Timestamp</label>
                                <p className="font-mono text-sm bg-muted p-3 rounded">{selectedLog.timestamp}</p>
                              </div>
                              <div className="space-y-2">
                                <label className="font-medium">Source IP</label>
                                <p className="text-sm bg-muted p-3 rounded">{selectedLog.sourceIp}</p>
                              </div>
                              <div className="space-y-2">
                                <label className="font-medium">Hostname</label>
                                <p className="text-sm bg-muted p-3 rounded">{selectedLog.hostname}</p>
                              </div>
                              <div className="space-y-2">
                                <label className="font-medium">Log Type</label>
                                <p className="text-sm bg-muted p-3 rounded">{selectedLog.logType}</p>
                              </div>
                              <div className="space-y-2">
                                <label className="font-medium">Threat Level</label>
                                <div className="flex items-start">
                                  <Badge className={getThreatLevelColor(selectedLog.threatLevel) + " px-3 py-2"}>
                                    <div className="flex items-center gap-2">
                                      {getThreatLevelIcon(selectedLog.threatLevel)}
                                      {selectedLog.threatLevel}
                                    </div>
                                  </Badge>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="font-medium">Classification</label>
                                <p className="text-sm bg-muted p-3 rounded">{selectedLog.classification || 'Unclassified'}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="font-medium">Description</label>
                              <p className="text-sm bg-muted p-4 rounded leading-relaxed">{selectedLog.description}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="font-medium">Raw Log</label>
                              <pre className="bg-muted p-4 rounded text-sm overflow-x-auto leading-relaxed border">
                                {selectedLog.rawLog}
                              </pre>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}