import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw, Save, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner@2.0.3';
import { LogEntry, MLFeedback } from '../types';
import { api } from '../services/api';

const getThreatLevelColor = (level: string) => {
  switch (level) {
    case 'High': return 'bg-red-500 text-white';
    case 'Moderate': return 'bg-orange-500 text-white';
    case 'Low': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

export function MLFeedback() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<MLFeedback[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch alerts from backend
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const alerts = await api.getAlerts(100);
      // Transform to log entry format
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
        _original: alert
      }));
      setLogs(transformed);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get logs that need correction (misclassified or unclassified)
  const logsNeedingCorrection = logs.filter(log => 
    !log.classification || log.isCorrect === false
  );

  const handleCorrection = (logId: string, correction: 'Malicious' | 'Non-Malicious') => {
    const log = logs.find(l => l.id === logId);
    if (!log) return;

    setLogs(prevLogs =>
      prevLogs.map(l =>
        l.id === logId ? { ...l, classification: correction, isCorrect: true } : l
      )
    );

    setFeedback(prevFeedback => {
      const existingIndex = prevFeedback.findIndex(f => f.logId === logId);
      const newFeedback: MLFeedback = {
        logId,
        originalClassification: log.threatLevel,
        correctedClassification: correction,
        analystId: 'analyst-1',
        timestamp: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        const updated = [...prevFeedback];
        updated[existingIndex] = newFeedback;
        return updated;
      } else {
        return [...prevFeedback, newFeedback];
      }
    });

    setHasUnsavedChanges(true);
  };

  const handleSaveFeedback = () => {
    // In a real application, this would send the feedback to the backend
    console.log('Saving ML feedback:', feedback);
    toast.success(`Saved ${feedback.length} feedback entries for model retraining`);
    setFeedback([]);
    setHasUnsavedChanges(false);
  };

  const handleResetFeedback = () => {
    setFeedback([]);
    setHasUnsavedChanges(false);
    toast.info('Feedback reset');
  };

  const correctClassifications = logs.filter(log => log.isCorrect === true).length;
  const incorrectClassifications = logs.filter(log => log.isCorrect === false).length;
  const unclassifiedLogs = logs.filter(log => !log.classification).length;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">ML Model Feedback</h1>
          <p className="text-muted-foreground mt-2 text-base">Review and correct ML model classifications to improve accuracy</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={loadAlerts} disabled={loading} variant="outline" className="h-10 px-5 shadow-sm hover:shadow-md transition-shadow">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          {hasUnsavedChanges && (
            <>
              <Button variant="outline" onClick={handleResetFeedback} className="h-10 px-5 shadow-sm hover:shadow-md transition-shadow">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSaveFeedback} className="h-10 px-5 shadow-lg bg-gradient-to-r from-primary to-primary/90 hover:shadow-xl transition-all">
                <Save className="w-4 h-4 mr-2" />
                Save Feedback ({feedback.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Model Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-green-500 bg-gradient-to-br from-card to-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Correct Classifications</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold text-green-600 mb-1">{correctClassifications}</div>
            <p className="text-sm text-muted-foreground">
              {((correctClassifications / logs.length) * 100).toFixed(1)}% accuracy
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-red-500 bg-gradient-to-br from-card to-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Incorrect Classifications</CardTitle>
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold text-red-600 mb-1">{incorrectClassifications}</div>
            <p className="text-sm text-muted-foreground">Need correction</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-orange-500 bg-gradient-to-br from-card to-orange-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Unclassified</CardTitle>
            <div className="p-2 bg-orange-100 rounded-lg">
              <RotateCcw className="w-5 h-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-4xl font-bold text-orange-600 mb-1">{unclassifiedLogs}</div>
            <p className="text-sm text-muted-foreground">Awaiting classification</p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Queue */}
      {hasUnsavedChanges && (
        <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-lg">
          <CardHeader className="pb-4 bg-gradient-to-r from-orange-100/50 to-orange-50">
            <CardTitle className="text-orange-900 text-lg font-bold flex items-center gap-2">
              <div className="p-2 bg-orange-200 rounded-lg">
                <Save className="w-5 h-5 text-orange-700" />
              </div>
              Pending Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedback.map((f, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-orange-200 shadow-sm hover:shadow-md transition-all">
                  <span className="font-semibold text-foreground">Log {f.logId}: {f.originalClassification} → {f.correctedClassification}</span>
                  <Badge className="bg-orange-100 text-orange-700 border-2 border-orange-300 px-3 py-1.5 font-semibold shadow-sm">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Needing Correction */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-4 bg-gradient-to-r from-card to-accent/10">
          <CardTitle className="text-lg font-semibold">Logs Requiring Review ({logsNeedingCorrection.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading alerts from database...</span>
            </div>
          ) : logsNeedingCorrection.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-16 h-16 mx-auto mb-6 text-green-500" />
              <h3 className="text-lg font-medium mb-2">All logs have been properly classified!</h3>
              <p>The ML model is performing well.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2">
                    <TableHead className="py-4 font-medium">Timestamp</TableHead>
                    <TableHead className="py-4 font-medium">Source</TableHead>
                    <TableHead className="py-4 font-medium">ML Prediction</TableHead>
                    <TableHead className="py-4 font-medium">Description</TableHead>
                    <TableHead className="py-4 font-medium">Current Status</TableHead>
                    <TableHead className="py-4 font-medium">Correct Classification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsNeedingCorrection.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono py-4">{log.timestamp}</TableCell>
                      <TableCell className="py-4">
                        <div className="space-y-1">
                          <div className="font-medium">{log.sourceIp}</div>
                          <div className="text-sm text-muted-foreground">{log.hostname}</div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={getThreatLevelColor(log.threatLevel) + " px-3 py-1"}>
                          {log.threatLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-sm py-4">
                        <div className="truncate" title={log.description}>
                          {log.description}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {log.classification ? (
                          <Badge variant={log.isCorrect === false ? 'destructive' : 'secondary'} className="px-3 py-1">
                            {log.classification} {log.isCorrect === false && '(Incorrect)'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="px-3 py-1">Unclassified</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                            onClick={() => handleCorrection(log.id, 'Malicious')}
                          >
                            <XCircle className="w-3 h-3 mr-2" />
                            Malicious
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50 h-8"
                            onClick={() => handleCorrection(log.id, 'Non-Malicious')}
                          >
                            <CheckCircle className="w-3 h-3 mr-2" />
                            Safe
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training History */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="bg-gradient-to-r from-card to-accent/10">
          <CardTitle className="text-lg font-semibold">Recent Training Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:shadow-md hover:border-primary/30 transition-all bg-gradient-to-r from-card to-accent/5">
              <div>
                <p className="font-semibold">Model retrain #47</p>
                <p className="text-sm text-muted-foreground">15 corrections applied • 2024-01-15 10:30</p>
              </div>
              <Badge className="bg-green-100 text-green-700 border border-green-200 px-3 py-1 font-medium">Completed</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:shadow-md hover:border-primary/30 transition-all bg-gradient-to-r from-card to-accent/5">
              <div>
                <p className="font-semibold">Model retrain #46</p>
                <p className="text-sm text-muted-foreground">23 corrections applied • 2024-01-14 16:45</p>
              </div>
              <Badge className="bg-green-100 text-green-700 border border-green-200 px-3 py-1 font-medium">Completed</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:shadow-md hover:border-primary/30 transition-all bg-gradient-to-r from-card to-accent/5">
              <div>
                <p className="font-semibold">Model retrain #45</p>
                <p className="text-sm text-muted-foreground">8 corrections applied • 2024-01-14 09:15</p>
              </div>
              <Badge className="bg-green-100 text-green-700 border border-green-200 px-3 py-1 font-medium">Completed</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}