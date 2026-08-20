/** Decimal monetary values cross the API boundary as strings to preserve precision. */
export type MoneyDto = Readonly<{ amount: string; currency: string }>;

export type ApiErrorDto = Readonly<{
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  traceId?: string;
}>;

export type StudentStatusDto = 'ACTIVE' | 'INACTIVE';

export type StudentDto = Readonly<{
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  joinedAt: string;
  status: StudentStatusDto;
  createdAt: string;
  updatedAt: string;
}>;

export type StudentListDto = Readonly<{
  items: readonly StudentDto[];
  total: number;
  page: number;
  pageSize: number;
}>;

export type CreateStudentDto = Readonly<{
  dni: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}>;

export type UpdateStudentDto = Readonly<Partial<CreateStudentDto> & { status?: StudentStatusDto }>;

export type AdminRoleDto = 'ADMINISTRATOR' | 'RECEPTION' | 'MANAGER';
export type AuthUserDto = Readonly<{ id: string; username: string; role: AdminRoleDto; status: 'ACTIVE' | 'INACTIVE' }>;
export type AuthSessionDto = Readonly<{ user: AuthUserDto; expiresAt: string }>;
export type SetupStatusDto = Readonly<{ required: boolean }>;
export type AuthCredentialsDto = Readonly<{ username: string; password: string }>;
