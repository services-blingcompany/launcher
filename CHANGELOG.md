# Changelog del Bling Launcher

Todo lo notable del launcher, con la versión más nueva arriba.

El workflow de CI extrae la sección de la versión del tag que se está
publicando y la usa como cuerpo del release de GitHub, así que cada
release sale documentada sin tocar nada a mano.

Formato de cada sección: el encabezado debe empezar con `## [X.Y.Z]`,
tal cual. Lo que hay debajo (hasta el próximo `## `) va al release.

## [1.9.0]

- **Las ventanas de servicio ahora son del launcher.** Cada servicio abre con una barra propia: atrás, adelante, recargar (con aviso de carga), el título de la página, abrir en el navegador y los controles de ventana (minimizar, maximizar, cerrar). Se acabó la ventana pelada con el marco de Windows.
- **Zoom en los servicios.** Ctrl +, Ctrl − y Ctrl 0 también funcionan ahí, sobre la página; la barra mantiene su tamaño.
- **Ventanas de servicio en el diagnóstico**, para saber con qué contexto se reportó un problema.

## [1.8.0]

- **Avisos de escritorio.** Cuando llegan notificaciones nuevas, Windows muestra un aviso nativo; al tocarlo se abre la bandeja de notificaciones en el launcher. El texto es genérico ("Tenés 3 notificaciones nuevas") a propósito: en la pantalla de bloqueo se lee sin pedir permiso, así que el contenido no viaja.
- **Icono marcado.** Mientras haya algo sin leer, el icono del launcher en la barra de tareas queda marcado y el tooltip de la bandeja cuenta cuántas hay.
- **Avisos de escritorio en Ajustes**, en su propia sección, para apagarlos.

## [1.7.0]

- **Zoom de la interfaz.** Ctrl + agranda, Ctrl − achica y Ctrl 0 vuelve al 100 %, desde el hub y desde las ventanas de servicio. El nivel se recuerda entre sesiones y también se cambia desde Ajustes, donde se ve el porcentaje.
- **Content Security Policy.** El renderer declara una política cerrada —nada de red, sólo lo que sirve el propio bundle— así que Electron dejó de avisar en cada arranque y un hipotético script inyectado ya no podría pedir ni cargar nada de afuera.
- **Identidad de app.** El launcher se identifica con el mismo appId del instalador: agrupado correcto en la barra de tareas y base para las notificaciones nativas.
- **Jump list.** El clic derecho en el icono de la barra de tareas lista los servicios del catálogo y abre el launcher directo en el elegido (`--abrir=<servicio>`), incluso si ya estaba abierto.

## [1.6.0]

- **"Acerca de" con reporte de problema.** En Ajustes hay una sección nueva con la versión instalada y un acceso a las novedades. Desde ahí, "Reportar" arma el diagnóstico (versión de la app, Electron, Chromium, Node, Windows, tamaño de la ventana, ajustes y las últimas líneas del registro), deja escribir qué pasó y lo copia o lo guarda como .txt. No lleva correo, ni alias, ni tokens, ni cookies.
- **Registro en disco.** Lo que el launcher avisa queda en `%APPDATA%\Bling Launcher\logs\launcher.log` (se recicla solo a los ~512 KB): avisos y errores propios, caídas del proceso de render, cargas fallidas, errores del renderer y si el puente de login no pasó el reto de Cloudflare. Antes, en la app instalada, esos avisos se perdían.
- El panel de ajustes scrollea si la ventana es baja.

## [1.5.0]

- **Menú de clic derecho.** Electron no trae ninguno, así que hasta ahora no se podía pegar la contraseña en el login, copiar el alias de BlingPay ni copiar texto dentro de los servicios. Ahora el clic derecho ofrece lo que corresponde en cada caso:
  - en un campo de texto: deshacer, rehacer, cortar, copiar, pegar y seleccionar todo (cada uno se deshabilita cuando no aplica);
  - sobre texto seleccionado: copiar y seleccionar todo;
  - sobre una imagen: copiar imagen y guardar imagen…;
  - sobre un enlace: abrirlo en la misma ventana si es del sitio, y siempre copiar el enlace.
- Donde no hay nada que ofrecer no aparece nada, como en cualquier app.
- El mismo menú está en el hub y en las ventanas de los servicios.

## [1.4.0]

- **La derecha, a la altura de la izquierda.** El contenido ahora te saluda por tu nombre ("Buenas, Facundo.") cuando hay sesión, el buscador baja de la barra superior al cuerpo y pasa a ser el protagonista de la pantalla, y la ayuda de teclado se convierte en una línea discreta (antes eran tres cajitas que competían con el título).
- **Tarjeta destacada en formato hero.** Más alta, con la llamada **Abrir** a la vista y el icono del servicio como marca de agua que llena el aire de la derecha. También deja de mostrar el borde claro cuando está seleccionada: se marca con la misma barrita del acento que las filas.
- **Panel de cuenta.** En ventanas anchas aparece una columna a la derecha con tu avatar, tu alias de BlingPay (copiable con un clic) y accesos directos a Mi perfil, Ajustes de cuenta y Notificaciones, más el estado del launcher (servicios disponibles y versión, con el chequeo de actualizaciones). En ventanas angostas se oculta solo: todo sigue estando en el menú de usuario y en el pie.
- La barra superior queda para lo esencial: **Bling Launcher** + versión a la izquierda; ajustes, bling.uy y tu usuario a la derecha.
- Interno: las URLs de las páginas de cuenta viven en un solo lugar (`src/lib/cuenta.ts`) y las usan tanto el menú de usuario como el panel.

