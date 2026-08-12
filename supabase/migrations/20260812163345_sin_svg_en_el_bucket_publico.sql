-- Fuera los SVG del bucket publico.
--
-- Un SVG no es una imagen: es un documento XML que puede llevar `<script>`
-- dentro. El bucket `publico` lo aceptaba y lo sirve con su tipo real, asi que
-- cualquiera que pueda subir un avatar podia alojar una pagina que ejecuta
-- codigo.
--
-- Lo que NO consigue, y por eso esto es medio y no alto: la URL vive en
-- `<proyecto>.supabase.co`, otro origen distinto del de la app, asi que ese
-- script no puede tocar la sesion de nadie en Klaze. Lo que si consigue es
-- alojar una pagina activa en un dominio que los alumnos reconocen como del
-- sitio --- material de phishing con tu nombre puesto.
--
-- No rompe nada: `SubirImagen` recorta y convierte a WebP en el navegador
-- ANTES de subir, asi que ningun camino real de la aplicacion sube un SVG. Y
-- se comprobo que no hay ninguno guardado.
--
-- El bucket es la comprobacion de verdad --- vive en el servidor y no depende
-- de que el navegador se porte bien --- pero la lista de `SubirImagen` se
-- ajusta igual en el mismo commit, para que el aviso salga al elegir el
-- archivo y no despues de subirlo.
update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'publico';
