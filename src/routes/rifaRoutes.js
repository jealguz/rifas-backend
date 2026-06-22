import express from 'express';
import { crearRifaDinamica, obtenerRifaPorId, obtenerUltimaRifa, obtenerHistorial, actualizarFechaRifa } from '../controllers/rifaController.js';
// Imaginando que meteremos las nuevas funciones en sus controladores correspondientes
import { registrarVentaBoleto, obtenerBoletosPorVendedor, verificarTicket, actualizarPagoBoleto } from '../controllers/boletosController.js';
import { finalizarRifa } from '../controllers/sorteoController.js';

const router = express.Router();

// 1. Ruta para crear una nueva rifa y repartir la matriz de boletos equitativamente
router.post('/crear', crearRifaDinamica);

// 2. Ruta para registrar la venta de un número a un cliente (Abone, deba o pague completo)
router.put('/vender', registrarVentaBoleto);

// 3. Ruta para ingresar el número ganador de la lotería y cerrar la rifa (Histórico)
router.post('/finalizar', finalizarRifa);

// 4. Ruta para actualizar el estado de pago de un boleto ya vendido (debe → pagado, abono → pagado, etc.)
router.put('/actualizar-pago', actualizarPagoBoleto);

// rifaRoutes.js
router.get('/boletos/:rifa_id/:vendedor_id', obtenerBoletosPorVendedor);

router.get('/ultima-activa', obtenerUltimaRifa);

router.get('/historial', obtenerHistorial);

router.get('/ticket/:codigo', verificarTicket);

router.put('/:id/cambiar-fecha', actualizarFechaRifa);

router.get('/:id', obtenerRifaPorId);

export default router;