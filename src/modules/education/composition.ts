import 'server-only';
import {DatabaseEducationStorage} from './repositories/storage';
import {EducationImportService} from './services/import-service';
export const educationData=new EducationImportService(new DatabaseEducationStorage());
export {buildAttendanceFacts,effectiveEducationScope,completeKinds} from './domain/attendance';
