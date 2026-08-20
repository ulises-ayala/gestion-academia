export function resolveClassOccupancy(
  activeEnrollmentCount: number | undefined,
  enrollmentTotal: number,
): number {
  return activeEnrollmentCount ?? enrollmentTotal;
}
