import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ClinicalNote {
  id: string;
  title: string;
  patient: string;
  patientId: string;
  type: 'progress' | 'assessment' | 'discharge' | 'admission' | 'procedure';
  author: string;
  date: string;
  excerpt: string;
  tags: string[];
  color: string;
}

@Component({
  selector: 'app-clinical-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="feature-page animate-fade-in-up">

      <div class="page-header">
        <div class="page-header-content">
          <div class="page-header-icon" style="background:linear-gradient(135deg,#10b981,#059669)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div>
            <h1 class="page-title">Clinical Notes</h1>
            <p class="page-subtitle">{{ notes.length }} notes — AI-assisted documentation</p>
          </div>
        </div>
        <div class="page-header-actions">
          <button class="btn-primary-sm button-glow-hover" (click)="composing = !composing">
            {{ composing ? '✕ Cancel' : '✎ New Note' }}
          </button>
        </div>
      </div>

      <!-- Composer -->
      <div class="composer-card glass animate-scale-in" *ngIf="composing">
        <div class="composer-header">
          <span class="composer-title">New Clinical Note</span>
          <div class="type-chips">
            <button *ngFor="let t of noteTypes" class="type-chip interactive-hover" [class.active]="newNote.type === t.value" (click)="newNote.type = t.value">{{ t.label }}</button>
          </div>
        </div>
        <input class="note-input form-control-premium" placeholder="Patient name or ID…" [(ngModel)]="newNote.patient" />
        <input class="note-input form-control-premium" placeholder="Note title…" [(ngModel)]="newNote.title" />
        <textarea class="note-textarea form-control-premium" rows="6" placeholder="Begin typing your clinical note here. AI will assist with structure and terminology…" [(ngModel)]="newNote.content"></textarea>
        <div class="composer-footer">
          <div class="ai-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>
            AI documentation assistant active
          </div>
          <button class="btn-primary-sm button-glow-hover" (click)="saveNote()" [disabled]="!newNote.title.trim()">Save Note</button>
        </div>
      </div>

      <!-- Notes Grid -->
      <div class="notes-grid stagger-container">
        <div class="note-card glass interactive-hover" *ngFor="let note of notes" [style.--note-color]="note.color">
          <div class="note-card-header">
            <span class="note-type-badge" [class]="'type-' + note.type">{{ note.type }}</span>
            <span class="note-date">{{ note.date }}</span>
          </div>
          <h3 class="note-title">{{ note.title }}</h3>
          <p class="note-patient">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {{ note.patient }} · {{ note.patientId }}
          </p>
          <p class="note-excerpt">{{ note.excerpt }}</p>
          <div class="note-tags">
            <span class="note-tag" *ngFor="let tag of note.tags">{{ tag }}</span>
          </div>
          <div class="note-footer">
            <span class="note-author">Dr. {{ note.author }}</span>
            <button class="note-action-btn button-glow-hover" style="padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(14,165,233,0.25); background: rgba(14,165,233,0.06); transition: all 0.2s;">Edit →</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .btn-primary-sm {
      padding: 7px 16px; border-radius: 10px; border: none;
      background: linear-gradient(135deg,#10b981,#059669); color: white;
      font-size: 0.83rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
      &:hover { opacity: 0.88; }
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }
    .composer-card {
      border-radius: 20px; border: 1px solid var(--border); padding: 20px;
      background: var(--bg-panel); backdrop-filter: blur(16px); margin-bottom: 20px;
    }
    .composer-header { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
    .composer-title { font-size: 0.875rem; font-weight: 700; color: var(--text); }
    .type-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .type-chip {
      padding: 4px 12px; border-radius: 99px; font-size: 0.72rem; font-weight: 600;
      border: 1px solid var(--border); background: var(--bg-glass); color: var(--text-muted);
      cursor: pointer; transition: all 0.14s;
      &.active { background: rgba(16,185,129,0.12); color: #10b981; border-color: rgba(16,185,129,0.3); }
    }
    .note-input {
      width: 100%; background: var(--bg-glass); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 14px; color: var(--text); font-size: 0.875rem;
      margin-bottom: 10px; outline: none; transition: border-color 0.15s;
      &:focus { border-color: rgba(16,185,129,0.5); }
      &::placeholder { color: var(--text-dim); }
    }
    .note-textarea {
      width: 100%; background: var(--bg-glass); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px 14px; color: var(--text); font-size: 0.875rem;
      resize: vertical; outline: none; line-height: 1.6; transition: border-color 0.15s;
      &:focus { border-color: rgba(16,185,129,0.5); }
      &::placeholder { color: var(--text-dim); }
    }
    .composer-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
    .ai-hint {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.72rem; color: #10b981; font-weight: 500;
    }
    .notes-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;
    }
    .note-card {
      border-radius: 20px; border: 1px solid var(--border); padding: 20px;
      background: var(--bg-panel); backdrop-filter: blur(16px);
      transition: transform 0.16s ease, box-shadow 0.16s ease;
      border-left: 3px solid var(--note-color, #0ea5e9);
      &:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    }
    .note-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .note-type-badge {
      padding: 3px 10px; border-radius: 99px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .type-progress  { background: rgba(14,165,233,0.12); color: #0ea5e9; }
    .type-assessment{ background: rgba(139,92,246,0.12); color: #8b5cf6; }
    .type-discharge { background: rgba(16,185,129,0.12); color: #10b981; }
    .type-admission { background: rgba(245,158,11,0.12); color: #f59e0b; }
    .type-procedure { background: rgba(239,68,68,0.12);  color: #ef4444; }
    .note-date { font-size: 0.7rem; color: var(--text-dim); }
    .note-title { font-size: 0.975rem; font-weight: 700; color: var(--text); margin: 0 0 8px; }
    .note-patient {
      display: flex; align-items: center; gap: 5px;
      font-size: 0.75rem; color: #0ea5e9; margin: 0 0 10px; font-weight: 500;
    }
    .note-excerpt { font-size: 0.83rem; color: var(--text-muted); line-height: 1.55; margin: 0 0 12px; }
    .note-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .note-tag {
      padding: 3px 8px; border-radius: 6px; font-size: 0.68rem; font-weight: 500;
      background: var(--bg-glass); color: var(--text-dim); border: 1px solid var(--border);
    }
    .note-footer { display: flex; align-items: center; justify-content: space-between; }
    .note-author { font-size: 0.72rem; color: var(--text-dim); }
    .note-action-btn {
      font-size: 0.75rem; font-weight: 600; color: #0ea5e9; background: none; border: none;
      cursor: pointer; transition: opacity 0.14s; padding: 0;
      &:hover { opacity: 0.7; }
    }
  `],
})
export class ClinicalNotesComponent {
  composing = false;
  newNote = { title: '', patient: '', type: 'progress', content: '' };

  readonly noteTypes = [
    { value: 'progress',   label: 'Progress'   },
    { value: 'assessment', label: 'Assessment' },
    { value: 'discharge',  label: 'Discharge'  },
    { value: 'admission',  label: 'Admission'  },
    { value: 'procedure',  label: 'Procedure'  },
  ];

  notes: ClinicalNote[] = [
    { id: 'N-001', title: 'Post-op Assessment — Knee Replacement',  patient: 'Sarah Mitchell',  patientId: 'P-4821', type: 'progress',   author: 'Chen, K.',   date: 'Today, 09:14',    excerpt: 'Patient recovering well following left knee arthroplasty. Pain controlled at 3/10. ROM improving. Weight-bearing with walker.',  tags: ['ortho', 'post-op', 'PT'],          color: '#0ea5e9' },
    { id: 'N-002', title: 'Cardiac Monitoring — Day 3',             patient: 'James Okafor',    patientId: 'P-3301', type: 'assessment', author: 'Patel, R.',  date: 'Today, 07:55',    excerpt: 'Rhythm stable post-cardioversion. Troponin trending down. Echo scheduled for tomorrow. Continue telemetry.',                 tags: ['cardiology', 'ICU', 'monitoring'], color: '#8b5cf6' },
    { id: 'N-003', title: 'Diabetes Management Review',             patient: 'Elena Vasquez',   patientId: 'P-2199', type: 'assessment', author: 'Singh, M.',  date: 'Yesterday, 14:30',excerpt: 'HbA1c at 7.8%, down from 9.2% three months ago. Excellent adherence to metformin regimen. Dietary counselling reinforced.', tags: ['endocrine', 'diabetes', 'A1c'],     color: '#10b981' },
    { id: 'N-004', title: 'Admission Note — Chest Pain Workup',     patient: 'Robert Chen',     patientId: 'P-5502', type: 'admission',  author: 'Torres, L.', date: 'Today, 11:00',    excerpt: 'Presented with atypical chest pain, palpitations. ECG: occasional PVCs. Serial troponins ordered. Admitted for monitoring.', tags: ['cardiology', 'admission', 'ECG'],   color: '#f59e0b' },
    { id: 'N-005', title: 'Neurological Assessment — Stroke Recovery',patient: 'Maria Hartmann', patientId: 'P-1087', type: 'progress',   author: 'Osei, B.',   date: 'Today, 08:20',    excerpt: 'Speech therapy progress satisfactory. Right-sided weakness improving. NIHSS down from 8 to 5. Continue aggressive rehab.',   tags: ['neurology', 'stroke', 'rehab'],     color: '#ec4899' },
    { id: 'N-006', title: 'Chemotherapy Cycle 4 — Day 1',           patient: 'David Thompson',  patientId: 'P-6634', type: 'procedure',  author: 'Kim, J.',    date: '2 days ago',      excerpt: 'FOLFOX cycle 4 administered without incident. Antiemetics given prophylactically. Labs reviewed: ANC adequate for treatment.', tags: ['oncology', 'chemo', 'FOLFOX'],     color: '#ef4444' },
  ];

  saveNote(): void {
    if (!this.newNote.title.trim()) return;
    const now = new Date();
    this.notes = [{
      id: `N-${String(this.notes.length + 1).padStart(3, '0')}`,
      title: this.newNote.title,
      patient: this.newNote.patient || 'Unassigned',
      patientId: '—',
      type: this.newNote.type as ClinicalNote['type'],
      author: 'Current User',
      date: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      excerpt: this.newNote.content || '(No content)',
      tags: [],
      color: '#0ea5e9',
    }, ...this.notes];
    this.newNote = { title: '', patient: '', type: 'progress', content: '' };
    this.composing = false;
  }
}
