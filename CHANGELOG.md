# Changelog del Bling Launcher

Todo lo notable del launcher, con la versión más nueva arriba.

El workflow de CI extrae la sección de la versión del tag que se está
publicando y la usa como cuerpo del release de GitHub, así que cada
release sale documentada sin tocar nada a mano.

Formato de cada sección: el encabezado debe empezar con `## [X.Y.Z]`,
tal cual. Lo que hay debajo (hasta el próximo `## `) va al release.

## [1.19.3]

- Igual que la 1.19.2, con la credencial de Google embebida en el build: el login con Google sale del navegador de siempre sin pedirte la cuenta. (Release para asegurar que el secreto quedó adentro del instalador.)

## [1.19.2]

- **Login sin espera.** El botón de inicio de sesión ahora aparece al instante en cada arranque: se recuerda la última sesión conocida y después se confirma en segundo fondo, sin el rato en que quedaba cargando.
- **Actualizaciones detectadas más seguido.** El launcher busca versiones nuevas cada 30 minutos (antes cada 4 horas) y te avisa con el cartel dorado al lado de los botones.
- **Login con Google más confiable.** Se unificó la configuración de Google (`BLING_GOOGLE_CLIENT_ID` / `BLING_GOOGLE_CLIENT_SECRET`) y, si falta el secreto, se avisa claro en vez de fallar a mitad de camino.

## [1.19.1]

- **Entrá con Google sin recordar tu cuenta.** El botón "Continuar con Google" ahora abre Google en **tu navegador de siempre**, donde ya tenés la sesión iniciada: un clic y listo, en vez de una ventana aparte que pedía volver a poner el usuario y la contraseña.
- **Cómo funciona por adentro.** El launcher usa OAuth con PKCE y un redirect local (RFC 8252): el navegador confirma con Google y el launcher recibe el resultado de forma segura, sin guardar credenciales. La sesión queda en todo el ecosistema Bling, igual que si entrás por la web.
- El login con correo y contraseña sigue igual, por si preferís usarlo.

## [1.18.1]

- **El hub vuelve a arrancar desde el código fuente.** El commit de 1.17.0 dejó dos bloques de imports al inicio de `licencias.cjs` y eso frenaba la carga del proceso principal con un error de sintaxis. Ninguna batería lo veía (ni TypeScript ni vitest parsean los módulos de Electron): sólo lo frenaba arrancar la app. El launcher instalado no estaba afectado porque venía de una compilación anterior.

## [1.18.0]

- **Soporte adentro del launcher, con sidebar.** Un botón nuevo al lado de Ajustes (el redondel de salvavidas) abre la pantalla de soporte: la lista de tus tickets a la izquierda, la conversación a la derecha, y Escape te vuelve al catálogo. Mismo look de siempre, sin salir de la app.
- **El ticket se abre desde el chat, sin formularios.** Apretás "Nuevo", escribís lo que necesitás y recién ahí se abre el ticket: el ID (por ejemplo BLING-0007) queda visible arriba de la conversación y el asunto lo arma Bling con lo que escribiste.
- **Hasta 4 capturas por mensaje.** Pegás la imagen con Ctrl+V o la elegís con el botón de cámara. Las pesadas se comprimen en tu PC antes de subir (máximo 1600 px) y el servidor las guarda en AVIF; las miniaturas se ven dentro del chat.
- **¿Querés ofrecer más datos de tu equipo?** Al abrir un ticket preguntamos si querés compartir sistema operativo, versión del launcher, idioma y zona horaria. Si lo activás, ese bloque viaja con tu primer mensaje; si no, no se manda nada. Viene apagado.
- **Cerrar y reabrir, desde el encabezado.** Cuando el equipo da por resuelto el ticket lo podés reabrir desde el mismo chat, y si querés cerrarlo vos, también.
- La lógica de topes y formato del soporte quedó en un módulo propio, con pruebas.

## [1.17.0]

- **Abrir el Contable instalado, de un toque.** Si el Contable ya está en tu PC, la fila muestra "Abrir" y lanza directo la app de escritorio (sin pasar por la web ni por el instalador). Si todavía no está, sigue el camino de siempre: Descargar y Instalar.
- **El Contable no te va a pedir iniciar sesión.** El launcher es el único que cuida tu sesión de Bling: al abrir la app instalada le entrega un pase de licencia de 7 días que la propia app renueva sola mientras tu plan siga vigente. Si el pase vence o el plan ya no incluye el Contable, la app te devuelve al launcher.
- **Tras instalar, el pase llega solo.** En cuanto el instalador termina de copiar los archivos, el launcher detecta que la app apareció y le entrega el pase; si la app ya se había abierto sola, lo recibe igual.
- La lógica de rutas de instalación quedó en el módulo de licencias, con pruebas.

## [1.16.0]

