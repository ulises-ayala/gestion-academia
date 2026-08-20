import type { TeacherData } from '../domain/teacher';
export const TEACHER_REPOSITORY = Symbol('TEACHER_REPOSITORY');
export type TeacherWrite = Omit<TeacherData, 'id' | 'createdAt' | 'updatedAt'>;
export type TeacherQuery = Readonly<{ q?: string; status?: 'ACTIVE' | 'INACTIVE'; page: number; pageSize: number }>;
export interface TeacherRepository { create(data: TeacherWrite): Promise<TeacherData>; update(id: string, data: TeacherWrite): Promise<TeacherData>; findById(id: string): Promise<TeacherData | null>; findByDni(dni: string): Promise<TeacherData | null>; findPage(query: TeacherQuery): Promise<{ items: TeacherData[]; total: number; page: number; pageSize: number }>; hasActiveClasses(id: string): Promise<boolean> }
