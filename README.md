# ShipNow API — Backend III

API de logística basada en la estructura y entidades de la clase 1. Conserva usuarios, pedidos y entregas, e incorpora productos exigidos por la preentrega 1.

## Ejecución

Requiere Node.js 20+ y MongoDB local. Ejecutá `npm install`, copiá `.env.example` a `.env` y ajustá la URI. Luego `npm start` o `npm run dev`. La configuración exige PORT, MONGODB_URI y NODE_ENV; si falta alguna, falla antes de iniciar el servidor. Los ejemplos locales no contienen credenciales.

## Arquitectura

`routes → controllers → services → repositories → models`. Los controllers reciben HTTP y delegan errores. Services validan roles, calculan importes y controlan transiciones. Repositories encapsulan Mongoose, filtros, proyecciones sin contraseñas y validación de actualizaciones. La conexión a MongoDB está en el módulo de infraestructura `repositories/database.js`.

El stock determina el estado del producto en Service porque es una regla del dominio; Repository solo aplica la consulta y guarda. El total de pedidos se calcula en Service a partir de items, sin aceptar totales proporcionados por el cliente. Tarifa de desarrollo/testing: 10; producción: 50 + 1% del valor declarado, siguiendo el ejemplo de clase.

## Endpoints

GET/POST `/api/users`, `/api/products`, `/api/orders`, `/api/deliveries`.
GET/PUT/DELETE sobre los mismos recursos con `/:id`. GET `/api/health`.
Listados: `?page=1&limit=20` (máximo 100). Productos: `?available=true`; pedidos: `?status=created`.
Las respuestas de negocio usan `{status:"success",payload:...}`. Los IDs son ObjectId de 24 caracteres hexadecimales.

Usuario: `{ "firstName":"Ana", "lastName":"Pérez", "email":"ana@example.test", "password":"ejemplo123", "role":"customer" }`.
Producto: `{ "name":"Caja", "price":100, "stock":10 }`.
Pedido: `{ "customer":"ID_USUARIO", "deliveryAddress":"Av. Italia 1234", "items":[{"name":"Caja","quantity":2,"price":100}] }`.
Entrega: `{ "order":"ID_PEDIDO", "driver":"ID_REPARTIDOR" }` (driver opcional).

Roles centralizados: admin, user, customer, driver y store. USER se conserva por requisito del módulo 1; CUSTOMER corresponde al dominio de las clases. Admin no puede asignarse mediante la API. Las contraseñas se guardan con scrypt y no se devuelven. Esta API académica no incluye autenticación: no debe exponerse públicamente como servicio sin incorporar autorización.

Transiciones de pedido: created → assigned → picked_up → in_transit → delivered; puede cancelarse desde created o assigned. Entrega: pending → assigned → in_transit → delivered. Una entrega actualiza el estado del pedido asociado. Los estados terminales no se reabren.


## Mocking

GET `/api/mocks/users?qty=2` y `/api/mocks/drivers?qty=2` devuelven arrays sin guardar. GET `/api/mocks/orders?qty=2`, `/api/mocks/deliveries?qty=2` y `/api/mocks/all?qty=2` devuelven un conjunto con usuarios y relaciones consistentes; los IDs de referencias están presentes en ese conjunto. No se consulta MongoDB para generar estos datos.

POST `/api/mocks/seed?qty=10`, con body JSON `{ "resource":"users" }`, guarda 10 usuarios y devuelve `insertados`, `coleccion` y los conteos por entidad. `resource` puede ser users, drivers, orders, deliveries o all; por defecto users. Orders genera también clientes; deliveries/all genera clientes, repartidores, pedidos y entregas vinculados. `qty` va de 1 a 100; se rechazan negativos, fracciones y cantidades excesivas. Las contraseñas de carga se generan y se guardan con hash; los previews no contienen contraseñas.

La carga usa MongoDB real y compensación de los registros propios ante fallos de inserción. No es una transacción entre colecciones: ante una caída de MongoDB durante la compensación, se debe revisar la carga. Usá una base descartable para seeds.

## Errores centralizados

Services lanzan `AppError`; controllers llaman `next(error)` y el middleware global es el único que construye errores HTTP. `src/errors/catalog.js` contiene códigos, mensajes y status. Formato: `{ "status":"error", "error":{ "code":"ORDER_NOT_FOUND", "message":"Pedido no encontrado" } }`.

Probá `GET /api/orders/000000000000000000000000` (404), `GET /api/mocks/users?qty=-1` (400, INVALID_MOCK_QUANTITY), un ID mal formado (400, INVALID_ID), un estado desconocido (400, INVALID_STATE), JSON incorrecto (400, INVALID_JSON) y una ruta inexistente (404, ROUTE_NOT_FOUND). Duplicados devuelven 409; fallos de seed, 503. Los errores inesperados responden 500 sin exponer stacks ni detalles internos.

## Logging

Winston se configura una sola vez en `src/config/logger.js`. Niveles, de mayor a menor severidad: fatal, error, warning, info, http, debug. GET `/api/logger/test` emite los seis niveles; sus mensajes error/fatal son pruebas intencionales, no fallos del servidor.

