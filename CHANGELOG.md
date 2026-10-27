# Changelog del Bling Launcher

Todo lo notable del launcher, con la versiÃ³n mÃ¡s nueva arriba.

El workflow de CI extrae la secciÃ³n de la versiÃ³n del tag que se estÃ¡
publicando y la usa como cuerpo del release de GitHub, asÃ­ que cada
release sale documentada sin tocar nada a mano.

Formato de cada secciÃ³n: el encabezado debe empezar con `## [X.Y.Z]`,
tal cual. Lo que hay debajo (hasta el prÃ³ximo `## `) va al release.

## [1.19.7]

- Igual que la 1.19.6, compilada con las credenciales de Google verificadas: el acceso con Google sale de tu navegador sin pedir la cuenta.

## [1.19.6]

- Los avisos del acceso con Google suenan tranquilos y profesionales (nunca exponen errores internos). Se repararon también algunos textos con acentos rotos.

## [1.19.5]

- Mejora en el aviso de acceso con Google: si algo falla, el mensaje indica el motivo (sin datos técnicos) para poder resolverlo.

## [1.19.4]

- **Sin errores de programaciÃ³n en pantalla.** Si algo falla al entrar con Google, ahora ves un mensaje claro; los detalles tÃ©cnicos se quedan en el log, nunca en el cartel.
- **Un solo botÃ³n de Google** en la pantalla de acceso, que usa tu navegador de siempre.
- **Tu foto de perfil** se muestra bien al entrar con Google (antes a veces salÃ­an las iniciales).
- **Se arreglÃ³ un cierre inesperado** que podÃ­a pasar al cerrar una ventana (error "Object has been destroyed").

## [1.19.3]

- Igual que la 1.19.2, con la credencial de Google embebida en el build: el login con Google sale del navegador de siempre sin pedirte la cuenta. (Release para asegurar que el secreto quedÃ³ adentro del instalador.)

## [1.19.2]

- **Login sin espera.** El botÃ³n de inicio de sesiÃ³n ahora aparece al instante en cada arranque: se recuerda la Ãºltima sesiÃ³n conocida y despuÃ©s se confirma en segundo fondo, sin el rato en que quedaba cargando.
- **Actualizaciones detectadas mÃ¡s seguido.** El launcher busca versiones nuevas cada 30 minutos (antes cada 4 horas) y te avisa con el cartel dorado al lado de los botones.
- **Login con Google mÃ¡s confiable.** Se unificÃ³ la configuraciÃ³n de Google (`BLING_GOOGLE_CLIENT_ID` / `BLING_GOOGLE_CLIENT_SECRET`) y, si falta el secreto, se avisa claro en vez de fallar a mitad de camino.

## [1.19.1]

- **EntrÃ¡ con Google sin recordar tu cuenta.** El botÃ³n "Continuar con Google" ahora abre Google en **tu navegador de siempre**, donde ya tenÃ©s la sesiÃ³n iniciada: un clic y listo, en vez de una ventana aparte que pedÃ­a volver a poner el usuario y la contraseÃ±a.
- **CÃ³mo funciona por adentro.** El launcher usa OAuth con PKCE y un redirect local (RFC 8252): el navegador confirma con Google y el launcher recibe el resultado de forma segura, sin guardar credenciales. La sesiÃ³n queda en todo el ecosistema Bling, igual que si entrÃ¡s por la web.
- El login con correo y contraseÃ±a sigue igual, por si preferÃ­s usarlo.

## [1.18.1]

- **El hub vuelve a arrancar desde el cÃ³digo fuente.** El commit de 1.17.0 dejÃ³ dos bloques de imports al inicio de `licencias.cjs` y eso frenaba la carga del proceso principal con un error de sintaxis. Ninguna baterÃ­a lo veÃ­a (ni TypeScript ni vitest parsean los mÃ³dulos de Electron): sÃ³lo lo frenaba arrancar la app. El launcher instalado no estaba afectado porque venÃ­a de una compilaciÃ³n anterior.

## [1.18.0]

