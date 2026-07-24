import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  ClinicalPipelineService, 
  AgentOutput, 
  AuditResult 
} from '../../core/services/clinical-pipeline.service';
import { PipelineFlowComponent } from './components/pipeline-flow/pipeline-flow.component';
import { TrustScoreCardComponent } from './components/trust-score-card/trust-score-card.component';

interface StatCard {
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'flat';
  icon: string;
  color: string;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  time: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    PipelineFlowComponent, 
    TrustScoreCardComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // State for Pipeline Auditing
  selectedPatientId = 'P-4821';
  encounterNote = '';
  isProcessing = false;
  runCompleted = false;
  activeAgentName = '';
  
  agentsState: AgentOutput[] = [];
  auditResult: AuditResult | null = null;
  errorMessage = '';

  // Patient Case Templates for one-click loading
  readonly patientTemplates = [
    {
      id: 'P-4821',
      name: 'Sarah Mitchell (Hypertension / DM2)',
      note: 'Patient is a 52yo female with Type-2 Diabetes Mellitus and newly diagnosed Stage-2 Essential Hypertension. Active medication list includes Metformin 500mg BID. She presents today for blood pressure review. BP in clinic is 152/94. Patient reports a history of severe dry cough and lip swelling (angioedema-like reaction) during a past brief trial of Lisinopril. Requesting alternative therapeutic recommendation that preserves renal protection for diabetic nephropathy.'
    },
    {
      id: 'P-3301',
      name: 'James Okafor (Post-op Cardiac / Anticoag)',
      note: '67yo male patient status-post surgical aortic valve replacement. Rhythm stable on telemetry. Home medications: Warfarin 5mg daily, Metformin 500mg BID, and Atorvastatin 20mg daily. Patient complains of moderate lower back pain. Requests advice on taking Aspirin 325mg or Ibuprofen 400mg for pain control. Need checking for potential major drug interactions and risk warnings.'
    },
    {
      id: 'P-2199',
      name: 'Elena Vasquez (Glycemic Control review)',
      note: '44yo female patient with Type-2 Diabetes, HbA1c is currently 7.8% (down from 9.2% last quarter). Home metformin compliance is excellent. Reports no active symptoms. Seeking evidence-based treatment optimization and guideline validation for second-line diabetic therapies in a patient without established cardiovascular disease.'
    }
  ];

  // Core stats for top panel
  readonly stats: StatCard[] = [
    { label: 'Total Patients',      value: 1284, change: '+12 this week',       trend: 'up', icon: '👥', color: '#1F6F63' },
    { label: 'Active Cases',         value: 47,   change: '+3 today',             trend: 'up', icon: '🏥', color: '#3A9D8F' },
    { label: 'AI Queries Today',     value: 234,  change: '+18% vs yesterday',    trend: 'up', icon: '🧠', color: '#E76F51' },
    { label: 'Evidence Documents',   value: 8432, change: '156 indexed today',    trend: 'up', icon: '📚', color: '#457B9D' },
  ];

  readonly recentActivity: ActivityItem[] = [
    { id: '1', type: 'DIAGNOSIS', description: 'AI differential diagnosis completed for Patient #P-4821',         time: '2 min ago',  icon: '🔬' },
    { id: '2', type: 'NOTE',      description: 'Dr. Chen signed clinical note for Sarah Johnson',                 time: '8 min ago',  icon: '📝' },
    { id: '3', type: 'ALERT',     description: 'Drug interaction alert: Warfarin + Aspirin flagged',              time: '15 min ago', icon: '⚠️' },
    { id: '4', type: 'RESEARCH',  description: 'New clinical trial match: NCT04891549 for Patient #P-2199',     time: '23 min ago', icon: '📊' },
  ];

  readonly systemStatus = [
    { name: 'PostgreSQL',         status: 'online',  latency: '14ms'  },
    { name: 'Qdrant Vector DB',   status: 'online',  latency: '6ms'   },
    { name: 'Groq AI Engine',     status: 'online',  latency: '280ms' },
    { name: 'HuggingFace Embeds', status: 'online',  latency: '190ms' },
  ];

  constructor(private pipelineService: ClinicalPipelineService) {}

  ngOnInit(): void {
    // Load default patient note
    this.loadPatientTemplate(this.selectedPatientId);
  }

  loadPatientTemplate(patientId: string): void {
    const template = this.patientTemplates.find(t => t.id === patientId);
    if (template) {
      this.selectedPatientId = patientId;
      this.encounterNote = template.note;
      this.runCompleted = false;
      this.auditResult = null;
      this.agentsState = [];
    }
  }

  runClinicalAudit(): void {
    if (!this.encounterNote.trim() || this.isProcessing) return;

    this.isProcessing = true;
    this.runCompleted = false;
    this.auditResult = null;
    this.errorMessage = '';
    
    this.pipelineService.runPipeline(this.selectedPatientId, this.encounterNote)
      .subscribe({
        next: (event) => {
          this.agentsState = event.agents;
          this.activeAgentName = event.activeAgentId 
            ? this.agentsState.find(a => a.id === event.activeAgentId)?.name || ''
            : '';

          if (event.status === 'completed') {
            this.isProcessing = false;
            this.runCompleted = true;
            this.auditResult = event.auditResult || null;
          }
        },
        error: (err) => {
          this.isProcessing = false;
          this.errorMessage = err || 'An unexpected error occurred during the clinical audit run.';
        }
      });
  }

  getActivityTypeColor(type: string): string {
    const map: Record<string, string> = {
      DIAGNOSIS: '#1F6F63',
      NOTE:      '#3A9D8F',
      ALERT:     '#E76F51',
      RESEARCH:  '#457B9D',
    };
    return map[type] ?? '#6B7280';
  }
}

