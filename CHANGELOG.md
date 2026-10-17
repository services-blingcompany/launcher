# Changelog del Bling Launcher

Todo lo notable del launcher, con la versión más nueva arriba.

El workflow de CI extrae la sección de la versión del tag que se está
publicando y la usa como cuerpo del release de GitHub, así que cada
release sale documentada sin tocar nada a mano.

Formato de cada sección: el encabezado debe empezar con `## [X.Y.Z]`,
tal cual. Lo que hay debajo (hasta el próximo `## `) va al release.

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
