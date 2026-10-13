import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListEmployeesDto } from './list-employees.dto';

export class ListHierarchyDto extends ListEmployeesDto {
  @IsIn(['ROOTS', 'REPORTS', 'DEPARTMENT', 'SEARCH', 'CANDIDATES'])
  view: 'ROOTS' | 'REPORTS' | 'DEPARTMENT' | 'SEARCH' | 'CANDIDATES' = 'ROOTS';
  @IsOptional() @IsUUID() managerId?: string;
}
