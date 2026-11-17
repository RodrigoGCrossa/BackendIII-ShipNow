# ShipNow API

API de logística desarrollada para Backend III. Gestiona usuarios, productos, pedidos/envíos, entregas, seguimiento y documentos. Incluye mocks, errores centralizados, logging, Swagger, pruebas funcionales y ejecución con Docker Compose.

## Tecnologías

Node.js 24, Express 5, MongoDB 7 y Mongoose 8. Winston para logs, Multer para archivos y Swagger UI/OpenAPI 3 para documentación. Las pruebas usan Mocha, Chai y Supertest, con MongoDB temporal real.

## Instalación y ejecución local

Requiere Node.js 24 y MongoDB accesible desde tu equipo.

```bash
npm ci
cp .env.example .env
# Ajustar MONGODB_URI en .env si MongoDB no está en localhost:27017.
npm start
```

`npm run dev` activa el reinicio automático de Node. La API escucha por defecto en http://localhost:8080. La configuración se valida antes del arranque: si faltan PORT, NODE_ENV o MONGODB_URI, el servidor no inicia y muestra el nombre de la variable requerida.

Swagger: http://localhost:8080/api/docs/ . Especificación JSON: `/api/docs/openapi.json`.

## Configuración

Las variables se leen únicamente en `src/config/env.config.js`. `.env` y los archivos reales de otros entornos están ignorados por Git. Los ejemplos no contienen credenciales.

| Variable | Uso |
|---|---|
| PORT | Puerto HTTP, entero de 1 a 65535. Obligatorio. |
| NODE_ENV | development, test o production. Obligatorio. |
| MONGODB_URI | Conexión a MongoDB. Obligatoria. |
| LOG_LEVEL | debug por defecto en desarrollo; info en test/producción. |
| LOG_DIR | Destino de logs; por defecto logs. |
| LOG_MAX_BYTES | Tamaño de rotación de error.log; 1048576 por defecto. combined usa cinco veces ese valor. |
| LOG_MAX_FILES | Máximo de archivos por transporte; 5 por defecto. |
| UPLOAD_DIR | Destino de documentos; por defecto uploads. |
| UPLOAD_MAX_BYTES | Máximo por archivo; 2097152 por defecto, hasta 10 MiB. |
| JSON_LIMIT_BYTES | Máximo del body JSON; 102400 por defecto, hasta 1 MiB. |
| REQUEST_TIMEOUT_MS | Tiempo máximo de recepción HTTP; 30000 por defecto. |
| ENABLE_INTERNAL_ENDPOINTS | Habilita mocks y logger de prueba; false por defecto en producción. |
| ENABLE_SWAGGER | Habilita Swagger; true por defecto para revisión. |
| API_BASE_URL | URL pública que muestra Swagger; por defecto http://localhost:PORT. |
| ENV_FILE | Archivo de variables alternativo. Por defecto .env o .env.test según el entorno. |
| MONGODB_BINARY | Solo testing: ruta opcional a un mongod local compatible. |

Para revisar producción fuera de Docker, copiá `.env.production.example` a `.env.production` y ejecutá `ENV_FILE=.env.production npm start`. En producción se rechazan LOG_LEVEL=debug/http y se usa salida a archivos, sin consola. No se usa JWT ni se integran servicios externos que requieran secretos o URLs adicionales.

## Arquitectura

```text
src/
├── config/          # Entorno, Winston, Swagger y Multer
├── constants/       # Roles, estados, prioridades y tipos de documentos
├── routes/          # Métodos y paths
├── controllers/     # Entrada HTTP, respuestas y next(error)
├── services/        # Validaciones y reglas de negocio
├── repositories/    # Consultas, proyecciones y persistencia con Mongoose
├── models/          # Schemas e índices
├── errors/          # AppError y catálogo
├── middlewares/     # Tratamiento global de errores y logs HTTP
└── docs/            # Especificación OpenAPI
```

El flujo es Router → Controller → Service → Repository → Model. Los controllers no importan Mongoose. El Service calcula importes y decide transiciones; el Repository aplica consultas, proyecciones y validación de actualizaciones. Por ejemplo, el estado del producto se deriva del stock en Service porque es una regla de negocio; el Repository guarda el resultado y limita lo que consulta.

