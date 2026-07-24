import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Patient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../database/prisma.service';
import { PaginatedResult } from '../common/types/pagination.types';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

interface MockEHR {
  id: string;
  recordType: string; // LAB_RESULT, IMAGING, PRESCRIPTION, PROCEDURE, VITAL_SIGNS
  title: string;
  description?: string;
  data: any;
  recordDate: Date;
  createdAt: Date;
}

interface MockNote {
  id: string;
  noteType: string; // SOAP, PROGRESS, DISCHARGE, ADMISSION, CONSULTATION
  title: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  rawContent?: string;
  aiSummary?: string;
  aiConfidence?: number;
  isSigned: boolean;
  signedAt?: Date;
  doctorName: string;
  createdAt: Date;
}

interface MockPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  phoneNumber?: string;
  bloodGroup?: string;
  allergies: string[];
  chronicConditions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  healthRecords: MockEHR[];
  clinicalNotes: MockNote[];
}

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  // In-memory fallback database pre-populated with detailed clinical data
  private mockPatients: MockPatient[] = [
    {
      id: 'P-4821',
      mrn: 'MRN-4821',
      firstName: 'Sarah',
      lastName: 'Mitchell',
      dateOfBirth: new Date('1974-04-12'),
      gender: 'FEMALE',
      phoneNumber: '555-0143',
      bloodGroup: 'O+',
      allergies: ['Penicillin', 'Sulfa Drugs'],
      chronicConditions: ['Hypertension', 'Mild Asthma'],
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      updatedAt: new Date(),
      healthRecords: [
        {
          id: randomUUID(),
          recordType: 'VITAL_SIGNS',
          title: 'Routine Intake Vitals',
          description: 'Vitals logged during outpatient visit.',
          recordDate: new Date(),
          createdAt: new Date(),
          data: { bp: '135/82', hr: 72, temp: 98.6, rr: 16, spo2: 98 },
        },
        {
          id: randomUUID(),
          recordType: 'PRESCRIPTION',
          title: 'Lisinopril 10mg Prescription',
          description: 'For hypertension management.',
          recordDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
          createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
          data: { dosage: '10mg', frequency: 'Daily', route: 'Oral', qty: 30, refills: 3 },
        },
      ],
      clinicalNotes: [
        {
          id: randomUUID(),
          noteType: 'SOAP',
          title: 'Cardiology Follow-up Note',
          subjective: 'Patient reports mild morning headaches but notes good compliance with daily Lisinopril. No shortness of breath or chest pain reported.',
          objective: 'BP: 134/80 mmHg, HR: 74 bpm. Lungs clear. Heart rate regular with normal S1/S2, no murmurs.',
          assessment: 'Stage 1 Hypertension, currently stable on ACE inhibitor. Mild asthma with no active exacerbations.',
          plan: 'Continue Lisinopril 10mg daily. Patient to log blood pressure at home twice weekly. Follow up in 3 months.',
          isSigned: true,
          signedAt: new Date(),
          doctorName: 'Dr. Evelyn Chen',
          createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
        },
      ],
    },
    {
      id: 'P-3301',
      mrn: 'MRN-3301',
      firstName: 'James',
      lastName: 'Okafor',
      dateOfBirth: new Date('1959-11-23'),
      gender: 'MALE',
      phoneNumber: '555-3301',
      bloodGroup: 'A-',
      allergies: ['Aspirin'],
      chronicConditions: ['Type 2 Diabetes', 'Osteoarthritis'],
      isActive: true,
      createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      updatedAt: new Date(),
      healthRecords: [
        {
          id: randomUUID(),
          recordType: 'VITAL_SIGNS',
          title: 'ICU Vitals Log',
          description: 'Monitored vitals in recovery unit.',
          recordDate: new Date(),
          createdAt: new Date(),
          data: { bp: '110/65', hr: 88, temp: 99.1, rr: 18, spo2: 95 },
        },
        {
          id: randomUUID(),
          recordType: 'PRESCRIPTION',
          title: 'Metformin Dosing',
          description: 'Anti-diabetic management.',
          recordDate: new Date(Date.now() - 20 * 24 * 3600 * 1000),
          createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
          data: { dosage: '500mg', frequency: 'Twice Daily', route: 'Oral', qty: 60, refills: 5 },
        },
      ],
      clinicalNotes: [
        {
          id: randomUUID(),
          noteType: 'PROGRESS',
          title: 'Post-op Day 2 Note',
          subjective: 'Patient reports moderate hip pain, managed with PCA. Eager to begin physical therapy sessions today.',
          objective: 'BP: 112/68 mmHg, Temp: 99.0 F. Surgical incision dry, intact, and well-approximated with staples. No active drainage.',
          assessment: 'Post-op Day 2 following Left Total Hip Arthroplasty. Pain controlled, no signs of deep vein thrombosis or wound infection.',
          plan: 'Initiate bedside physical therapy. Transition from IV pain meds to oral alternatives. Monitor vitals Q4H.',
          isSigned: true,
          signedAt: new Date(),
          doctorName: 'Dr. Marcus Davis',
          createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
        },
      ],
    },
    {
      id: 'P-2199',
      mrn: 'MRN-2199',
      firstName: 'Elena',
      lastName: 'Vasquez',
      dateOfBirth: new Date('1982-08-05'),
      gender: 'FEMALE',
      phoneNumber: '555-2199',
      bloodGroup: 'B+',
      allergies: [],
      chronicConditions: ['Type 2 Diabetes', 'Hypothyroidism'],
      isActive: true,
      createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000),
      updatedAt: new Date(),
      healthRecords: [
        {
          id: randomUUID(),
          recordType: 'VITAL_SIGNS',
          title: 'Endocrine Intake Vitals',
          recordDate: new Date(),
          createdAt: new Date(),
          data: { bp: '120/78', hr: 68, temp: 98.4, rr: 14, spo2: 99 },
        },
        {
          id: randomUUID(),
          recordType: 'PRESCRIPTION',
          title: 'Levothyroxine 75mcg',
          description: 'Thyroid hormone replacement.',
          recordDate: new Date(),
          createdAt: new Date(),
          data: { dosage: '75mcg', frequency: 'Once Daily (Morning)', route: 'Oral', qty: 90, refills: 2 },
        },
      ],
      clinicalNotes: [
        {
          id: randomUUID(),
          noteType: 'SOAP',
          title: 'Endocrinology Consultation Note',
          subjective: 'Patient reports mild fatigue but overall stable energy levels. Compliance with Levothyroxine is excellent.',
          objective: 'Thyroid gland non-palpable. Heart rate regular, no peripheral edema. TSH level is within normal range at 2.4 mIU/L.',
          assessment: 'Primary hypothyroidism, well-controlled on current Levothyroxine dose. Impaired fasting glucose.',
          plan: 'Continue Levothyroxine 75mcg daily. Repeat thyroid panel in 6 months. Encouraged dietary modifications and exercise.',
          isSigned: true,
          signedAt: new Date(),
          doctorName: 'Dr. Aisha Patel',
          createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000),
        },
      ],
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(dto: CreatePatientDto): Promise<Patient> {
    if (!this.prisma.isConnected) {
      // In-Memory Create
      const existing = this.mockPatients.find((p) => p.mrn === dto.mrn && p.isActive);
      if (existing) {
        throw new ConflictException(`A patient with MRN "${dto.mrn}" already exists.`);
      }
      const newPatient: MockPatient = {
        id: `P-${Math.floor(1000 + Math.random() * 9000)}`,
        mrn: dto.mrn,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        phoneNumber: dto.phoneNumber,
        bloodGroup: dto.bloodGroup,
        allergies: dto.allergies ?? [],
        chronicConditions: dto.chronicConditions ?? [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        healthRecords: [],
        clinicalNotes: [],
      };
      this.mockPatients.push(newPatient);
      this.logger.log(`Mock Patient created: id=${newPatient.id} mrn=${newPatient.mrn}`);
      return this.mapMockToPatient(newPatient);
    }

    // Prisma DB Create
    const existing = await this.prisma.patient.findUnique({
      where: { mrn: dto.mrn },
    });
    if (existing) {
      throw new ConflictException(`A patient with MRN "${dto.mrn}" already exists.`);
    }

    const data: Prisma.PatientCreateInput = {
      mrn: dto.mrn,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: new Date(dto.dateOfBirth),
      gender: dto.gender,
      phoneNumber: dto.phoneNumber ?? null,
      bloodGroup: dto.bloodGroup ?? null,
      allergies: dto.allergies ?? [],
      chronicConditions: dto.chronicConditions ?? [],
      emergencyContact: dto.emergencyContact
        ? (dto.emergencyContact as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      user: dto.userId ? { connect: { id: dto.userId } } : undefined,
    };

    const patient = await this.prisma.patient.create({ data });
    this.logger.log(`Patient created: id=${patient.id} mrn=${patient.mrn}`);
    return patient;
  }

  // ---------------------------------------------------------------------------
  // READ — paginated list
  // ---------------------------------------------------------------------------

  async findAll(page: number = 1, limit: number = 20): Promise<PaginatedResult<Patient>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    if (!this.prisma.isConnected) {
      // In-Memory Find All
      const activePatients = this.mockPatients.filter((p) => p.isActive);
      const total = activePatients.length;
      const data = activePatients.slice(skip, skip + safeLimit).map((p) => this.mapMockToPatient(p));
      return {
        data,
        meta: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where: { isActive: true },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where: { isActive: true } }),
    ]);

    return {
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // READ — single by id
  // ---------------------------------------------------------------------------

  async findOne(id: string): Promise<Patient> {
    if (!this.prisma.isConnected) {
      const p = this.mockPatients.find((x) => x.id === id && x.isActive);
      if (!p) {
        throw new NotFoundException(`Patient with id "${id}" not found.`);
      }
      return this.mapMockToPatient(p);
    }

    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with id "${id}" not found.`);
    }
    return patient;
  }

  async findByMrn(mrn: string): Promise<Patient | null> {
    if (!this.prisma.isConnected) {
      const p = this.mockPatients.find((x) => x.mrn === mrn && x.isActive);
      return p ? this.mapMockToPatient(p) : null;
    }
    return this.prisma.patient.findUnique({ where: { mrn } });
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    if (!this.prisma.isConnected) {
      const index = this.mockPatients.findIndex((x) => x.id === id && x.isActive);
      if (index === -1) {
        throw new NotFoundException(`Patient with id "${id}" not found.`);
      }

      if (dto.mrn !== undefined) {
        const collision = this.mockPatients.find((x) => x.mrn === dto.mrn && x.id !== id && x.isActive);
        if (collision) {
          throw new ConflictException(`MRN "${dto.mrn}" is already in use by another patient.`);
        }
      }

      const p = this.mockPatients[index];
      this.mockPatients[index] = {
        ...p,
        ...(dto.mrn !== undefined && { mrn: dto.mrn }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup }),
        ...(dto.allergies !== undefined && { allergies: dto.allergies }),
        ...(dto.chronicConditions !== undefined && { chronicConditions: dto.chronicConditions }),
        updatedAt: new Date(),
      };
      return this.mapMockToPatient(this.mockPatients[index]);
    }

    await this.findOne(id);
    if (dto.mrn !== undefined) {
      const collision = await this.prisma.patient.findFirst({
        where: { mrn: dto.mrn, NOT: { id } },
      });
      if (collision) {
        throw new ConflictException(`MRN "${dto.mrn}" is already in use by another patient.`);
      }
    }

    const data: Prisma.PatientUpdateInput = {
      ...(dto.mrn !== undefined && { mrn: dto.mrn }),
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
      ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup }),
      ...(dto.allergies !== undefined && { allergies: dto.allergies }),
      ...(dto.chronicConditions !== undefined && { chronicConditions: dto.chronicConditions }),
      ...(dto.emergencyContact !== undefined && {
        emergencyContact: dto.emergencyContact ? (dto.emergencyContact as any) : Prisma.JsonNull,
      }),
    };

    return this.prisma.patient.update({ where: { id }, data });
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  async remove(id: string): Promise<void> {
    if (!this.prisma.isConnected) {
      const p = this.mockPatients.find((x) => x.id === id && x.isActive);
      if (!p) throw new NotFoundException(`Patient with id "${id}" not found.`);
      p.isActive = false;
      return;
    }
    await this.findOne(id);
    await this.prisma.patient.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------------------------------------------------------------
  // SEARCH — Handles searching by phone, age, name, and MRN
  // ---------------------------------------------------------------------------

  async search(query: string): Promise<Patient[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    if (!this.prisma.isConnected) {
      // Check if query is a numeric age
      const numericAge = parseInt(trimmed, 10);
      const isAge = !isNaN(numericAge) && numericAge > 0 && numericAge < 120;

      return this.mockPatients
        .filter((p) => {
          if (!p.isActive) return false;

          // Compute age
          const today = new Date();
          const birthDate = new Date(p.dateOfBirth);
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }

          const matchName =
            p.firstName.toLowerCase().includes(trimmed) ||
            p.lastName.toLowerCase().includes(trimmed) ||
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(trimmed);

          const matchMrn = p.mrn.toLowerCase().includes(trimmed);
          const matchPhone = p.phoneNumber?.toLowerCase().includes(trimmed) ?? false;
          const matchAge = isAge && age === numericAge;

          return matchName || matchMrn || matchPhone || matchAge;
        })
        .map((p) => this.mapMockToPatient(p));
    }

    // Prisma DB Search
    const numericAge = parseInt(trimmed, 10);
    const isAge = !isNaN(numericAge) && numericAge > 0 && numericAge < 120;

    let dobFilter: Prisma.DateTimeFilter | undefined;
    if (isAge) {
      const currentYear = new Date().getFullYear();
      const targetBirthYear = currentYear - numericAge;
      const startDate = new Date(`${targetBirthYear}-01-01`);
      const endDate = new Date(`${targetBirthYear}-12-31T23:59:59`);
      dobFilter = { gte: startDate, lte: endDate };
    }

    return this.prisma.patient.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: trimmed, mode: 'insensitive' } },
          { lastName: { contains: trimmed, mode: 'insensitive' } },
          { mrn: { contains: trimmed, mode: 'insensitive' } },
          { phoneNumber: { contains: trimmed, mode: 'insensitive' } },
          ...(dobFilter ? [{ dateOfBirth: dobFilter }] : []),
        ],
      },
      orderBy: { lastName: 'asc' },
      take: 50,
    });
  }

  // ---------------------------------------------------------------------------
  // EHR Health Records (Vitals, Meds) Endpoints
  // ---------------------------------------------------------------------------

  async getHealthRecords(patientId: string): Promise<any[]> {
    if (!this.prisma.isConnected) {
      const p = this.mockPatients.find((x) => x.id === patientId && x.isActive);
      if (!p) throw new NotFoundException(`Patient not found.`);
      return p.healthRecords;
    }
    return this.prisma.electronicHealthRecord.findMany({
      where: { patientId },
      orderBy: { recordDate: 'desc' },
    });
  }

  async addHealthRecord(patientId: string, record: { recordType: string; title: string; description?: string; data: any }): Promise<any> {
    if (!this.prisma.isConnected) {
      const p = this.mockPatients.find((x) => x.id === patientId && x.isActive);
      if (!p) throw new NotFoundException(`Patient not found.`);
      const newRecord = {
        id: randomUUID(),
        ...record,
        recordDate: new Date(),
        createdAt: new Date(),
      };
      p.healthRecords.unshift(newRecord);
      return newRecord;
    }
    return this.prisma.electronicHealthRecord.create({
      data: {
        patientId,
        recordType: record.recordType,
        title: record.title,
        description: record.description,
        data: record.data,
        recordDate: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // EHR Clinical Notes (SOAP, progress) Endpoints
  // ---------------------------------------------------------------------------

  async getClinicalNotes(patientId: string): Promise<any[]> {
    if (!this.prisma.isConnected) {
      const p = this.mockPatients.find((x) => x.id === patientId && x.isActive);
      if (!p) throw new NotFoundException(`Patient not found.`);
      return p.clinicalNotes;
    }
    return this.prisma.clinicalNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addClinicalNote(patientId: string, note: { noteType: string; title: string; subjective?: string; objective?: string; assessment?: string; plan?: string; rawContent?: string; doctorName: string }): Promise<any> {
    if (!this.prisma.isConnected) {
      const p = this.mockPatients.find((x) => x.id === patientId && x.isActive);
      if (!p) throw new NotFoundException(`Patient not found.`);
      const newNote = {
        id: randomUUID(),
        ...note,
        isSigned: true,
        signedAt: new Date(),
        createdAt: new Date(),
      };
      p.clinicalNotes.unshift(newNote);
      return newNote;
    }

    // Prisma DB Note Create (for simplicity we will connect/associate a seed doctor ID or create one)
    let doctor = await this.prisma.doctor.findFirst();
    if (!doctor) {
      // Create seed doctor
      const seedUser = await this.prisma.user.create({
        data: {
          firebaseUid: 'seed-doctor-uid-123',
          email: 'doctor.test@hospital.com',
          displayName: 'Dr. Test Staff',
          role: 'DOCTOR',
        },
      });
      doctor = await this.prisma.doctor.create({
        data: {
          userId: seedUser.id,
          firstName: 'Clinical',
          lastName: 'Doctor',
          specialization: 'General Medicine',
          licenseNumber: 'MD-Seed-999',
        },
      });
    }

    return this.prisma.clinicalNote.create({
      data: {
        patientId,
        doctorId: doctor.id,
        noteType: note.noteType,
        title: note.title,
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
        rawContent: note.rawContent || `${note.subjective}\n${note.objective}\n${note.assessment}\n${note.plan}`,
        isSigned: true,
        signedAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapMockToPatient(mock: MockPatient): Patient {
    return {
      id: mock.id,
      userId: null,
      mrn: mock.mrn,
      firstName: mock.firstName,
      lastName: mock.lastName,
      dateOfBirth: mock.dateOfBirth,
      gender: mock.gender,
      phoneNumber: mock.phoneNumber ?? null,
      bloodGroup: mock.bloodGroup ?? null,
      allergies: mock.allergies,
      chronicConditions: mock.chronicConditions,
      emergencyContact: null,
      isActive: mock.isActive,
      createdAt: mock.createdAt,
      updatedAt: mock.updatedAt,
    };
  }
}

function containsOrEmpty(val: string): Prisma.StringFilter {
  return { contains: val, mode: 'insensitive' };
}
