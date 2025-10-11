export interface LogEntry {
  id: string;
  timestamp: string;
  sourceIp: string;
  hostname: string;
  logType: string;
  threatLevel: 'Low' | 'Moderate' | 'High';
  description: string;
  rawLog: string;
  classification?: 'Malicious' | 'Non-Malicious';
  isCorrect?: boolean;
}

export interface Alert {
  id: string;
  severity: 'Low' | 'Moderate' | 'High';
  title: string;
  description: string;
  timestamp: string;
  logId: string;
  acknowledged: boolean;
}

export interface MLFeedback {
  logId: string;
  originalClassification: 'Low' | 'Moderate' | 'High';
  correctedClassification: 'Malicious' | 'Non-Malicious';
  analystId: string;
  timestamp: string;
}