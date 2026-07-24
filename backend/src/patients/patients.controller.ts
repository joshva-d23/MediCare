import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Patient } from '@prisma/client';

import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PaginatedResult } from '../common/types/pagination.types';

@ApiTags('Patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // ---------------------------------------------------------------------------
  // POST /patients
  // ---------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 409, description: 'MRN already in use.' })
  async create(@Body() dto: CreatePatientDto): Promise<Patient> {
    return this.patientsService.create(dto);
  }

  // ---------------------------------------------------------------------------
  // GET /patients
  // ---------------------------------------------------------------------------

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all active patients (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated list of patients.' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedResult<Patient>> {
    return this.patientsService.findAll(page, limit);
  }

  // ---------------------------------------------------------------------------
  // GET /patients/search?q=
  // ---------------------------------------------------------------------------

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search patients by name or MRN' })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search term (first name, last name, or MRN)',
  })
  @ApiResponse({ status: 200, description: 'Matching patients returned.' })
  @ApiResponse({ status: 400, description: 'Missing or empty query parameter.' })
  async search(@Query('q') query: string): Promise<Patient[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return this.patientsService.search(query);
  }

  // ---------------------------------------------------------------------------
  // GET /patients/:id
  // ---------------------------------------------------------------------------

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single patient by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Patient record returned.' })
  @ApiResponse({ status: 404, description: 'Patient not found.' })
  async findOne(
    @Param('id') id: string,
  ): Promise<Patient> {
    return this.patientsService.findOne(id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /patients/:id
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Partially update a patient record' })
  @ApiParam({ name: 'id', type: String, description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Patient updated successfully.' })
  @ApiResponse({ status: 404, description: 'Patient not found.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ): Promise<Patient> {
    return this.patientsService.update(id, dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE /patients/:id  (soft delete)
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a patient' })
  @ApiParam({ name: 'id', type: String, description: 'Patient ID' })
  @ApiResponse({ status: 204, description: 'Patient deactivated.' })
  @ApiResponse({ status: 404, description: 'Patient not found.' })
  async remove(
    @Param('id') id: string,
  ): Promise<void> {
    return this.patientsService.remove(id);
  }

  // ---------------------------------------------------------------------------
  // GET /patients/:id/records
  // ---------------------------------------------------------------------------

  @Get(':id/records')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get patient medical and treatment records' })
  async getRecords(@Param('id') id: string): Promise<any[]> {
    return this.patientsService.getHealthRecords(id);
  }

  // ---------------------------------------------------------------------------
  // POST /patients/:id/records
  // ---------------------------------------------------------------------------

  @Post(':id/records')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a treatment or vital signs record' })
  async addRecord(
    @Param('id') id: string,
    @Body() body: { recordType: string; title: string; description?: string; data: any },
  ): Promise<any> {
    return this.patientsService.addHealthRecord(id, body);
  }

  // ---------------------------------------------------------------------------
  // GET /patients/:id/notes
  // ---------------------------------------------------------------------------

  @Get(':id/notes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get patient clinical notes' })
  async getNotes(@Param('id') id: string): Promise<any[]> {
    return this.patientsService.getClinicalNotes(id);
  }

  // ---------------------------------------------------------------------------
  // POST /patients/:id/notes
  // ---------------------------------------------------------------------------

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a clinical note' })
  async addNote(
    @Param('id') id: string,
    @Body() body: { noteType: string; title: string; subjective?: string; objective?: string; assessment?: string; plan?: string; rawContent?: string; doctorName: string },
  ): Promise<any> {
    return this.patientsService.addClinicalNote(id, body);
  }
}
