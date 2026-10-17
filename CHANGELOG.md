# Changelog del Bling Launcher

Todo lo notable del launcher, con la versión más nueva arriba.

El workflow de CI extrae la sección de la versión del tag que se está
publicando y la usa como cuerpo del release de GitHub, así que cada
release sale documentada sin tocar nada a mano.

Formato de cada sección: el encabezado debe empezar con `## [X.Y.Z]`,
tal cual. Lo que hay debajo (hasta el próximo `## `) va al release.

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