- **Catálogo de apps con licencias.** El launcher ya no es sólo un navegador de servicios: muestra las apps del ecosistema con el estado de tu cuenta. Si tu plan incluye una app, la fila lo dice ("En tu plan"); si no, dice qué plan la trae y el botón "Ver planes" te lleva a bling.uy.
- **Descargá el Contable a tu PC.** Con licencia vigente, el botón "Descargar" baja la última versión de escritorio al launcher, con progreso visible. El archivo se verifica contra la huella que publica Bling antes de guardarse: si no coincide, se descarta y se avisa.
- **Instalar de un toque.** Cuando la descarga quedó guardada, el botón pasa a "Instalar" y ejecuta el instalador. La versión ya descargada no se vuelve a bajar.
- **El catálogo llega con tu sesión puesta.** Quien tiene sesión activa ve sus apps desbloqueadas al instante; quien cierra sesión vuelve al catálogo sin licencias.
- **"Ver planes" lleva al catálogo de planes de Bling.** El botón abre la página pública de planes (precios y características de cada plan), en bling.uy.

## [1.15.0]

- **Atajo global para traer el launcher al frente.** Con **Ctrl + Shift + B** el launcher aparece desde cualquier aplicación, incluso si lo habías minimizado o escondido en la bandeja. Si otra aplicación ya usa esa combinación, prueba con **Ctrl + Alt + B**; si ninguna queda libre, lo deja anotado y el interruptor no tiene efecto (nunca le pisa el atajo a otro programa). Viene **apagado**: se enciende en Ajustes → General, y ahí mismo dice qué combinación quedó activa.
- **El registro ya no puede guardar credenciales en una dirección.** Cuando una página no carga, la dirección se anota sin su consulta ni su fragmento: ahí viajan los códigos de un solo uso (el retorno de Google, por ejemplo) que no tienen por qué quedar en un archivo de texto que después se comparte.
- **El registro y el reporte de diagnóstico no llevan el nombre de usuario del equipo.** Las rutas se muestran con la carpeta personal abreviada con `~`, así se entiende dónde estaba sin publicar con qué nombre se entra a la máquina.
- El reporte avisa en su encabezado que no lleva datos de la cuenta: ni correo, ni alias, ni tokens, ni cookies.

## [1.14.0]

- **Si el sitio no responde, se ve una pantalla del launcher y no el error crudo de Chromium.** Cuando una ventana de servicio no puede cargar —se cayó internet, el servicio no contesta—, aparece una pantalla propia, con la campana, el mismo fondo y el acento de siempre, que cuenta qué pasó y ofrece **Reintentar**.
- **La barra lo avisa.** Mientras está esa pantalla, la barra acompaña el nombre del servicio con un distintivo "Sin conexión", así se entiende de un vistazo por qué no hay página.
- **Reintentar de verdad.** El botón de la pantalla, el de recargar de la barra y F5 o Ctrl+R vuelven a la dirección que falló, no a la pantalla local; "abrir en el navegador" también abre esa dirección.
- El texto distingue los dos casos: cuando el problema parece de tu equipo ("Parece que no hay internet") y cuando parece del otro lado ("No pudimos conectar con Bling"). La pantalla no le pide nada al proceso principal: no lleva preload, y "Reintentar" es un enlace común.
- La lógica de red quedó en un módulo propio, con pruebas.

## [1.13.0]

- **La ventana de inicio de sesión de Google no puede pedir ningún permiso.** Es una página ajena: no tiene por qué usar la cámara, el micrófono, las notificaciones ni la pantalla completa del launcher, y ahora no puede. Los servicios siguen con los suyos (avisos, cámara y micrófono de los lives, pantalla completa y copiar enlaces), sin cambios.
- La lista de hosts de inicio de sesión quedó en un módulo propio, con pruebas: sólo https y comparando el dominio exacto, así un subdominio parecido (`accounts.google.com.algo-malo.com`) no pasa.

## [1.12.0]

- **Iniciar sesión con Google, adentro del launcher.** El diálogo de login ahora tiene "Continuar con Google": abre la página de login del sitio en una ventana del launcher (con su barra y la misma sesión) y, cuando entrás, el hub se entera al instante y aparece tu cuenta sin esperar. El popup de Google se abre como ventana hija del launcher: el token vuelve a la página como en el navegador.
- **El launcher ya no se presenta como Electron.** El user agent pierde la huella `Electron/x.y.z` (queda el Chromium y el nombre del launcher), que es lo que hacía que Google rechazara su ventana de inicio de sesión.
- **El puente de auth reintenta el reto de Cloudflare.** Si el primer intento queda a medias, recarga y prueba una vez más; si igual no pasa, vuelve a intentarlo más tarde en vez de quedarse sin sesión hasta reiniciar el launcher.

## [1.11.0]

- **Atajos de navegación en las ventanas de servicio**, como en cualquier navegador: F5 o Ctrl R recargan, Alt + ← y Alt + → van atrás y adelante, y Ctrl W cierra la ventana.
- **El diagnóstico dice si había sesión** (con cuenta o sin cuenta), sin un solo dato de la cuenta.

## [1.10.0]

- **Crear cuenta y recuperar la contraseña, sin salir del launcher.** Los dos atajos del login abren las páginas del auth en una ventana del launcher —con su barra y la misma sesión— en vez del navegador del sistema. Lo mismo para "Verificar mi cuenta" cuando el correo todavía no está confirmado.
- **La barra de los servicios muestra el nombre del servicio** (lo que abriste) y deja el título de la página como detalle al pasar el mouse, en vez de mostrar el título crudo del sitio.

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
