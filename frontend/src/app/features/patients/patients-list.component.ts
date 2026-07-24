import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="feature-page animate-fade-in-up">

      <div class="page-header">
        <div class="page-header-content">
          <div class="page-header-icon" style="background:linear-gradient(135deg,#0ea5e9,#0891b2)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div class="staff-only-badge">
              <i>🔒</i> STAFF ONLY ACCESS — DOCTORS & NURSES PORTAL
            </div>
            <h1 class="page-title">Patient Registry & Intake</h1>
            <p class="page-subtitle">{{ patients.length }} Active Patient Profiles</p>
          </div>
        </div>
        <div class="page-header-actions">
          <button class="btn-primary-sm interactive-hover" (click)="openAddModal()">⊕ Register New Patient</button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="filter-row glass">
        <div class="search-box form-control-premium" style="width: 100%; max-width: 450px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            placeholder="Search patients by mobile number, name, age, or MRN…" 
            [(ngModel)]="searchQuery" 
            (input)="onSearchChange()" 
            style="width: 100%;"
          />
        </div>
        <div class="filter-spacer"></div>
        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">
          💡 Type age like "52" or phone like "555"
        </span>
      </div>

      <!-- Patient Table -->
      <div class="patient-table-wrap glass animate-scale-in">
        <table class="patient-table">
          <thead>
            <tr>
              <th>Patient / MRN</th>
              <th>Age / Gender</th>
              <th>Phone Number</th>
              <th>Blood Group</th>
              <th>Allergies & Conditions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of patients" class="patient-row interactive-hover">
              <td>
                <div class="patient-cell">
                  <div class="patient-avatar" [style.background]="getAvatarColor(p)">
                    {{ getInitials(p) }}
                  </div>
                  <div>
                    <div class="patient-name">{{ p.firstName }} {{ p.lastName }}</div>
                    <div class="patient-id">MRN: {{ p.mrn }}</div>
                  </div>
                </div>
              </td>
              <td class="td-muted">{{ calculateAge(p.dateOfBirth) }} / {{ p.gender }}</td>
              <td class="td-muted">{{ p.phoneNumber || '—' }}</td>
              <td>
                <span class="blood-group">{{ p.bloodGroup || 'Not Tested' }}</span>
              </td>
              <td class="td-muted">
                <div class="tags-container">
                  <span *ngFor="let a of p.allergies" class="tag-allergy">⚠️ {{ a }}</span>
                  <span *ngFor="let c of p.chronicConditions" class="tag-condition">📋 {{ c }}</span>
                  <span *ngIf="p.allergies.length === 0 && p.chronicConditions.length === 0" class="tag-none">No active warnings</span>
                </div>
              </td>
              <td>
                <a class="btn-row button-glow-hover" [routerLink]="['/patients', p.id]">Clinical Chart →</a>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="table-empty" *ngIf="patients.length === 0">
          <p>No patients found matching the criteria.</p>
        </div>
      </div>

      <!-- REGISTER PATIENT DIALOG MODAL -->
      <div class="modal-overlay" *ngIf="showAddModal" (click)="closeAddModal()">
        <div class="modal-card glass" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Patient Registry Intake Form</h3>
            <button class="modal-close-btn" (click)="closeAddModal()">×</button>
          </div>
          <form (submit)="submitPatient($event)" class="modal-form">
            <div class="form-row-2">
              <div class="form-group">
                <label>First Name *</label>
                <input required class="form-control-premium" [(ngModel)]="newPatient.firstName" name="firstName" placeholder="e.g. John" />
              </div>
              <div class="form-group">
                <label>Last Name *</label>
                <input required class="form-control-premium" [(ngModel)]="newPatient.lastName" name="lastName" placeholder="e.g. Doe" />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label>Date of Birth *</label>
                <input required type="date" class="form-control-premium" [(ngModel)]="newPatient.dateOfBirth" name="dateOfBirth" />
              </div>
              <div class="form-group">
                <label>Gender *</label>
                <select required class="form-control-premium" [(ngModel)]="newPatient.gender" name="gender">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label>Phone / Mobile Number</label>
                <input class="form-control-premium" [(ngModel)]="newPatient.phoneNumber" name="phoneNumber" placeholder="e.g. 555-0143" />
              </div>
              <div class="form-group">
                <label>Blood Group</label>
                <input class="form-control-premium" [(ngModel)]="newPatient.bloodGroup" name="bloodGroup" placeholder="e.g. O+, A-" />
              </div>
            </div>

            <div class="form-group">
              <label>Allergies (comma separated)</label>
              <input class="form-control-premium" [(ngModel)]="rawAllergies" name="rawAllergies" placeholder="e.g. Penicillin, Aspirin" />
            </div>

            <div class="form-group">
              <label>Chronic Conditions (comma separated)</label>
              <input class="form-control-premium" [(ngModel)]="rawConditions" name="rawConditions" placeholder="e.g. Hypertension, Diabetes" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeAddModal()">Cancel</button>
              <button type="submit" class="btn-primary">Register Patient Profile</button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .filter-row {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 12px 18px; border-radius: 14px; border: 1px solid var(--border);
      background: var(--bg-panel); backdrop-filter: blur(12px);
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
    .filter-spacer { flex: 1; }
    .search-box {
      display: flex; align-items: center; gap: 10px;
      background: var(--bg-glass); border: 1px solid var(--border);
      border-radius: 99px; padding: 8px 16px; color: var(--text-muted);
      input {
        background: none; border: none; outline: none; color: var(--text);
        font-size: 0.85rem;
        &::placeholder { color: var(--text-dim); }
      }
    }
    .patient-table-wrap {
      border-radius: 20px; border: 1px solid var(--border);
      background: var(--bg-panel); overflow: hidden;
      box-shadow: var(--shadow);
    }
    .patient-table {
      width: 100%; border-collapse: collapse;
      thead tr { border-bottom: 1px solid var(--border); background: var(--clinical-bg); }
      th {
        text-align: left; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em;
        text-transform: uppercase; color: var(--text-muted); padding: 16px 20px;
      }
    }
    .patient-row {
      border-bottom: 1px solid var(--border);
      transition: background 0.14s ease;
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg-glass-hover); }
      td { padding: 16px 20px; vertical-align: middle; }
    }
    .patient-cell { display: flex; align-items: center; gap: 14px; }
    .patient-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-weight: 700; color: white; flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    }
    .patient-name { font-size: 0.9rem; font-weight: 600; color: var(--text); }
    .patient-id { font-size: 0.7rem; color: var(--text-dim); }
    .td-muted { font-size: 0.85rem; color: var(--text-muted); }
    .blood-group {
      background: rgba(8, 145, 178, 0.08); color: var(--accent);
      padding: 3px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 600;
    }
    .tags-container { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag-allergy {
      background: rgba(239, 68, 68, 0.08); color: var(--error);
      padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
    }
    .tag-condition {
      background: rgba(71, 85, 105, 0.08); color: var(--text-muted);
      padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
    }
    .tag-none { font-size: 0.75rem; color: var(--text-dim); font-style: italic; }
    .btn-row {
      font-size: 0.8rem; font-weight: 600; color: var(--accent);
      text-decoration: none; padding: 6px 14px; border-radius: 8px;
      border: 1px solid rgba(8, 145, 178, 0.25); background: rgba(8, 145, 178, 0.06);
      transition: all 0.15s ease;
      &:hover { background: var(--accent); color: white; border-color: var(--accent); }
    }
    .table-empty { padding: 48px; text-align: center; color: var(--text-dim); font-size: 0.9rem; }

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
      input, select {
        padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px;
        background: var(--clinical-bg); color: var(--text); outline: none; font-size: 0.85rem;
      }
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
export class PatientsListComponent implements OnInit {
  patients: Patient[] = [];
  searchQuery = '';
  showAddModal = false;

  // New patient form fields
  newPatient = {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    phoneNumber: '',
    bloodGroup: '',
  };
  rawAllergies = '';
  rawConditions = '';

  private searchDebounceTimer: any;

  ngOnInit() {
    this.loadPatients();
  }

  async loadPatients() {
    try {
      const res = await fetch('/api/patients');
      if (res.ok) {
        const body = await res.json();
        this.patients = body.data || [];
      }
    } catch (e) {
      console.error('Failed to load patients', e);
    }
  }

  onSearchChange() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.executeSearch();
    }, 300);
  }

  async executeSearch() {
    if (!this.searchQuery.trim()) {
      await this.loadPatients();
      return;
    }
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(this.searchQuery.trim())}`);
      if (res.ok) {
        this.patients = await res.json();
      }
    } catch (e) {
      console.error('Search failed', e);
    }
  }

  openAddModal() {
    this.newPatient = {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'MALE',
      phoneNumber: '',
      bloodGroup: '',
    };
    this.rawAllergies = '';
    this.rawConditions = '';
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  async submitPatient(event: Event) {
    event.preventDefault();
    const randomMRN = 'MRN-' + Math.floor(10000 + Math.random() * 90000);
    const body = {
      mrn: randomMRN,
      firstName: this.newPatient.firstName.trim(),
      lastName: this.newPatient.lastName.trim(),
      dateOfBirth: this.newPatient.dateOfBirth,
      gender: this.newPatient.gender,
      phoneNumber: this.newPatient.phoneNumber.trim() || undefined,
      bloodGroup: this.newPatient.bloodGroup.trim().toUpperCase() || undefined,
      allergies: this.rawAllergies.split(',').map(s => s.trim()).filter(Boolean),
      chronicConditions: this.rawConditions.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        this.closeAddModal();
        await this.loadPatients();
      } else {
        const error = await res.json();
        alert(`Error: ${error.message}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to register patient.');
    }
  }

  calculateAge(dobString: string): number {
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  getInitials(p: Patient): string {
    return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
  }

  getAvatarColor(p: Patient): string {
    const sum = p.firstName.charCodeAt(0) + p.lastName.charCodeAt(0);
    const colors = [
      'linear-gradient(135deg, #0ea5e9, #0284c7)', // Sky
      'linear-gradient(135deg, #0d9488, #0f766e)', // Teal
      'linear-gradient(135deg, #8b5cf6, #6d28d9)', // Violet
      'linear-gradient(135deg, #f59e0b, #d97706)', // Amber
      'linear-gradient(135deg, #ec4899, #be185d)', // Pink
    ];
    return colors[sum % colors.length];
  }
}
