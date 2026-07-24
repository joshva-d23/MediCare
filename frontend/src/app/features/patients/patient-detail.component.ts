import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phoneNumber?: string;
  bloodGroup?: string;
  allergies: string[];
  chronicConditions: string[];
}

interface EHRRecord {
  id: string;
  recordType: string;
  title: string;
  description?: string;
  data: any;
  recordDate: string;
}

interface ClinicalNote {
  id: string;
  noteType: string;
  title: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  doctorName: string;
  createdAt: string;
}

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="feature-page animate-fade-in-up">

      <div class="page-header">
        <div class="page-header-content">
          <a routerLink="/patients" class="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Patients Registry
          </a>
          <div class="page-header-icon" style="background:linear-gradient(135deg,#0ea5e9,#0891b2)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <h1 class="page-title">Patient Clinical Chart</h1>
            <p class="page-subtitle">{{ patient?.firstName }} {{ patient?.lastName }} — MRN: {{ patient?.mrn }}</p>
          </div>
        </div>
        <div class="page-header-actions">
          <button class="btn-ghost-sm" (click)="openNoteModal()">📝 Add Clinical Note</button>
          <button class="btn-primary-sm" (click)="openRecordModal()">⊕ Log Vitals / Meds</button>
        </div>
      </div>

      <div class="detail-grid" *ngIf="patient">
        <!-- Profile Column -->
        <div class="detail-profile glass">
          <div class="profile-avatar" [style.background]="getAvatarColor()">
            {{ getInitials() }}
          </div>
          <h2 class="profile-name">{{ patient.firstName }} {{ patient.lastName }}</h2>
          <p class="profile-id">MRN: {{ patient.mrn }}</p>
          <span class="status-badge status-stable">
            <span class="vital-pulse-dot"></span> Authorized EHR
          </span>
          <div class="profile-stats">
            <div class="pstat"><div class="pstat-val">{{ calculateAge(patient.dateOfBirth) }}</div><div class="pstat-lbl">Age</div></div>
            <div class="pstat"><div class="pstat-val">{{ patient.gender.charAt(0) }}</div><div class="pstat-lbl">Gender</div></div>
            <div class="pstat"><div class="pstat-val">{{ patient.bloodGroup || '—' }}</div><div class="pstat-lbl">Blood</div></div>
          </div>
          <div class="profile-meta-details">
            <p><strong>Phone:</strong> {{ patient.phoneNumber || '—' }}</p>
            <div class="warning-section">
              <strong>Allergies:</strong>
              <div class="warning-tags">
                <span *ngFor="let a of patient.allergies" class="w-tag allergy">⚠️ {{ a }}</span>
                <span *ngIf="patient.allergies.length === 0" class="w-tag-none">None reported</span>
              </div>
            </div>
            <div class="warning-section">
              <strong>Chronic Conditions:</strong>
              <div class="warning-tags">
                <span *ngFor="let c of patient.chronicConditions" class="w-tag condition">📋 {{ c }}</span>
                <span *ngIf="patient.chronicConditions.length === 0" class="w-tag-none">None reported</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Info Column -->
        <div class="detail-info-col">
          <!-- Vitals -->
          <div class="info-card glass">
            <div class="info-card-title">Vitals Tracker</div>
            <div class="vitals-grid">
              <div class="vital-item">
                <div class="vital-label">Blood Pressure</div>
                <div class="vital-value" [class.vital-alert]="isBPAlert(vitals.bp)">{{ vitals.bp || '—' }}</div>
                <div class="vital-unit">mmHg</div>
              </div>
              <div class="vital-item">
                <div class="vital-label">Heart Rate</div>
                <div class="vital-value">{{ vitals.hr ? vitals.hr + ' bpm' : '—' }}</div>
                <div class="vital-unit">Pulse</div>
              </div>
              <div class="vital-item">
                <div class="vital-label">SpO₂</div>
                <div class="vital-value" [class.vital-alert]="vitals.spo2 && vitals.spo2 < 95">{{ vitals.spo2 ? vitals.spo2 + '%' : '—' }}</div>
                <div class="vital-unit">Oxygen Sat</div>
              </div>
              <div class="vital-item">
                <div class="vital-label">Temperature</div>
                <div class="vital-value">{{ vitals.temp ? vitals.temp + ' °F' : '—' }}</div>
                <div class="vital-unit">Body Temp</div>
              </div>
              <div class="vital-item">
                <div class="vital-label">Respiratory Rate</div>
                <div class="vital-value">{{ vitals.rr ? vitals.rr + ' /min' : '—' }}</div>
                <div class="vital-unit">Breaths</div>
              </div>
            </div>
          </div>

          <!-- Medications -->
          <div class="info-card glass">
            <div class="info-card-title">Active Prescriptions</div>
            <div class="med-list">
              <div class="med-item" *ngFor="let m of medications">
                <div class="med-dot">💊</div>
                <div class="med-body">
                  <div class="med-name">{{ m.title }}</div>
                  <div class="med-dose">{{ m.data?.dosage }} — {{ m.data?.frequency }} (Route: {{ m.data?.route || 'Oral' }})</div>
                </div>
              </div>
              <div class="table-empty" style="padding: 10px;" *ngIf="medications.length === 0">
                <p>No active medications prescribed.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Notes Section -->
        <div class="info-card glass" style="grid-column: 1 / 3;">
          <div class="info-card-title">Clinical SOAP & Progress Notes</div>
          <div class="notes-list">
            <div class="note-item" *ngFor="let n of notes">
              <div class="note-header">
                <span class="note-type" [class]="n.noteType">{{ n.noteType }} — {{ n.title }}</span>
                <span class="note-date">{{ formatDate(n.createdAt) }}</span>
              </div>
              <div class="note-body">
                <p *ngIf="n.subjective"><strong>Subjective:</strong> {{ n.subjective }}</p>
                <p *ngIf="n.objective"><strong>Objective:</strong> {{ n.objective }}</p>
                <p *ngIf="n.assessment"><strong>Assessment:</strong> {{ n.assessment }}</p>
                <p *ngIf="n.plan"><strong>Plan:</strong> {{ n.plan }}</p>
              </div>
              <span class="note-author">Authorized Signoff: {{ n.doctorName }}</span>
            </div>
            <div class="table-empty" *ngIf="notes.length === 0">
              <p>No clinical notes documented for this patient.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ADD CLINICAL NOTE MODAL -->
      <div class="modal-overlay" *ngIf="showNoteModal" (click)="closeNoteModal()">
        <div class="modal-card glass" style="max-width: 620px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add Clinical Note (SOAP)</h3>
            <button class="modal-close-btn" (click)="closeNoteModal()">×</button>
          </div>
          <form (submit)="submitNote($event)" class="modal-form">
            <div class="form-row-2">
              <div class="form-group">
                <label>Note Type *</label>
                <select required class="form-control-premium" [(ngModel)]="newNote.noteType" name="noteType">
                  <option value="SOAP">SOAP Note</option>
                  <option value="PROGRESS">Progress Note</option>
                  <option value="ADMISSION">Admission Note</option>
                  <option value="DISCHARGE">Discharge Summary</option>
                </select>
              </div>
              <div class="form-group">
                <label>Title *</label>
                <input required class="form-control-premium" [(ngModel)]="newNote.title" name="title" placeholder="e.g. Cardiology Follow-up" />
              </div>
            </div>

            <div class="form-group">
              <label>Subjective (Patient concerns, history)</label>
              <textarea class="form-control-premium text-area-clinical" [(ngModel)]="newNote.subjective" name="subjective" placeholder="e.g. Patient reports minor headaches..."></textarea>
            </div>

            <div class="form-group">
              <label>Objective (Vitals, physical exams, findings)</label>
              <textarea class="form-control-premium text-area-clinical" [(ngModel)]="newNote.objective" name="objective" placeholder="e.g. BP 130/85, HR 72, lungs clear..."></textarea>
            </div>

            <div class="form-group">
              <label>Assessment (Diagnoses, reasoning)</label>
              <textarea class="form-control-premium text-area-clinical" [(ngModel)]="newNote.assessment" name="assessment" placeholder="e.g. Hypertension controlled on Lisinopril..."></textarea>
            </div>

            <div class="form-group">
              <label>Plan (Treatment, orders, follow-up)</label>
              <textarea class="form-control-premium text-area-clinical" [(ngModel)]="newNote.plan" name="plan" placeholder="e.g. Continue meds, follow up in 3 months..."></textarea>
            </div>

            <div class="form-group">
              <label>Doctor / Nurse Name *</label>
              <input required class="form-control-premium" [(ngModel)]="newNote.doctorName" name="doctorName" placeholder="Dr. Evelyn Chen" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeNoteModal()">Cancel</button>
              <button type="submit" class="btn-primary">Sign & Save Note</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ADD EHR RECORD (VITALS / MEDS) MODAL -->
      <div class="modal-overlay" *ngIf="showRecordModal" (click)="closeRecordModal()">
        <div class="modal-card glass" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Log Clinical Record</h3>
            <button class="modal-close-btn" (click)="closeRecordModal()">×</button>
          </div>
          <form (submit)="submitRecord($event)" class="modal-form">
            <div class="form-group">
              <label>Record Type *</label>
              <select required class="form-control-premium" [(ngModel)]="newRecordType" name="newRecordType">
                <option value="VITAL_SIGNS">Vital Signs</option>
                <option value="PRESCRIPTION">Prescription</option>
              </select>
            </div>

            <!-- Vital Signs Fields -->
            <div *ngIf="newRecordType === 'VITAL_SIGNS'" class="modal-form">
              <div class="form-row-2">
                <div class="form-group">
                  <label>Blood Pressure (BP) *</label>
                  <input required class="form-control-premium" [(ngModel)]="newVitals.bp" name="bp" placeholder="e.g. 120/80" />
                </div>
                <div class="form-group">
                  <label>Heart Rate (HR) *</label>
                  <input required type="number" class="form-control-premium" [(ngModel)]="newVitals.hr" name="hr" placeholder="e.g. 72" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label>Oxygen Sat (SpO₂) *</label>
                  <input required type="number" class="form-control-premium" [(ngModel)]="newVitals.spo2" name="spo2" placeholder="e.g. 98" />
                </div>
                <div class="form-group">
                  <label>Body Temp (°F) *</label>
                  <input required type="number" step="0.1" class="form-control-premium" [(ngModel)]="newVitals.temp" name="temp" placeholder="e.g. 98.6" />
                </div>
              </div>
              <div class="form-group">
                <label>Respiratory Rate (RR) *</label>
                <input required type="number" class="form-control-premium" [(ngModel)]="newVitals.rr" name="rr" placeholder="e.g. 16" />
              </div>
            </div>

            <!-- Prescription Fields -->
            <div *ngIf="newRecordType === 'PRESCRIPTION'" class="modal-form">
              <div class="form-group">
                <label>Medication Name *</label>
                <input required class="form-control-premium" [(ngModel)]="newMed.name" name="name" placeholder="e.g. Lisinopril" />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label>Dosage *</label>
                  <input required class="form-control-premium" [(ngModel)]="newMed.dosage" name="dosage" placeholder="e.g. 10mg" />
                </div>
                <div class="form-group">
                  <label>Frequency *</label>
                  <input required class="form-control-premium" [(ngModel)]="newMed.frequency" name="frequency" placeholder="e.g. Once daily" />
                </div>
              </div>
              <div class="form-group">
                <label>Administration Route *</label>
                <input required class="form-control-premium" [(ngModel)]="newMed.route" name="route" placeholder="e.g. Oral" />
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeRecordModal()">Cancel</button>
              <button type="submit" class="btn-primary">Save Record</button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .back-btn {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.83rem; color: var(--text-muted); text-decoration: none;
      padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg-panel); transition: all 0.15s ease;
      &:hover { background: var(--bg-glass-hover); color: var(--text); }
    }
    .btn-ghost-sm {
      padding: 7px 16px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--bg-panel); color: var(--text-muted);
      font-size: 0.83rem; font-weight: 600; cursor: pointer;
      transition: all 0.15s ease;
      &:hover { background: var(--bg-glass-hover); color: var(--text); }
    }
    .btn-primary-sm {
      padding: 7px 16px; border-radius: 10px; border: none;
      background: var(--accent); color: white;
      font-size: 0.83rem; font-weight: 600; cursor: pointer;
      transition: all 0.15s ease;
      &:hover { opacity: 0.95; }
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 20px;
    }
    @media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; } }

    .detail-profile {
      display: flex; flex-direction: column; align-items: center;
      padding: 28px 20px; border-radius: 20px;
      border: 1px solid var(--border); background: var(--bg-panel);
      text-align: center;
      box-shadow: var(--shadow);
    }
    .profile-avatar {
      width: 80px; height: 80px; border-radius: 50%; margin-bottom: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.6rem; font-weight: 700; color: white;
      box-shadow: 0 6px 15px rgba(0,0,0,0.08);
    }
    .profile-name { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0 0 4px; }
    .profile-id   { font-size: 0.75rem; color: var(--text-dim); margin: 0 0 12px; }
    .profile-stats { display: flex; gap: 20px; margin-top: 16px; margin-bottom: 20px; }
    .pstat { text-align: center; }
    .pstat-val { font-size: 1.1rem; font-weight: 700; color: var(--text); }
    .pstat-lbl { font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

    .profile-meta-details {
      align-self: stretch; text-align: left; border-top: 1px solid var(--border); padding-top: 16px;
      display: flex; flex-direction: column; gap: 12px; font-size: 0.8rem; color: var(--text-muted);
      p { margin: 0; }
    }
    .warning-section {
      display: flex; flex-direction: column; gap: 6px;
    }
    .warning-tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .w-tag {
      padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 600;
    }
    .w-tag.allergy { background: rgba(239, 68, 68, 0.08); color: var(--error); }
    .w-tag.condition { background: rgba(71, 85, 105, 0.08); color: var(--text-muted); }
    .w-tag-none { font-size: 0.75rem; color: var(--text-dim); font-style: italic; }

    .detail-info-col { display: flex; flex-direction: column; gap: 20px; }
    .info-card {
      border-radius: 20px; border: 1px solid var(--border); padding: 20px;
      background: var(--bg-panel); box-shadow: var(--shadow);
    }
    .info-card-title {
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: var(--text-muted); margin-bottom: 16px;
      border-bottom: 1px solid var(--border); padding-bottom: 8px;
    }
    .vitals-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(130px,1fr)); gap: 12px;
    }
    .vital-item { text-align: center; padding: 14px 10px; background: var(--clinical-bg); border-radius: 12px; border: 1px solid var(--border); }
    .vital-label { font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .vital-value { font-size: 1.25rem; font-weight: 700; color: var(--text); }
    .vital-value.vital-alert { color: var(--error); animation: vitalPulse 1s infinite; }
    .vital-unit  { font-size: 0.65rem; color: var(--text-dim); margin-top: 4px; }

    .med-list { display: flex; flex-direction: column; gap: 10px; }
    .med-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--clinical-bg); border: 1px solid var(--border); border-radius: 10px; }
    .med-dot { font-size: 1rem; }
    .med-name { font-size: 0.88rem; font-weight: 600; color: var(--text); }
    .med-dose { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

    .notes-list { display: flex; flex-direction: column; gap: 16px; }
    .note-item { padding: 16px; background: var(--clinical-bg); border-radius: 12px; border: 1px solid var(--border); }
    .note-header { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed var(--border); padding-bottom: 8px; }
    .note-type { font-size: 0.7rem; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; }
    .note-date { font-size: 0.68rem; color: var(--text-dim); }
    .note-body {
      font-size: 0.85rem; color: var(--text-muted); line-height: 1.6;
      p { margin: 0 0 8px; }
    }
    .note-author { font-size: 0.72rem; color: var(--text-dim); display: block; margin-top: 10px; font-weight: 500; }

    .status-badge { padding: 4px 12px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; gap: 6px; }
    .status-stable { background: rgba(16,185,129,0.08); color: var(--success); border: 1px solid rgba(16,185,129,0.2); }
    .table-empty { padding: 30px; text-align: center; color: var(--text-dim); font-size: 0.85rem; }

    /* Modals */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(8px); display: flex; align-items: center;
      justify-content: center; z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    }
    .modal-card {
      background: var(--bg-panel); border: 1px solid var(--border);
      border-radius: 20px; width: 100%; max-width: 580px; padding: 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.12);
      animation: scaleUp 0.3s var(--ease-spring);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px; border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
      h3 { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
    }
    .modal-close-btn {
      background: none; border: none; font-size: 1.5rem; color: var(--text-muted);
      cursor: pointer; &:hover { color: var(--text); }
    }
    .modal-form {
      display: flex; flex-direction: column; gap: 16px;
    }
    .form-group {
      display: flex; flex-direction: column; gap: 6px;
      label { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }
      input, select, textarea {
        padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px;
        background: var(--clinical-bg); color: var(--text); outline: none; font-size: 0.85rem;
      }
    }
    .text-area-clinical {
      height: 70px; resize: vertical; font-family: inherit; line-height: 1.4;
    }
    .form-row-2 {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 12px;
      margin-top: 12px; border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .btn-secondary {
      background: var(--clinical-bg); border: 1px solid var(--border);
      color: var(--text-muted); padding: 10px 18px; border-radius: 10px;
      font-weight: 600; cursor: pointer; transition: all 0.15s ease;
      &:hover { background: var(--border); color: var(--text); }
    }
    .btn-primary {
      background: var(--accent); border: none;
      color: white; padding: 10px 18px; border-radius: 10px;
      font-weight: 600; cursor: pointer; transition: all 0.15s ease;
      &:hover { opacity: 0.95; transform: translateY(-1px); }
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  `],
})
export class PatientDetailComponent implements OnInit {
  patientId = '';
  patient: Patient | null = null;
  records: EHRRecord[] = [];
  notes: ClinicalNote[] = [];

  // Vitals summary computed from records
  vitals = {
    bp: '',
    hr: null as number | null,
    spo2: null as number | null,
    temp: null as number | null,
    rr: null as number | null,
  };

  // Medications list computed from records
  medications: EHRRecord[] = [];

  // Add Note Form
  showNoteModal = false;
  newNote = {
    noteType: 'SOAP',
    title: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    doctorName: '',
  };

  // Add Record Form
  showRecordModal = false;
  newRecordType = 'VITAL_SIGNS';
  newVitals = {
    bp: '',
    hr: null as number | null,
    spo2: null as number | null,
    temp: null as number | null,
    rr: null as number | null,
  };
  newMed = {
    name: '',
    dosage: '',
    frequency: '',
    route: 'Oral',
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.patientId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadPatientChart();
  }

  async loadPatientChart() {
    if (!this.patientId) return;
    try {
      // 1. Load patient profile
      const resPatient = await fetch(`/api/patients/${this.patientId}`);
      if (resPatient.ok) {
        this.patient = await resPatient.json();
      }

      // 2. Load health records (vitals/prescriptions)
      const resRecords = await fetch(`/api/patients/${this.patientId}/records`);
      if (resRecords.ok) {
        this.records = await resRecords.json();
        this.parseVitalsAndMeds();
      }

      // 3. Load clinical notes
      const resNotes = await fetch(`/api/patients/${this.patientId}/notes`);
      if (resNotes.ok) {
        this.notes = await resNotes.json();
      }
    } catch (e) {
      console.error('Failed to load patient chart data', e);
    }
  }

  parseVitalsAndMeds() {
    // Extract latest vitals
    const vitalRecords = this.records.filter(r => r.recordType === 'VITAL_SIGNS');
    if (vitalRecords.length > 0) {
      const latest = vitalRecords[0]; // Ordered desc by date
      this.vitals = {
        bp: latest.data?.bp || '',
        hr: latest.data?.hr || null,
        spo2: latest.data?.spo2 || null,
        temp: latest.data?.temp || null,
        rr: latest.data?.rr || null,
      };
    }

    // Extract medications
    this.medications = this.records.filter(r => r.recordType === 'PRESCRIPTION');
  }

  isBPAlert(bpString: string): boolean {
    if (!bpString) return false;
    const parts = bpString.split('/');
    if (parts.length === 2) {
      const systolic = parseInt(parts[0], 10);
      const diastolic = parseInt(parts[1], 10);
      return systolic >= 140 || diastolic >= 90;
    }
    return false;
  }

  openNoteModal() {
    this.newNote = {
      noteType: 'SOAP',
      title: '',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      doctorName: '',
    };
    this.showNoteModal = true;
  }

  closeNoteModal() {
    this.showNoteModal = false;
  }

  async submitNote(event: Event) {
    event.preventDefault();
    try {
      const res = await fetch(`/api/patients/${this.patientId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.newNote),
      });

      if (res.ok) {
        this.closeNoteModal();
        await this.loadPatientChart();
      } else {
        alert('Failed to save clinical note.');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving clinical note.');
    }
  }

  openRecordModal() {
    this.newRecordType = 'VITAL_SIGNS';
    this.newVitals = { bp: '', hr: null, spo2: null, temp: null, rr: null };
    this.newMed = { name: '', dosage: '', frequency: '', route: 'Oral' };
    this.showRecordModal = true;
  }

  closeRecordModal() {
    this.showRecordModal = false;
  }

  async submitRecord(event: Event) {
    event.preventDefault();

    let title = '';
    let data: any = {};

    if (this.newRecordType === 'VITAL_SIGNS') {
      title = 'Logged Vitals Updates';
      data = {
        bp: this.newVitals.bp,
        hr: Number(this.newVitals.hr),
        spo2: Number(this.newVitals.spo2),
        temp: Number(this.newVitals.temp),
        rr: Number(this.newVitals.rr),
      };
    } else {
      title = this.newMed.name;
      data = {
        dosage: this.newMed.dosage,
        frequency: this.newMed.frequency,
        route: this.newMed.route,
      };
    }

    const body = {
      recordType: this.newRecordType,
      title,
      description: this.newRecordType === 'VITAL_SIGNS' ? 'Log entry via intake dashboard.' : `Prescribed by staff.`,
      data,
    };

    try {
      const res = await fetch(`/api/patients/${this.patientId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        this.closeRecordModal();
        await this.loadPatientChart();
      } else {
        alert('Failed to log record.');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving record.');
    }
  }

  calculateAge(dobString: string): number {
    if (!dobString) return 0;
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  getInitials(): string {
    if (!this.patient) return '';
    return `${this.patient.firstName.charAt(0)}${this.patient.lastName.charAt(0)}`.toUpperCase();
  }

  getAvatarColor(): string {
    if (!this.patient) return 'var(--accent)';
    const sum = this.patient.firstName.charCodeAt(0) + this.patient.lastName.charCodeAt(0);
    const colors = [
      'linear-gradient(135deg, #0ea5e9, #0284c7)', // Sky
      'linear-gradient(135deg, #0d9488, #0f766e)', // Teal
      'linear-gradient(135deg, #8b5cf6, #6d28d9)', // Violet
      'linear-gradient(135deg, #f59e0b, #d97706)', // Amber
      'linear-gradient(135deg, #ec4899, #be185d)', // Pink
    ];
    return colors[sum % colors.length];
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
}