- **Soporte adentro del launcher, con sidebar.** Un botÃ³n nuevo al lado de Ajustes (el redondel de salvavidas) abre la pantalla de soporte: la lista de tus tickets a la izquierda, la conversaciÃ³n a la derecha, y Escape te vuelve al catÃ¡logo. Mismo look de siempre, sin salir de la app.
- **El ticket se abre desde el chat, sin formularios.** ApretÃ¡s "Nuevo", escribÃ­s lo que necesitÃ¡s y reciÃ©n ahÃ­ se abre el ticket: el ID (por ejemplo BLING-0007) queda visible arriba de la conversaciÃ³n y el asunto lo arma Bling con lo que escribiste.
- **Hasta 4 capturas por mensaje.** PegÃ¡s la imagen con Ctrl+V o la elegÃ­s con el botÃ³n de cÃ¡mara. Las pesadas se comprimen en tu PC antes de subir (mÃ¡ximo 1600 px) y el servidor las guarda en AVIF; las miniaturas se ven dentro del chat.
- **Â¿QuerÃ©s ofrecer mÃ¡s datos de tu equipo?** Al abrir un ticket preguntamos si querÃ©s compartir sistema operativo, versiÃ³n del launcher, idioma y zona horaria. Si lo activÃ¡s, ese bloque viaja con tu primer mensaje; si no, no se manda nada. Viene apagado.
- **Cerrar y reabrir, desde el encabezado.** Cuando el equipo da por resuelto el ticket lo podÃ©s reabrir desde el mismo chat, y si querÃ©s cerrarlo vos, tambiÃ©n.
- La lÃ³gica de topes y formato del soporte quedÃ³ en un mÃ³dulo propio, con pruebas.

## [1.17.0]

- **Abrir el Contable instalado, de un toque.** Si el Contable ya estÃ¡ en tu PC, la fila muestra "Abrir" y lanza directo la app de escritorio (sin pasar por la web ni por el instalador). Si todavÃ­a no estÃ¡, sigue el camino de siempre: Descargar y Instalar.
- **El Contable no te va a pedir iniciar sesiÃ³n.** El launcher es el Ãºnico que cuida tu sesiÃ³n de Bling: al abrir la app instalada le entrega un pase de licencia de 7 dÃ­as que la propia app renueva sola mientras tu plan siga vigente. Si el pase vence o el plan ya no incluye el Contable, la app te devuelve al launcher.
- **Tras instalar, el pase llega solo.** En cuanto el instalador termina de copiar los archivos, el launcher detecta que la app apareciÃ³ y le entrega el pase; si la app ya se habÃ­a abierto sola, lo recibe igual.
- La lÃ³gica de rutas de instalaciÃ³n quedÃ³ en el mÃ³dulo de licencias, con pruebas.

## [1.16.0]

- **CatÃ¡logo de apps con licencias.** El launcher ya no es sÃ³lo un navegador de servicios: muestra las apps del ecosistema con el estado de tu cuenta. Si tu plan incluye una app, la fila lo dice ("En tu plan"); si no, dice quÃ© plan la trae y el botÃ³n "Ver planes" te lleva a bling.uy.
- **DescargÃ¡ el Contable a tu PC.** Con licencia vigente, el botÃ³n "Descargar" baja la Ãºltima versiÃ³n de escritorio al launcher, con progreso visible. El archivo se verifica contra la huella que publica Bling antes de guardarse: si no coincide, se descarta y se avisa.
- **Instalar de un toque.** Cuando la descarga quedÃ³ guardada, el botÃ³n pasa a "Instalar" y ejecuta el instalador. La versiÃ³n ya descargada no se vuelve a bajar.
- **El catÃ¡logo llega con tu sesiÃ³n puesta.** Quien tiene sesiÃ³n activa ve sus apps desbloqueadas al instante; quien cierra sesiÃ³n vuelve al catÃ¡logo sin licencias.
- **"Ver planes" lleva al catÃ¡logo de planes de Bling.** El botÃ³n abre la pÃ¡gina pÃºblica de planes (precios y caracterÃ­sticas de cada plan), en bling.uy.

## [1.15.0]

