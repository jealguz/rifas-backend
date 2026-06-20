import * as db from '../config/db.js';

export const finalizarRifa = async (req, res) => {
  const { rifa_id, numero_ganador } = req.body;

  // Validaciones iniciales
  if (!rifa_id || !numero_ganador) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (rifa_id o numero_ganador) para cerrar el sorteo.' });
  }

  try {
    await db.query('BEGIN');

    // 1. RASTREO DEL GANADOR: Buscamos qué vendedor tenía asignado el número y quién lo compró
    const rastrearGanadorQuery = `
      SELECT encargado_id, cliente_id, estado_pago 
      FROM boletos 
      WHERE rifa_id = $1 AND numero = $2
    `;
    const rastrearGanadorRes = await db.query(rastrearGanadorQuery, [rifa_id, numero_ganador.toString()]);

    let encargadoGanadorId = null;
    let clienteGanadorId = null;
    let informacionGanadorAdicional = "El número ganador no fue vendido (quedó en la bolsa de disponibles o excedentes).";

    if (rastrearGanadorRes.rows.length > 0) {
      const boletoGanador = rastrearGanadorRes.rows[0];
      encargadoGanadorId = boletoGanador.encargado_id;
      clienteGanadorId = boletoGanador.cliente_id; // Puede ser NULL si el vendedor lo tenía asignado pero no lo vendió

      if (clienteGanadorId) {
        informacionGanadorAdicional = `¡Tenemos un ganador real! El boleto fue vendido por el encargado ID ${encargadoGanadorId}.`;
      } else {
        informacionGanadorAdicional = `El número estaba asignado al vendedor ID ${encargadoGanadorId}, pero no se lo vendió a nadie.`;
      }
    }

    // 2. CIERRE HISTÓRICO: Actualizamos la tabla de rifas quemando los resultados del sorteo
    const cerrarRifaQuery = `
      UPDATE rifas 
      SET 
        estado = 'finalizada',
        numero_ganador = $1,
        encargado_ganador_id = $2,
        fecha_finalizacion = NOW()
      WHERE id = $3 AND estado = 'activa'
      RETURNING id, nombre_rifa, loteria, fecha_sorteo, estado, numero_ganador
    `;
    const cerrarRifaRes = await db.query(cerrarRifaQuery, [numero_ganador.toString(), encargadoGanadorId, rifa_id]);

    if (cerrarRifaRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'La rifa no existe o ya se encuentra finalizada.' });
    }

    // Confirmamos los cambios de cierre en la base de datos
    await db.query('COMMIT');

    res.status(200).json({
      mensaje: '¡Rifa finalizada y guardada en el histórico con éxito!',
      rifa: cerrarRifaRes.rows[0],
      detalles: {
        encargado_ganador_id: encargadoGanadorId,
        cliente_id: clienteGanadorId,
        nota: informacionGanadorAdicional
      }
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error crítico al finalizar la rifa:', error);
    res.status(500).json({ error: 'Error interno en el servidor al ejecutar el cierre del sorteo.' });
  }
};