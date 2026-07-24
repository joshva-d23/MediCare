import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsJSON,
  ArrayNotEmpty,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmergencyContactDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '+1-555-0100' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'Spouse' })
  @IsOptional()
  @IsString()
  relationship?: string;
}

export class CreatePatientDto {
  /**
   * Medical Record Number — must be unique across the platform.
   */
  @ApiProperty({ example: 'MRN-2024-00001', description: 'Unique Medical Record Number' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  mrn!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  /**
   * ISO 8601 date string, e.g. "1985-06-15".
   */
  @ApiProperty({ example: '1985-06-15', description: 'ISO 8601 date of birth' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: 'MALE', description: 'MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY' })
  @IsString()
  @IsNotEmpty()
  gender!: string;

  @ApiPropertyOptional({ example: '+1-555-0143', description: 'Patient contact phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'O+', description: 'ABO blood group' })
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  /**
   * List of known drug/substance allergies.
   */
  @ApiPropertyOptional({ type: [String], example: ['Penicillin', 'Aspirin'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  /**
   * List of pre-existing chronic conditions.
   */
  @ApiPropertyOptional({ type: [String], example: ['Type 2 Diabetes', 'Hypertension'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronicConditions?: string[];

  /**
   * Emergency contact information (name, phone, relationship).
   */
  @ApiPropertyOptional({ type: EmergencyContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;

  /**
   * Optional link to an existing User account.
   */
  @ApiPropertyOptional({ example: 'uuid-of-user' })
  @IsOptional()
  @IsString()
  userId?: string;
}