- **Atajo global para traer el launcher al frente.** Con **Ctrl + Shift + B** el launcher aparece desde cualquier aplicaciÃ³n, incluso si lo habÃ­as minimizado o escondido en la bandeja. Si otra aplicaciÃ³n ya usa esa combinaciÃ³n, prueba con **Ctrl + Alt + B**; si ninguna queda libre, lo deja anotado y el interruptor no tiene efecto (nunca le pisa el atajo a otro programa). Viene **apagado**: se enciende en Ajustes â†’ General, y ahÃ­ mismo dice quÃ© combinaciÃ³n quedÃ³ activa.
- **El registro ya no puede guardar credenciales en una direcciÃ³n.** Cuando una pÃ¡gina no carga, la direcciÃ³n se anota sin su consulta ni su fragmento: ahÃ­ viajan los cÃ³digos de un solo uso (el retorno de Google, por ejemplo) que no tienen por quÃ© quedar en un archivo de texto que despuÃ©s se comparte.
- **El registro y el reporte de diagnÃ³stico no llevan el nombre de usuario del equipo.** Las rutas se muestran con la carpeta personal abreviada con `~`, asÃ­ se entiende dÃ³nde estaba sin publicar con quÃ© nombre se entra a la mÃ¡quina.
- El reporte avisa en su encabezado que no lleva datos de la cuenta: ni correo, ni alias, ni tokens, ni cookies.

## [1.14.0]

- **Si el sitio no responde, se ve una pantalla del launcher y no el error crudo de Chromium.** Cuando una ventana de servicio no puede cargar â€”se cayÃ³ internet, el servicio no contestaâ€”, aparece una pantalla propia, con la campana, el mismo fondo y el acento de siempre, que cuenta quÃ© pasÃ³ y ofrece **Reintentar**.
- **La barra lo avisa.** Mientras estÃ¡ esa pantalla, la barra acompaÃ±a el nombre del servicio con un distintivo "Sin conexiÃ³n", asÃ­ se entiende de un vistazo por quÃ© no hay pÃ¡gina.
- **Reintentar de verdad.** El botÃ³n de la pantalla, el de recargar de la barra y F5 o Ctrl+R vuelven a la direcciÃ³n que fallÃ³, no a la pantalla local; "abrir en el navegador" tambiÃ©n abre esa direcciÃ³n.
- El texto distingue los dos casos: cuando el problema parece de tu equipo ("Parece que no hay internet") y cuando parece del otro lado ("No pudimos conectar con Bling"). La pantalla no le pide nada al proceso principal: no lleva preload, y "Reintentar" es un enlace comÃºn.
- La lÃ³gica de red quedÃ³ en un mÃ³dulo propio, con pruebas.

## [1.13.0]

- **La ventana de inicio de sesiÃ³n de Google no puede pedir ningÃºn permiso.** Es una pÃ¡gina ajena: no tiene por quÃ© usar la cÃ¡mara, el micrÃ³fono, las notificaciones ni la pantalla completa del launcher, y ahora no puede. Los servicios siguen con los suyos (avisos, cÃ¡mara y micrÃ³fono de los lives, pantalla completa y copiar enlaces), sin cambios.
- La lista de hosts de inicio de sesiÃ³n quedÃ³ en un mÃ³dulo propio, con pruebas: sÃ³lo https y comparando el dominio exacto, asÃ­ un subdominio parecido (`accounts.google.com.algo-malo.com`) no pasa.

## [1.12.0]

- **Iniciar sesiÃ³n con Google, adentro del launcher.** El diÃ¡logo de login ahora tiene "Continuar con Google": abre la pÃ¡gina de login del sitio en una ventana del launcher (con su barra y la misma sesiÃ³n) y, cuando entrÃ¡s, el hub se entera al instante y aparece tu cuenta sin esperar. El popup de Google se abre como ventana hija del launcher: el token vuelve a la pÃ¡gina como en el navegador.
- **El launcher ya no se presenta como Electron.** El user agent pierde la huella `Electron/x.y.z` (queda el Chromium y el nombre del launcher), que es lo que hacÃ­a que Google rechazara su ventana de inicio de sesiÃ³n.
- **El puente de auth reintenta el reto de Cloudflare.** Si el primer intento queda a medias, recarga y prueba una vez mÃ¡s; si igual no pasa, vuelve a intentarlo mÃ¡s tarde en vez de quedarse sin sesiÃ³n hasta reiniciar el launcher.

