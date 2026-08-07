import LoginPage from "../page";

/**
 * La misma pantalla de entrada, pero sabiendo de qué academia se trata.
 *
 * `/login` a secas no pertenece a nadie, así que sale con la marca de Klaze.
 * `/login/mentoria-v7` sale con el nombre, el logo y el vídeo de esa academia
 * — es el enlace que se le manda a un alumno.
 *
 * El formulario es el mismo componente: quien entra por aquí y quien entra por
 * el genérico hacen exactamente lo mismo, y duplicarlo habría garantizado que
 * uno de los dos se quedara atrás.
 */
export default function LoginDeAcademiaPage() {
  return <LoginPage />;
}
