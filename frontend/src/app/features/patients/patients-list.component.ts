import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  ward: string;
  condition: string;
  status: 'stable' | 'critical' | 'observation' | 'discharged';
  lastVisit: string;
  initials: string;
  color: string;
}

@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="feature-page animate-fade-in-up">

      <div class="page-header">
        <div class="page-header-content">
          <div class="page-header-icon" style="background:linear-gradient(135deg,#0ea5e9,#0369a1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <h1 class="page-title">Patient Registry</h1>
            <p class="page-subtitle">{{ patients.length }} patients — All wards</p>
          </div>
        </div>
        <div class="page-header-actions">
          <button class="btn-ghost-sm interactive-hover">⊕ Add Patient</button>
          <button class="btn-ghost-sm interactive-hover">⊞ Export</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-row glass">
        <button class="filter-chip interactive-hover" [class.active]="filter === 'all'"      (click)="filter = 'all'">All</button>
        <button class="filter-chip interactive-hover" [class.active]="filter === 'critical'"  (click)="filter = 'critical'">Critical</button>
        <button class="filter-chip interactive-hover" [class.active]="filter === 'stable'"    (click)="filter = 'stable'">Stable</button>
        <button class="filter-chip interactive-hover" [class.active]="filter === 'observation'" (click)="filter = 'observation'">Observation</button>
        <div class="filter-spacer"></div>
        <div class="search-box form-control-premium">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search patients…" [(ngModel)]="searchQuery" />
        </div>
      </div>

      <!-- Patient Table -->
      <div class="patient-table-wrap glass animate-scale-in">
        <table class="patient-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Age / Gender</th>
              <th>Ward</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Last Visit</th>
              <th></th>
            </tr>
          </thead>
          <tbody class="stagger-container">
            <tr *ngFor="let p of filteredPatients" class="patient-row interactive-hover">
              <td>
                <div class="patient-cell">
                  <div class="patient-avatar" [style.background]="p.color">{{ p.initials }}</div>
                  <div>
                    <div class="patient-name">{{ p.name }}</div>
                    <div class="patient-id">ID: {{ p.id }}</div>
                  </div>
                </div>
              </td>
              <td class="td-muted">{{ p.age }} / {{ p.gender }}</td>
              <td class="td-muted">{{ p.ward }}</td>
              <td class="td-muted">{{ p.condition }}</td>
              <td>
                <span class="status-badge" [class]="'status-' + p.status">{{ p.status }}</span>
              </td>
              <td class="td-muted">{{ p.lastVisit }}</td>
              <td>
                <a class="btn-row button-glow-hover" [routerLink]="['/patients', p.id]">View →</a>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="table-empty" *ngIf="filteredPatients.length === 0">
          <p>No patients match your filter.</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .filter-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 10px 14px; border-radius: 14px; border: 1px solid var(--border);
      background: var(--bg-panel); backdrop-filter: blur(12px);
      margin-bottom: 16px;
    }
    .filter-chip {
      padding: 6px 14px; border-radius: 99px; font-size: 0.8rem; font-weight: 500;
      border: 1px solid var(--border); background: var(--bg-glass); color: var(--text-muted);
      cursor: pointer; transition: all 0.15s ease;
      &:hover { background: var(--bg-glass-hover); color: var(--text); }
      &.active { background: rgba(14,165,233,0.12); color: #0ea5e9; border-color: rgba(14,165,233,0.3); }
    }
    .filter-spacer { flex: 1; }
    .search-box {
      display: flex; align-items: center; gap: 8px;
      background: var(--bg-glass); border: 1px solid var(--border);
      border-radius: 99px; padding: 6px 14px; color: var(--text-muted);
      input {
        background: none; border: none; outline: none; color: var(--text);
        font-size: 0.83rem; width: 160px;
        &::placeholder { color: var(--text-dim); }
      }
    }
    .patient-table-wrap {
      border-radius: 20px; border: 1px solid var(--border);
      background: var(--bg-panel); backdrop-filter: blur(16px); overflow: hidden;
    }
    .patient-table {
      width: 100%; border-collapse: collapse;
      thead tr { border-bottom: 1px solid var(--border); }
      th {
        text-align: left; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.07em;
        text-transform: uppercase; color: var(--text-muted); padding: 14px 16px;
      }
    }
    .patient-row {
      border-bottom: 1px solid var(--border);
      transition: background 0.14s ease;
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg-glass); }
      td { padding: 14px 16px; vertical-align: middle; }
    }
    .patient-cell { display: flex; align-items: center; gap: 12px; }
    .patient-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 700; color: white; flex-shrink: 0;
    }
    .patient-name { font-size: 0.875rem; font-weight: 600; color: var(--text); }
    .patient-id { font-size: 0.7rem; color: var(--text-dim); }
    .td-muted { font-size: 0.83rem; color: var(--text-muted); }
    .status-badge {
      padding: 3px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 700;
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .status-stable      { background: rgba(16,185,129,0.12); color: #10b981; }
    .status-critical    { background: rgba(239,68,68,0.12);  color: #ef4444; }
    .status-observation { background: rgba(245,158,11,0.12); color: #f59e0b; }
    .status-discharged  { background: var(--bg-glass); color: var(--text-dim); }
    .btn-row {
      font-size: 0.78rem; font-weight: 600; color: #0ea5e9;
      text-decoration: none; padding: 5px 12px; border-radius: 8px;
      border: 1px solid rgba(14,165,233,0.25); background: rgba(14,165,233,0.06);
      transition: background 0.14s ease;
      &:hover { background: rgba(14,165,233,0.14); }
    }
    .table-empty { padding: 40px; text-align: center; color: var(--text-dim); font-size: 0.9rem; }
  `],
})
export class PatientsListComponent {
  filter = 'all';
  searchQuery = '';

  readonly patients: Patient[] = [
    { id: 'P-4821', name: 'Sarah Mitchell',  age: 52, gender: 'F', ward: 'Cardiology',   condition: 'Hypertension',      status: 'stable',      lastVisit: 'Today, 09:14',     initials: 'SM', color: 'linear-gradient(135deg,#0ea5e9,#0284c7)' },
    { id: 'P-3301', name: 'James Okafor',    age: 67, gender: 'M', ward: 'ICU',          condition: 'Post-op Recovery',  status: 'critical',    lastVisit: 'Today, 07:55',     initials: 'JO', color: 'linear-gradient(135deg,#ef4444,#b91c1c)' },
    { id: 'P-2199', name: 'Elena Vasquez',   age: 44, gender: 'F', ward: 'Endocrinology',condition: 'Type 2 Diabetes',   status: 'observation', lastVisit: 'Yesterday, 14:30', initials: 'EV', color: 'linear-gradient(135deg,#f59e0b,#d97706)' },
    { id: 'P-5502', name: 'Robert Chen',     age: 38, gender: 'M', ward: 'Cardiology',   condition: 'Arrhythmia',        status: 'stable',      lastVisit: 'Today, 11:00',     initials: 'RC', color: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
    { id: 'P-1087', name: 'Maria Hartmann',  age: 71, gender: 'F', ward: 'Neurology',    condition: 'Stroke Recovery',   status: 'observation', lastVisit: 'Today, 08:20',     initials: 'MH', color: 'linear-gradient(135deg,#10b981,#059669)' },
    { id: 'P-6634', name: 'David Thompson',  age: 59, gender: 'M', ward: 'Oncology',     condition: 'Chemotherapy',      status: 'stable',      lastVisit: '2 days ago',       initials: 'DT', color: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
    { id: 'P-7741', name: 'Aisha Patel',     age: 29, gender: 'F', ward: 'Maternity',    condition: 'Post-partum',       status: 'discharged',  lastVisit: '3 days ago',       initials: 'AP', color: 'linear-gradient(135deg,#ec4899,#db2777)' },
    { id: 'P-9012', name: 'Carlos Mendes',   age: 55, gender: 'M', ward: 'Pulmonology',  condition: 'COPD',              status: 'critical',    lastVisit: 'Today, 06:45',     initials: 'CM', color: 'linear-gradient(135deg,#f97316,#ea580c)' },
  ];

  get filteredPatients(): Patient[] {
    let list = this.patients;
    if (this.filter !== 'all') list = list.filter(p => p.status === this.filter);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.ward.toLowerCase().includes(q) ||
        p.condition.toLowerCase().includes(q),
      );
    }
    return list;
  }
}
