// Lo que queda de los datos semilla: solo lo que sigue alimentando
// `/plataforma`, el área de superadmin, que todavía no lee de la base.
//
// Los mocks de posts, eventos y cursos se borraron al migrar la vida social:
// ya no los leía nadie. Estos cuatro caerán con la rebanada 4.
export { mockUsers } from "@/lib/mocks/users";
export { mockCommunities } from "@/lib/mocks/communities";
export { mockPlans } from "@/lib/mocks/plans";
export { mockEnrollments } from "@/lib/mocks/enrollments";
