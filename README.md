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