## [1.11.0]

- **Atajos de navegaciÃ³n en las ventanas de servicio**, como en cualquier navegador: F5 o Ctrl R recargan, Alt + â† y Alt + â†’ van atrÃ¡s y adelante, y Ctrl W cierra la ventana.
- **El diagnÃ³stico dice si habÃ­a sesiÃ³n** (con cuenta o sin cuenta), sin un solo dato de la cuenta.

## [1.10.0]

- **Crear cuenta y recuperar la contraseÃ±a, sin salir del launcher.** Los dos atajos del login abren las pÃ¡ginas del auth en una ventana del launcher â€”con su barra y la misma sesiÃ³nâ€” en vez del navegador del sistema. Lo mismo para "Verificar mi cuenta" cuando el correo todavÃ­a no estÃ¡ confirmado.
- **La barra de los servicios muestra el nombre del servicio** (lo que abriste) y deja el tÃ­tulo de la pÃ¡gina como detalle al pasar el mouse, en vez de mostrar el tÃ­tulo crudo del sitio.

## [1.9.0]

- **Las ventanas de servicio ahora son del launcher.** Cada servicio abre con una barra propia: atrÃ¡s, adelante, recargar (con aviso de carga), el tÃ­tulo de la pÃ¡gina, abrir en el navegador y los controles de ventana (minimizar, maximizar, cerrar). Se acabÃ³ la ventana pelada con el marco de Windows.
- **Zoom en los servicios.** Ctrl +, Ctrl âˆ’ y Ctrl 0 tambiÃ©n funcionan ahÃ­, sobre la pÃ¡gina; la barra mantiene su tamaÃ±o.
- **Ventanas de servicio en el diagnÃ³stico**, para saber con quÃ© contexto se reportÃ³ un problema.

## [1.8.0]

- **Avisos de escritorio.** Cuando llegan notificaciones nuevas, Windows muestra un aviso nativo; al tocarlo se abre la bandeja de notificaciones en el launcher. El texto es genÃ©rico ("TenÃ©s 3 notificaciones nuevas") a propÃ³sito: en la pantalla de bloqueo se lee sin pedir permiso, asÃ­ que el contenido no viaja.
- **Icono marcado.** Mientras haya algo sin leer, el icono del launcher en la barra de tareas queda marcado y el tooltip de la bandeja cuenta cuÃ¡ntas hay.
- **Avisos de escritorio en Ajustes**, en su propia secciÃ³n, para apagarlos.

## [1.7.0]

- **Zoom de la interfaz.** Ctrl + agranda, Ctrl âˆ’ achica y Ctrl 0 vuelve al 100 %, desde el hub y desde las ventanas de servicio. El nivel se recuerda entre sesiones y tambiÃ©n se cambia desde Ajustes, donde se ve el porcentaje.
- **Content Security Policy.** El renderer declara una polÃ­tica cerrada â€”nada de red, sÃ³lo lo que sirve el propio bundleâ€” asÃ­ que Electron dejÃ³ de avisar en cada arranque y un hipotÃ©tico script inyectado ya no podrÃ­a pedir ni cargar nada de afuera.
- **Identidad de app.** El launcher se identifica con el mismo appId del instalador: agrupado correcto en la barra de tareas y base para las notificaciones nativas.
- **Jump list.** El clic derecho en el icono de la barra de tareas lista los servicios del catÃ¡logo y abre el launcher directo en el elegido (`--abrir=<servicio>`), incluso si ya estaba abierto.

## [1.6.0]

