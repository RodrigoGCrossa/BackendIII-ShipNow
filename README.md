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

## Referencia

Base docente: https://github.com/Rutito2010/Backend-III-101970/tree/main/Clase-1 . Se conservan los campos y métodos principales; se corrigen el enlace de controllers, cálculo de items y health check. Las respuestas se unifican para evitar contratos distintos entre módulos. No se implementa correo: la base solo contenía una simulación sin uso.

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
