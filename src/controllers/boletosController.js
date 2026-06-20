
import * as db from '../config/db.js';
import crypto from 'crypto';

export const registrarVentaBoleto = async (req, res) => {
  let { rifa_id, numero, nombre_cliente, celular, direccion_referencia, estado_pago, valor_abono, vendedor_id } = req.body;

  const verificar = await db.query(
    'SELECT id FROM boletos WHERE rifa_id = $1 AND numero = $2 AND encargado_id = $3',
    [rifa_id, numero, vendedor_id]
  );

  if (verificar.rows.length === 0) {
    return res.status(403).json({ error: '¡Acceso denegado! Este número no está asignado a tu ruta.' });
  }

  // 1. Limpieza de datos: Forzamos el celular a String para evitar errores de tipo INTEGER
  const celularLimpio = (celular !== null && celular !== undefined && celular !== '') 
    ? String(celular).trim() 
    : null;

  // Validaciones estrictas de negocio
  if (!rifa_id || !numero || !nombre_cliente || !estado_pago) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para procesar la venta del boleto.' });
  }

  const estadosValidos = ['debe', 'abono', 'pagado'];
  if (!estadosValidos.includes(estado_pago)) {
    return res.status(400).json({ error: 'El estado de pago no es válido (debe ser debe, abono o pagado).' });
  }

  try {
    await db.query('BEGIN');

    // 1. CONTROL DE CLIENTES: Buscar si el comprador ya existe por celular
    let clienteId;
    const buscarClienteQuery = 'SELECT id FROM clientes WHERE celular = $1';
    const buscarClienteRes = await db.query(buscarClienteQuery, [celularLimpio]);

    if (buscarClienteRes.rows.length > 0) {
      clienteId = buscarClienteRes.rows[0].id;
      if (direccion_referencia) {
        await db.query('UPDATE clientes SET direccion_referencia = $1 WHERE id = $2', [direccion_referencia.trim(), clienteId]);
      }
    } else {
      const insertarClienteQuery = `
        INSERT INTO clientes (nombre, celular, direccion_referencia) 
        VALUES ($1, $2, $3) RETURNING id
      `;
      const insertarClienteRes = await db.query(insertarClienteQuery, [
        nombre_cliente.trim(), 
        celularLimpio, 
        direccion_referencia ? direccion_referencia.trim() : null
      ]);
      clienteId = insertarClienteRes.rows[0].id;
    }

    // 2. CONTROL DE CAJA Y CARTERA
    let abonoFinal = 0.00;
    if (estado_pago === 'abono') {
      abonoFinal = parseFloat(valor_abono);
      if (isNaN(abonoFinal) || abonoFinal <= 0) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Para el estado "abono", debe especificar un monto numérico mayor a 0.' });
      }
    }

    // 3. ACTUALIZAR EL BOLETO
    const actualizarBoletoQuery = `
      UPDATE boletos 
      SET 
        cliente_id = $1,
        estado_pago = $2,
        valor_abonado = $3,
        fecha_venta = NOW()
      WHERE rifa_id = $4 AND numero = $5
      RETURNING *
    `;
    const boletoRes = await db.query(actualizarBoletoQuery, [clienteId, estado_pago, abonoFinal, rifa_id, numero.toString()]);

    if (boletoRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'El número de boleto especificado no existe en esta rifa.' });
    }

    await db.query('COMMIT');

    const ticketCode = `TKT-${rifa_id}-${numero}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    res.status(200).json({
      mensaje: '¡Venta registrada de manera impecable!',
      boleto: boletoRes.rows[0],
      clienteId,
      ticket: {
        codigo: ticketCode,
        numero,
        rifa_id,
        nombre_cliente: nombre_cliente.trim(),
        celular: celularLimpio,
        estado_pago,
        valor_abono: abonoFinal,
        fecha_venta: new Date().toISOString()
      }
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error crítico al registrar la venta del boleto:', error);
    res.status(500).json({ error: 'Error interno en el servidor: ' + error.message });
  }
};


export const verificarTicket = async (req, res) => {
  const { codigo } = req.params;
  const partes = codigo.split('-');
  if (partes.length < 4 || partes[0] !== 'TKT') {
    return res.status(400).json({ error: 'Código de ticket inválido.' });
  }
  const rifa_id = partes[1];
  const numero = partes[2];

  try {
    const result = await db.query(`
      SELECT b.*, r.nombre_rifa, r.precio_boleto, r.loteria, r.fecha_sorteo,
        e.nombre as vendedor_nombre,
        c.nombre as cliente_nombre, c.celular as cliente_celular
      FROM boletos b
      JOIN rifas r ON b.rifa_id = r.id
      LEFT JOIN encargados e ON b.encargado_id = e.id
      LEFT JOIN clientes c ON b.cliente_id = c.id
      WHERE b.rifa_id = $1 AND b.numero = $2
    `, [rifa_id, numero]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    res.json({ valido: true, ticket: result.rows[0], codigo });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar ticket.' });
  }
};

// Nueva función: Obtener solo lo que le toca al vendedor
export const obtenerBoletosPorVendedor = async (req, res) => {
  const { rifa_id, vendedor_id } = req.params;
  
  try {
    // CORRECCIÓN: Cambiamos 'vendedor_id' por 'encargado_id' 
    // para que coincida con tu tabla SQL
    const query = `
      SELECT * FROM boletos 
      WHERE rifa_id = $1 AND encargado_id = $2
      ORDER BY numero ASC
    `;
    const result = await db.query(query, [rifa_id, vendedor_id]);
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener boletos del vendedor:', error);
    res.status(500).json({ error: 'Error al cargar tu matriz de ventas.' });
  }
};