- **"Acerca de" con reporte de problema.** En Ajustes hay una secciÃ³n nueva con la versiÃ³n instalada y un acceso a las novedades. Desde ahÃ­, "Reportar" arma el diagnÃ³stico (versiÃ³n de la app, Electron, Chromium, Node, Windows, tamaÃ±o de la ventana, ajustes y las Ãºltimas lÃ­neas del registro), deja escribir quÃ© pasÃ³ y lo copia o lo guarda como .txt. No lleva correo, ni alias, ni tokens, ni cookies.
- **Registro en disco.** Lo que el launcher avisa queda en `%APPDATA%\Bling Launcher\logs\launcher.log` (se recicla solo a los ~512 KB): avisos y errores propios, caÃ­das del proceso de render, cargas fallidas, errores del renderer y si el puente de login no pasÃ³ el reto de Cloudflare. Antes, en la app instalada, esos avisos se perdÃ­an.
- El panel de ajustes scrollea si la ventana es baja.

## [1.5.0]

- **MenÃº de clic derecho.** Electron no trae ninguno, asÃ­ que hasta ahora no se podÃ­a pegar la contraseÃ±a en el login, copiar el alias de BlingPay ni copiar texto dentro de los servicios. Ahora el clic derecho ofrece lo que corresponde en cada caso:
  - en un campo de texto: deshacer, rehacer, cortar, copiar, pegar y seleccionar todo (cada uno se deshabilita cuando no aplica);
  - sobre texto seleccionado: copiar y seleccionar todo;
  - sobre una imagen: copiar imagen y guardar imagenâ€¦;
  - sobre un enlace: abrirlo en la misma ventana si es del sitio, y siempre copiar el enlace.
- Donde no hay nada que ofrecer no aparece nada, como en cualquier app.
- El mismo menÃº estÃ¡ en el hub y en las ventanas de los servicios.

## [1.4.0]

- **La derecha, a la altura de la izquierda.** El contenido ahora te saluda por tu nombre ("Buenas, Facundo.") cuando hay sesiÃ³n, el buscador baja de la barra superior al cuerpo y pasa a ser el protagonista de la pantalla, y la ayuda de teclado se convierte en una lÃ­nea discreta (antes eran tres cajitas que competÃ­an con el tÃ­tulo).
- **Tarjeta destacada en formato hero.** MÃ¡s alta, con la llamada **Abrir** a la vista y el icono del servicio como marca de agua que llena el aire de la derecha. TambiÃ©n deja de mostrar el borde claro cuando estÃ¡ seleccionada: se marca con la misma barrita del acento que las filas.
- **Panel de cuenta.** En ventanas anchas aparece una columna a la derecha con tu avatar, tu alias de BlingPay (copiable con un clic) y accesos directos a Mi perfil, Ajustes de cuenta y Notificaciones, mÃ¡s el estado del launcher (servicios disponibles y versiÃ³n, con el chequeo de actualizaciones). En ventanas angostas se oculta solo: todo sigue estando en el menÃº de usuario y en el pie.
- La barra superior queda para lo esencial: **Bling Launcher** + versiÃ³n a la izquierda; ajustes, bling.uy y tu usuario a la derecha.
- Interno: las URLs de las pÃ¡ginas de cuenta viven en un solo lugar (`src/lib/cuenta.ts`) y las usan tanto el menÃº de usuario como el panel.

## [1.3.1]

- **TipografÃ­a de la casa**: todo el texto pasa a **Montserrat** (la del ecosistema, en lugar de Barlow) y los micro-rÃ³tulos a **JetBrains Mono** (en lugar de la mono del sistema).
- **Bordes parejos**: la tarjeta destacada arrancaba seleccionada y mostraba un borde claro que desentonaba con las filas. Ahora todas comparten el mismo borde sutil y la selecciÃ³n se marca con la barrita del acento, igual que en el resto.

## [1.3.0]

### SesiÃ³n de Bling

- **Iniciar sesiÃ³n sin salir del launcher**: el correo y la contraseÃ±a se escriben acÃ¡ mismo. Los mensajes son los mismos que en la web (credenciales incorrectas, cuenta sin verificar, mantenimiento).
- **BotÃ³n de usuario**: con sesiÃ³n activa, la barra superior muestra tu avatar (o tus iniciales) y tu nombre, la campanita con las notificaciones sin leer y un menÃº con **Mi perfil**, **Ajustes de cuenta**, **Notificaciones**, tu alias de **BlingPay** (se copia con un clic) y **Cerrar sesiÃ³n**.
- **Una sesiÃ³n para todo el ecosistema**: al entrar, cada servicio que abras (Bling Noticias, Social, Fundadores) ya viene logueado. Cerrar sesiÃ³n tambiÃ©n la cierra en el backend.