## [1.3.1]

- **Tipografía de la casa**: todo el texto pasa a **Montserrat** (la del ecosistema, en lugar de Barlow) y los micro-rótulos a **JetBrains Mono** (en lugar de la mono del sistema).
- **Bordes parejos**: la tarjeta destacada arrancaba seleccionada y mostraba un borde claro que desentonaba con las filas. Ahora todas comparten el mismo borde sutil y la selección se marca con la barrita del acento, igual que en el resto.

## [1.3.0]

### Sesión de Bling

- **Iniciar sesión sin salir del launcher**: el correo y la contraseña se escriben acá mismo. Los mensajes son los mismos que en la web (credenciales incorrectas, cuenta sin verificar, mantenimiento).
- **Botón de usuario**: con sesión activa, la barra superior muestra tu avatar (o tus iniciales) y tu nombre, la campanita con las notificaciones sin leer y un menú con **Mi perfil**, **Ajustes de cuenta**, **Notificaciones**, tu alias de **BlingPay** (se copia con un clic) y **Cerrar sesión**.
- **Una sesión para todo el ecosistema**: al entrar, cada servicio que abras (Bling Noticias, Social, Fundadores) ya viene logueado. Cerrar sesión también la cierra en el backend.

Por dentro: las credenciales las maneja el proceso principal —el renderer nunca las ve y la cookie de acceso es httpOnly— y las páginas de cuenta se abren en ventanas embebidas, con la misma sesión.

## [1.2.3]

- **Rail izquierdo renovado**: la campana de Bling reemplaza al rombo, con un pulso de ondas que salen en loop desde su centro (con halo amarillo de fondo). Respeta la preferencia de movimiento reducido del sistema.

## [1.2.2]

- **Icono nuevo**: la campana de Bling reemplaza al rombo — aparece en el icono de la app (escritorio, taskbar, instalador) y en la bandeja del sistema.

## [1.2.1]

- **Logo del wordmark**: la campana ahora usa el PNG oficial (con ondas), integrada en el slot de la «n» del logo «Bling».
- `app-update.yml` generado también en builds `--dir` para probar actualización local sin instalar.

## [1.2.0]

### Actualizaciones automáticas

- **Se actualiza solo**: cuando sale una versión nueva, el launcher la detecta, la descarga en segundo plano y te avisa. Basta con tocar "Instalar ahora"; si lo dejás estar, se instala al salir.
- **Descarga más liviana**: usa descarga diferencial, así que sólo baja lo que cambió desde tu versión.
- **Barra de progreso**: el aviso ahora muestra cuánto falta de la descarga.

### Ajustes

Nuevo panel de ajustes (el ícono de engranaje, arriba a la derecha):

- **Abrir al iniciar Windows**: el launcher arranca solo cuando entrás a la sesión.
- **Minimizar a la bandeja al cerrar**: cerrar la ventana la esconde en vez de salir; para salir de verdad usás "Salir" en la bandeja. La bandeja tiene un submenú con todos los servicios.
- **Descargar automáticamente**: bajá las versiones nuevas sin preguntar.
- **Borrar servicios recientes**: limpia la lista de lo que abriste por última vez. Se guardan sólo en tu equipo.

### Logo

- La campana de Bling se actualizó en todo el ecosistema, incluido el launcher.

## [1.1.0]

### Nuevos

- **Navegación con teclado**: `/` enfoca el buscador, `↑ ↓` recorren los servicios y `Enter` abre el seleccionado.
- **Recientes**: los últimos servicios que abriste quedan arriba del todo.
- **Abrir en navegador**: cada servicio tiene una acción secundaria para abrirlo en el navegador del sistema.
- **La ventana se acuerda de vos**: recuerda tamaño, posición y si la tenías maximizada.
- **Logo nuevo**: la campana de Bling se actualizó en todo el ecosistema.

### Arreglos

- **Segunda instancia**: si el launcher ya estaba abierto, abrirlo de nuevo recrea la ventana correctamente.
- **Sesiones compartidas**: se corrigió el texto. Entrás una vez y te conoce todo el ecosistema.
- **Búsqueda sin acentos**: "segui" encuentra Social, "postula" encuentra Fundadores.
- **Permisos más seguros**: la app pide sólo notificaciones, multimedia, pantalla completa y portapapeles. Todo lo demás se rechaza.
- **Menos movimiento**: respeta la configuración de "reducir movimiento" de tu sistema.

## [1.0.0]

- Primera versión: todos los servicios de Bling en una sola app de escritorio, con sesión compartida y ventanas embebidas por servicio.