## Recursos y reglas principales

| Recurso | Rutas |
|---|---|
| Usuarios | GET/POST /api/users; GET/PUT/DELETE /api/users/:id |
| Productos | GET/POST /api/products; GET/PUT/DELETE /api/products/:id |
| Pedidos | GET/POST /api/orders; GET/PUT/DELETE /api/orders/:id |
| Envíos | GET/POST /api/shipments; GET/PUT/DELETE /api/shipments/:id |
| Entregas | GET/POST /api/deliveries; GET/PUT/DELETE /api/deliveries/:id |
| Tracking | GET /api/tracking/:trackingCode |
| Salud | GET /api/health y GET /api/ready |

Un envío es el pedido logístico existente: Shipments es un alias de Orders, con el mismo modelo y datos. No hay dos colecciones ni duplicación de registros. Las rutas anteriores se conservan.

Los listados usan `?page=1&limit=20`, con máximo 100 resultados y desplazamiento máximo 100000. Productos admite `?available=true` y pedidos/envíos `?status=created`. Los listados excluyen documentos/comprobantes y, en pedidos, historial; el detalle por ID conserva esa información. Las consultas frecuentes tienen índices.

Roles: admin, user, customer, driver y store. USER se conserva como rol permitido; CUSTOMER representa al cliente del dominio. La API impide asignar admin desde creación o actualización. Las contraseñas se guardan con scrypt y nunca se devuelven.

El total se calcula con los items, sin aceptar importes enviados como total por el cliente. Tarifa de desarrollo/testing: 10. Producción: 50 + 1% del valor declarado. El stock determina available u out_of_stock.

Pedido: created → assigned → picked_up → in_transit → delivered; puede cancelarse desde created o assigned. Entrega: pending → assigned → in_transit → delivered. Solo un driver puede asignarse como repartidor. Con una entrega asociada, el estado del pedido se actualiza desde esa entrega. Los estados terminales no se reabren.

Cada pedido nuevo recibe un trackingCode SN- seguido de 32 caracteres hexadecimales y un historial de estados con fechas. Tracking devuelve únicamente código, estado e historial, sin usuarios, direcciones, items ni archivos. Repetir el mismo estado no agrega eventos duplicados. Los registros anteriores a esta funcionalidad pueden no tener código: no se modifican datos existentes automáticamente.

### Ejemplo de flujo

1. Crear un cliente con POST `/api/users`:

```json
{"firstName":"Ana","lastName":"Pérez","email":"ana@example.test","password":"ejemplo123","role":"customer"}
```

2. Crear un repartidor con los mismos campos, otro email y role=driver.
3. Crear un envío con POST `/api/shipments`:

```json
{"customer":"ID_CLIENTE","deliveryAddress":"Av. Italia 1234","items":[{"name":"Caja","quantity":2,"price":100}]}
```

4. Crear la entrega con POST `/api/deliveries` y body `{"order":"ID_ENVIO","driver":"ID_REPARTIDOR"}`.
5. Actualizarla con PUT `/api/deliveries/:id`, primero `{"status":"in_transit"}` y después `{"status":"delivered"}`.
6. Adjuntar el comprobante y consultar `/api/tracking/CODIGO_DEVUELTO_AL_CREAR`.

Swagger documenta los parámetros, bodies, respuestas y errores de cada ruta. Las respuestas de negocio usan `{"status":"success","payload":...}`. Health/readiness y los mocks tienen sus formatos propios documentados.

## Mocks

GET `/api/mocks/users?qty=2` y `/api/mocks/drivers?qty=2` devuelven arrays sin persistir. GET `/api/mocks/orders`, `/api/mocks/deliveries` y `/api/mocks/all` devuelve un conjunto con usuarios, repartidores, pedidos y entregas relacionados. Las referencias apuntan a IDs incluidos en ese conjunto; no están guardados en MongoDB.

