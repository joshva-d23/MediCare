import { Module, Global } from '@nestjs/common';
import { AgentService } from './agent.service';
import { PatientsModule } from '../patients/patients.module';

@Global()
@Module({
  imports: [PatientsModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
