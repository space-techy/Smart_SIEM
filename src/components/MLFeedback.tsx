import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw, Save, RefreshCw, Clock } from 'lucide-react';
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

const getMLScoreColor = (score: number) => {
  // Score is 0.00-10.00, color code from green (0) to red (10)
  if (score >= 8.0) return 'bg-red-500 text-white';
  if (score >= 6.0) return 'bg-orange-500 text-white';
  if (score >= 4.0) return 'bg-yellow-500 text-white';
  if (score >= 2.0) return 'bg-blue-500 text-white';
  return 'bg-green-500 text-white';
};

export function MLFeedback() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<MLFeedback[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [mlMetrics, setMlMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Fetch alerts and ML metrics from backend
  useEffect(() => {
    loadAlerts();
    loadMLMetrics();
  }, []);

  const loadMLMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const metrics = await api.evaluateModel();
      if (metrics && metrics.ok) {
        setMlMetrics(metrics);
        console.log('[ML METRICS]', metrics);
      }
    } catch (error) {
      console.error('Failed to load ML metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

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
        // Map label from backend to classification
        classification: alert.label === 'malicious' ? 'Malicious' : alert.label === 'safe' ? 'Non-Malicious' : undefined,
        isCorrect: alert.label ? true : undefined,
        // ML Prediction data
        mlScore: alert.predicted_score != null ? (alert.predicted_score * 10).toFixed(2) : null,
        mlLabel: alert.predicted_label || null,
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

  const handleCorrection = async (logId: string, correction: 'Malicious' | 'Non-Malicious') => {
    const log = logs.find(l => l.id === logId);
    if (!log) return;

    const label = correction === 'Malicious' ? 'malicious' : 'safe';

    try {
      // Update UI immediately
    setLogs(prevLogs =>
      prevLogs.map(l =>
          l.id === logId ? { ...l, classification: correction, isCorrect: true, classifying: true } : l
      )
    );

      // Send to backend
      await api.classifyAlert(logId, label);

      // Update feedback
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
      
      // Update with success
      setLogs(prevLogs =>
        prevLogs.map(l =>
          l.id === logId ? { ...l, classifying: false } : l
        )
      );
      
      console.log(`Alert ${logId} classified as ${label}`);
    } catch (error) {
      console.error('Classification failed:', error);
      // Revert on error
      setLogs(prevLogs =>
        prevLogs.map(l =>
          l.id === logId ? { ...l, classification: undefined, isCorrect: undefined, classifying: false } : l
        )
      );
      alert('Failed to classify alert. Please try again.');
    }
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

  // Use real ML metrics if available, otherwise fallback to UI state
  const correctClassifications = mlMetrics?.metrics?.correct || logs.filter(log => log.isCorrect === true).length;
  const incorrectClassifications = mlMetrics?.metrics?.incorrect || logs.filter(log => log.isCorrect === false).length;
  const unclassifiedLogs = logs.filter(log => !log.classification).length;
  const totalEvaluated = mlMetrics?.evaluated || logs.length;
  const accuracy = mlMetrics?.metrics?.accuracy || (correctClassifications / (correctClassifications + incorrectClassifications || 1));

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">ML Model Feedback</h1>
          <p className="text-muted-foreground">Review ML classifications</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAlerts} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {hasUnsavedChanges && (
            <>
              <Button variant="outline" onClick={handleResetFeedback} size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSaveFeedback} size="sm">
                <Save className="w-4 h-4 mr-2" />
                Save ({feedback.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Model Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetrics ? '...' : `${(accuracy * 100).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {mlMetrics ? 'From MongoDB' : 'UI only'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Correct</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{correctClassifications}</div>
            <p className="text-xs text-muted-foreground">Predictions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incorrect</CardTitle>
            <XCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incorrectClassifications}</div>
            <p className="text-xs text-muted-foreground">
              {mlMetrics?.metrics?.f1_score ? `F1: ${(mlMetrics.metrics.f1_score * 100).toFixed(0)}%` : 'Errors'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unclassified</CardTitle>
            <RotateCcw className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unclassifiedLogs}</div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed ML Metrics */}
      {mlMetrics && mlMetrics.metrics && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Model Performance (Evaluated on {mlMetrics.evaluated} alerts)</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={loadMLMetrics}
                disabled={loadingMetrics}
              >
                <RefreshCw className={`w-3 h-3 ${loadingMetrics ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Accuracy</div>
                <div className="text-2xl font-bold">{(mlMetrics.metrics.accuracy * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Precision</div>
                <div className="text-2xl font-bold">{(mlMetrics.metrics.precision * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Recall</div>
                <div className="text-2xl font-bold">{(mlMetrics.metrics.recall * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">F1 Score</div>
                <div className="text-2xl font-bold">{(mlMetrics.metrics.f1_score * 100).toFixed(1)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Queue */}
      {hasUnsavedChanges && (
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Pending Feedback ({feedback.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feedback.map((f, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                  <span className="text-sm">Log {f.logId.substring(0, 10)}... : {f.originalClassification} → {f.correctedClassification}</span>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Needing Correction */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Logs Requiring Review ({logsNeedingCorrection.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading...</span>
            </div>
          ) : logsNeedingCorrection.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-sm">All logs classified</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2">
                    <TableHead className="py-4 font-medium">Timestamp</TableHead>
                    <TableHead className="py-4 font-medium">Source</TableHead>
                    <TableHead className="py-4 font-medium">ML Score</TableHead>
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
                        {log.mlScore ? (
                          <Badge className={getMLScoreColor(parseFloat(log.mlScore))}>
                            {log.mlScore}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
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
                          <Badge 
                            variant={log.classification === 'Malicious' ? 'destructive' : 'secondary'} 
                            className="px-3 py-1"
                          >
                            {log.classification === 'Malicious' ? (
                              <><XCircle className="w-3 h-3 mr-1" /> Malicious</>
                            ) : (
                              <><CheckCircle className="w-3 h-3 mr-1" /> Safe</>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="px-3 py-1">Unclassified</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {log.classification ? (
                        <div className="flex flex-col gap-2 min-w-[160px]">
                            <Badge 
                              variant="secondary" 
                              className="px-3 py-2 justify-center"
                            >
                              {log.classification === 'Malicious' ? (
                                <><XCircle className="w-3 h-3 mr-1" /> Marked as Malicious</>
                              ) : (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Marked as Safe</>
                              )}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className={
                                log.classification === 'Malicious' 
                                  ? "text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 h-9 font-medium transition-all"
                                  : "text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-9 font-medium transition-all"
                              }
                              onClick={() => handleCorrection(
                                log.id, 
                                log.classification === 'Malicious' ? 'Non-Malicious' : 'Malicious'
                              )}
                              disabled={log.classifying}
                            >
                              {log.classification === 'Malicious' ? (
                                <><CheckCircle className="w-3.5 h-3.5 mr-2" /> Change to Safe</>
                              ) : (
                                <><XCircle className="w-3.5 h-3.5 mr-2" /> Change to Malicious</>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCorrection(log.id, 'Malicious')}
                              disabled={log.classifying}
                          >
                            Malicious
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCorrection(log.id, 'Non-Malicious')}
                              disabled={log.classifying}
                          >
                            Safe
                          </Button>
                        </div>
                        )}
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