POST `/api/mocks/seed?qty=10` con JSON `{"resource":"users"}` persiste datos. resource admite users, drivers, orders, deliveries o all; por defecto users. qty admite enteros de 1 a 100. Orders carga también clientes; deliveries/all agrega repartidores y entregas. La respuesta informa insertados, coleccion y totales por entidad. Las contraseñas de seed se generan y hashean; los previews no contienen contraseñas.

La generación no consulta la base. Seed sí usa MongoDB real y compensa únicamente los registros de esa carga si falla. Usá una base descartable. Los IDs de un preview no sirven para operar en la API hasta persistirlos o crear entidades reales.

## Errores y logging

Services lanzan AppError, controllers derivan con next y el middleware global construye la respuesta uniforme:

```json
{"status":"error","error":{"code":"ORDER_NOT_FOUND","message":"Pedido no encontrado"}}
```

El catálogo está en `src/errors/catalog.js`. Incluye IDs/datos/estados inválidos (400), recursos inexistentes (404), conflictos (409), tamaño excedido (413), fallos de seed o readiness (503) y errores internos (500). Los errores inesperados no exponen stacks ni detalles internos. Ejemplos: `/api/mocks/users?qty=-1`, `/api/orders/000000000000000000000000` y una ruta inexistente.

Winston usa fatal, error, warning, info, http y debug. `logs/error.log` recibe solo error/fatal; `logs/combined.log` registra desde LOG_LEVEL. Hay rotación por tamaño y retención limitada por LOG_MAX_BYTES/LOG_MAX_FILES. Desarrollo incluye consola; producción solo archivos. No se registran bodies, contraseñas ni URIs.

GET `/api/logger/test` genera los seis niveles. Sus eventos error/fatal son intencionales para validar el logger. Los errores esperados usan warning, los inesperados error y un fallo inicial de conexión fatal.

## Documentos y comprobantes

Multer está separado de los routers. Acepta un único archivo en el campo **file**: PDF, PNG o JPEG, con extensión/MIME coherentes y firma inicial válida. Tamaño máximo por defecto: **2 MiB**. La firma no sustituye un antivirus ni una validación completa del documento.

| Operación | Ruta y campos |
|---|---|
| Documento de usuario | POST /api/users/:id/documents; file + documentType=user_document o driver_license |
| Comprobante de pedido/envío | POST /api/orders/:id/proofs o /api/shipments/:id/proofs; file |
| Comprobante de entrega | POST /api/deliveries/:id/proofs; file |
| Listar metadatos | GET sobre las mismas rutas |
| Recuperar archivo | GET sobre esas rutas con /:documentId/file |

Las licencias requieren un usuario driver. Los comprobantes usan delivery_proof. Ejemplo:

```bash
curl -F 'documentType=user_document' -F 'file=@documento.pdf' \
  http://localhost:8080/api/users/ID_USUARIO/documents
```

El archivo recibe un nombre UUID y se guarda en subcarpetas de uploads. MongoDB guarda solo nombre original, nombre generado, ruta relativa, MIME, tamaño, tipo y fecha. El servicio verifica la entidad y limpia el archivo ante errores de validación o persistencia. No se expone estáticamente toda la carpeta. Las entidades con archivos no se eliminan para evitar huérfanos.

Logs, uploads, cachés y archivos de pruebas están ignorados en Git. En Docker se usan volúmenes; para un despliegue real debe definirse respaldo, retención y almacenamiento compartido antes de escalar horizontalmente.

## Testing

```bash
cp .env.test.example .env.test
npm test
```

La suite usa Mocha, Chai y Supertest. Inicia un proceso **MongoDB real temporal**, con una base de nombre aleatorio propia de la suite. No conecta a la base de desarrollo: MONGODB_URI de testing sirve para validar configuración y el runner usa la URI del proceso temporal. La primera ejecución descarga MongoDB 7.0.24; MONGODB_BINARY permite usar un binario local compatible.

Los tests están agrupados por recurso en tests/. Hooks limpian las colecciones antes de cada test y eliminan base/proceso al finalizar. Los uploads de prueba usan exclusivamente `.cache/test-uploads`, con comprobaciones para evitar limpiar una carpeta ajena. No dependen de datos cargados manualmente ni del orden de ejecución.