`logs/error.log` recibe únicamente error y fatal; `logs/combined.log` registra los eventos desde LOG_LEVEL. Rotación por tamaño: 1 MiB para errores, 5 MiB para combined, máximo 5 archivos por transporte. Desarrollo usa consola y debug por defecto; test/producción solo archivos e info por defecto. LOG_DIR permite cambiar el destino. Los eventos contienen timestamp, nivel, mensaje y metadatos; no se registran bodies, contraseñas ni URIs. Los logs están ignorados en Git.

Para comprobarlo, ejecutá el endpoint y revisá ambos archivos. Los errores esperados se registran como warning y los inesperados como error; la conexión inicial fallida usa fatal. La configuración inválida se rechaza antes de crear la aplicación y el logger.

## Swagger / OpenAPI

Documentación interactiva en `http://localhost:8080/api/docs/` (ajustá el puerto según PORT). Especificación JSON: `/api/docs/openapi.json`. Incluye Users, Products, Orders, Deliveries, Mocks, Logger y Health, con schemas reutilizables, parámetros, bodies, respuestas y errores. Swagger está separado de las rutas en `src/config/swagger.js` y `src/docs/openapi.json`.

Para probar el flujo, creá un cliente y un repartidor con `/api/users`, un pedido con el ID del cliente y una entrega con los IDs del pedido y repartidor. Los IDs de los previews de mocks no están guardados: usá seed o POST de negocio antes de referenciarlos en la API real. No se documenta autenticación porque no está implementada.

## Testing funcional

Herramientas: Mocha, Chai y Supertest. Ejecutá `cp .env.test.example .env.test` y `npm test`. La suite inicia un proceso MongoDB real, temporal e independiente con `mongodb-memory-server-core`; guarda datos en disco temporal y elimina la base/proceso al terminar. No usa una base de desarrollo ni una simulación de persistencia. La primera ejecución necesita descargar MongoDB 7.0.24; alternativamente configurá MONGODB_BINARY con la ruta de un mongod local compatible.

Variables propias: PORT=8081, NODE_ENV=test, MONGODB_URI de ejemplo para validar configuración, LOG_LEVEL y LOG_DIR; el runner conecta exclusivamente con la URI del MongoDB temporal. El script fija NODE_ENV=test. No se leen datos cargados manualmente. Hooks limpian colecciones antes de cada test y eliminan la base al finalizar, con comprobación de nombre aleatorio propio de la suite. Los tests se agrupan en `tests/` por recurso.

Cubre usuarios, productos, pedidos, entregas, transiciones, mocks (preview/seed), fallos de persistencia simulados, logger, Swagger, health check, configuración y errores de HTTP. Se verifican status, body, códigos, mensajes y efectos persistidos. La prueba de fallo del repositorio usa un sustituto explícito; las pruebas HTTP de seed y negocio utilizan MongoDB real. Para comprobar repetibilidad: `npm test && npm test`.

## Documentos y comprobantes

Multer se configura en `src/config/multer.js`: un archivo en el campo **file**, PDF/PNG/JPEG, extensión coherente con MIME y firma inicial del contenido. Máximo **2 MiB** por defecto, configurable con UPLOAD_MAX_BYTES (hasta 10 MiB). No se trata de un antivirus ni de validación completa del documento. El directorio UPLOAD_DIR contiene subcarpetas para documentos, licencias y comprobantes; los nombres se generan con UUID.

- POST `/api/users/:id/documents`: multipart/form-data con file y documentType=user_document o driver_license. La licencia exige rol driver.
- POST `/api/orders/:id/proofs` y `/api/deliveries/:id/proofs`: multipart/form-data con file. Tipo fijo delivery_proof.
- GET sobre esas mismas rutas: lista metadatos.
- GET sobre esas rutas con `/:documentId/file`: recupera los bytes del archivo asociado.

Ejemplo: `curl -F 'documentType=user_document' -F 'file=@documento.pdf' http://localhost:8080/api/users/ID_USUARIO/documents`.

MongoDB guarda nombre original, nombre generado, ruta relativa, MIME, tamaño, tipo de documento y fecha. La API verifica que la entidad exista y elimina el archivo si fallan las validaciones o el guardado. No se expone toda la carpeta mediante archivos estáticos. Uploads y logs están ignorados por Git; no se entregan archivos de prueba. Son almacenamiento local de desarrollo: en producción requieren una política de respaldo/retención y autorización.

Los tests incluyen cargas válidas, recuperación y asociación persistida, archivo faltante, MIME/extensión no permitidos, contenido incompatible, tamaño excedido, campo incorrecto, tipo de documento inválido y entidad inexistente. Los uploads de la suite se crean en `.cache/test-uploads` y se eliminan mediante hooks. Swagger documenta estos endpoints como multipart/form-data.

Las entidades con documentos/comprobantes no se eliminan para evitar referencias huérfanas. Un pedido con entrega asociada cambia de estado desde esa entrega. La asignación de un driver a una entrega pendiente la pasa a assigned; no puede reasignarse una entrega completada.

## Verificación del repositorio

`npm run check` verifica la sintaxis; `npm run audit` revisa los archivos versionados y detecta material privado y patrones habituales de credenciales. No reemplaza una auditoría de seguridad completa. `npm test` ejecuta las pruebas funcionales con MongoDB temporal.

El proyecto conserva su evolución en las etiquetas preentrega-1 a preentrega-7. La rama main contiene la versión integrada y sus correcciones; los checkpoints anteriores muestran el alcance de cada módulo. La preentrega 8 y la entrega final no forman parte de esta versión.