Por dentro: las credenciales las maneja el proceso principal â€”el renderer nunca las ve y la cookie de acceso es httpOnlyâ€” y las pÃ¡ginas de cuenta se abren en ventanas embebidas, con la misma sesiÃ³n.

## [1.2.3]

- **Rail izquierdo renovado**: la campana de Bling reemplaza al rombo, con un pulso de ondas que salen en loop desde su centro (con halo amarillo de fondo). Respeta la preferencia de movimiento reducido del sistema.

## [1.2.2]

- **Icono nuevo**: la campana de Bling reemplaza al rombo â€” aparece en el icono de la app (escritorio, taskbar, instalador) y en la bandeja del sistema.

## [1.2.1]

- **Logo del wordmark**: la campana ahora usa el PNG oficial (con ondas), integrada en el slot de la Â«nÂ» del logo Â«BlingÂ».
- `app-update.yml` generado tambiÃ©n en builds `--dir` para probar actualizaciÃ³n local sin instalar.

## [1.2.0]

### Actualizaciones automÃ¡ticas

- **Se actualiza solo**: cuando sale una versiÃ³n nueva, el launcher la detecta, la descarga en segundo plano y te avisa. Basta con tocar "Instalar ahora"; si lo dejÃ¡s estar, se instala al salir.
- **Descarga mÃ¡s liviana**: usa descarga diferencial, asÃ­ que sÃ³lo baja lo que cambiÃ³ desde tu versiÃ³n.
- **Barra de progreso**: el aviso ahora muestra cuÃ¡nto falta de la descarga.

### Ajustes

Nuevo panel de ajustes (el Ã­cono de engranaje, arriba a la derecha):

- **Abrir al iniciar Windows**: el launcher arranca solo cuando entrÃ¡s a la sesiÃ³n.
- **Minimizar a la bandeja al cerrar**: cerrar la ventana la esconde en vez de salir; para salir de verdad usÃ¡s "Salir" en la bandeja. La bandeja tiene un submenÃº con todos los servicios.
- **Descargar automÃ¡ticamente**: bajÃ¡ las versiones nuevas sin preguntar.
- **Borrar servicios recientes**: limpia la lista de lo que abriste por Ãºltima vez. Se guardan sÃ³lo en tu equipo.

### Logo

- La campana de Bling se actualizÃ³ en todo el ecosistema, incluido el launcher.

## [1.1.0]

### Nuevos

- **NavegaciÃ³n con teclado**: `/` enfoca el buscador, `â†‘ â†“` recorren los servicios y `Enter` abre el seleccionado.
- **Recientes**: los Ãºltimos servicios que abriste quedan arriba del todo.
- **Abrir en navegador**: cada servicio tiene una acciÃ³n secundaria para abrirlo en el navegador del sistema.
- **La ventana se acuerda de vos**: recuerda tamaÃ±o, posiciÃ³n y si la tenÃ­as maximizada.
- **Logo nuevo**: la campana de Bling se actualizÃ³ en todo el ecosistema.

### Arreglos

- **Segunda instancia**: si el launcher ya estaba abierto, abrirlo de nuevo recrea la ventana correctamente.
- **Sesiones compartidas**: se corrigiÃ³ el texto. EntrÃ¡s una vez y te conoce todo el ecosistema.
- **BÃºsqueda sin acentos**: "segui" encuentra Social, "postula" encuentra Fundadores.
- **Permisos mÃ¡s seguros**: la app pide sÃ³lo notificaciones, multimedia, pantalla completa y portapapeles. Todo lo demÃ¡s se rechaza.
- **Menos movimiento**: respeta la configuraciÃ³n de "reducir movimiento" de tu sistema.

## [1.0.0]

- Primera versiÃ³n: todos los servicios de Bling en una sola app de escritorio, con sesiÃ³n compartida y ventanas embebidas por servicio.