Se cubren usuarios, productos, pedidos/envíos, entregas, transiciones, tracking, mocks/seed, health/readiness, Swagger, logger, rotación y archivos. Se verifican status, body, códigos, mensajes, relaciones y persistencia. Los fallos de dependencias se simulan de forma explícita y se restauran después del caso; los flujos de negocio/seed utilizan MongoDB real.

```bash
npm test && npm test   # Repetibilidad sin limpieza manual
npm run check         # Sintaxis de src, tests y scripts
npm run audit         # Archivos versionados y patrones comunes de secretos
```

La auditoría del repositorio no reemplaza una auditoría de seguridad completa.

## Docker y producción

El Dockerfile usa Node.js 24, dos etapas, `npm ci --omit=dev --ignore-scripts`, usuario node y un healthcheck que consulta `/api/ready`. La imagen solo recibe dependencias productivas, src y el script de healthcheck. `.dockerignore` excluye variables reales, node_modules, Git, logs, uploads, coverage, cachés, temporales y material privado.

### API y MongoDB con Compose

```bash
docker compose up --build -d --wait
# Alternativa clásica, si está disponible: docker-compose up --build
```

API: http://localhost:8080 . Swagger: http://localhost:8080/api/docs/ . Compose espera el healthcheck de MongoDB antes de iniciar la API y luego comprueba su readiness. MongoDB no publica un puerto al host. La API solo se publica en loopback para revisión local.

Compose fija production, LOG_LEVEL=info y endpoints internos desactivados. PORT cambia el puerto del host; el contenedor mantiene 8080. API_BASE_URL configura la URL de Swagger. Los volúmenes mongo-data, api-logs y api-uploads conservan base, logs y archivos al recrear contenedores.

```bash
docker compose ps
docker compose exec api sh -c 'tail -n 50 logs/combined.log'
docker compose down
```

`down` conserva los volúmenes. `docker compose down --volumes` elimina los datos: usalo únicamente con información descartable.

### Solo la imagen de la API

```bash
docker build -t shipnow:local .
cp .env.production.example .env.production
# Ajustar MONGODB_URI para que sea accesible desde Docker.
docker run --rm --env-file .env.production -p 127.0.0.1:8080:8080 \
  -v shipnow-uploads:/app/uploads -v shipnow-logs:/app/logs shipnow:local
```

Dentro de un contenedor localhost apunta al propio contenedor. Para MongoDB en tu Mac puede usarse host.docker.internal; con Compose se usa mongo:27017.

### Salud y endpoints internos

GET `/api/health` informa status, environment, uptime y timestamp. GET `/api/ready` comprueba MongoDB y devuelve 503 si no está disponible. Ninguno expone credenciales.

Mocks y logger de prueba están desactivados por defecto en producción; Swagger se mantiene para revisión y puede desactivarse con ENABLE_SWAGGER=false. JSON_LIMIT_BYTES, REQUEST_TIMEOUT_MS y los límites de archivos controlan recursos. La API cierra conexiones y MongoDB al recibir SIGINT/SIGTERM.

### Validación automática

El workflow ShipNow CI corre la suite dos veces y construye/inicia API + MongoDB en contenedores reales. `node scripts/smoke-container.js`, con Compose iniciado, comprueba salud, documentación, restricciones productivas, persistencia y el contenido/usuario de la imagen.

## Alcance

Proyecto académico ejecutable en un entorno controlado. No incorpora autenticación ni autorización completa; no debe exponerse como API pública de escritura sin agregarlas, junto con TLS y credenciales administradas. El Compose local no contiene credenciales de MongoDB y mantiene la base en su red interna.

Los cambios entre pedido y entrega y la compensación de seed no son transacciones entre colecciones: no garantizan atomicidad ante caída abrupta de MongoDB. Los cambios de estado comparan el estado anterior para detectar conflictos. Para garantías completas se requiere una estrategia transaccional y una topología MongoDB apropiada.

Las etiquetas preentrega-1 a preentrega-8 y proyecto-final conservan checkpoints del curso. La rama main contiene la versión integrada y las correcciones posteriores.
