import * as db from '../config/db.js';

export const crearRifaDinamica = async (req, res) => {
  // 🔴 RADIOGRAFÍA DE EMERGENGIA: Esto nos mostrará TODO lo que sale del formulario
  console.log("=========================================");
  console.log("🚨 BODY COMPLETO RECIBIDO DEL FRONTEND:");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("=========================================");

  const { 
    nombre_rifa, 
    cifras, 
    precio_boleto, 
    lista_encargados, 
    encargados, 
    vendedores, 
    loteria, 
    fecha_sorteo, 
    url_imagen,
    premio // Capturamos el premio por si acaso
  } = req.body;

  // Unificamos para ver qué variante de vendedores llegó
  const listaVendedoresReal = lista_encargados || encargados || vendedores || [];

  // Validación ultra-detallada para saber exactamente qué falló
  if (!nombre_rifa) console.log("⚠️ Falta: nombre_rifa");
  if (!cifras) console.log("⚠️ Falta: cifras");
  if (!precio_boleto) console.log("⚠️ Falta: precio_boleto");
  if (!loteria) console.log("⚠️ Falta: loteria");
  if (!fecha_sorteo) console.log("⚠️ Falta: fecha_sorteo");
  if (listaVendedoresReal.length === 0) console.log("⚠️ Falta: Vendedores (Array vacío o inexistente)");

  if (!nombre_rifa || !cifras || !precio_boleto || !loteria || !fecha_sorteo || listaVendedoresReal.length === 0) {
    return res.status(400).json({ 
      error: 'Faltan campos obligatorios en el backend para procesar la rifa.' 
    });
  }

  // Si pasa la validación, reasignamos para que el resto de tu código no cambie
  const lista_encargados_procesada = listaVendedoresReal;
  const coloresPlanosUI = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#14b8a6'];

  try {
    await db.query('BEGIN');

    // Modificamos tu query para meter también el PREMIO si lo necesitas en la tabla
    // (Nota: Si tu tabla 'rifas' no tiene la columna 'premio', déjalo como estaba con url_imagen)
    const nuevaRifaQuery = `
      INSERT INTO rifas (
        nombre_rifa, 
        cifras, 
        precio_boleto, 
        loteria, 
        fecha_sorteo,
        url_imagen
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `;

    const nuevaRifaRes = await db.query(nuevaRifaQuery, [
      nombre_rifa, 
      cifras, 
      precio_boleto, 
      loteria, 
      fecha_sorteo,
      url_imagen || '' 
    ]);
    const rifaId = nuevaRifaRes.rows[0].id;

    console.log(`👤 Iterando bucle para insertar: ${lista_encargados_procesada.length} vendedores.`);

    // Modificación del bucle para soportar si mandas objetos [{nombre: 'Juan'}] o strings ['Juan']
    const encargadosCreados = [];
    for (let index = 0; index < lista_encargados_procesada.length; index++) {
      const item = lista_encargados_procesada[index];
      
      // Si viene como objeto saca el nombre, si viene como string lo usa directo
      const nombreEncargado = typeof item === 'object' ? (item.nombre || item.vendedor) : item;
      
      if (!nombreEncargado) {
        console.log(`❌ El vendedor en el índice ${index} no tiene un nombre válido:`, item);
        continue; // Evita que se rompa el insert si viene un objeto raro
      }

      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const colorHex = coloresPlanosUI[index % coloresPlanosUI.length];

      const encargadoQuery = `
        INSERT INTO encargados (rifa_id, nombre, token_link, codigo_color_hex) 
        VALUES ($1, $2, $3, $4) RETURNING id, nombre, token_link, codigo_color_hex
      `;
      const encargadoRes = await db.query(encargadoQuery, [rifaId, nombreEncargado, token, colorHex]);
      
      encargadosCreados.push({
        id: encargadoRes.rows[0].id,
        nombre: encargadoRes.rows[0].nombre,
        color: encargadoRes.rows[0].codigo_color_hex,
        token_link: encargadoRes.rows[0].token_link,
        asignados: 0,
        vendidos: 0
      });
    }

    // A PARTIR DE AQUÍ EL RESTO DE TU CÓDIGO SIGUE EXACTAMENTE IGUAL (Puntos 4, 5, 6 y 7)...

    // 4. GENERAR NÚMEROS (Fisher-Yates)
    const totalNumeros = Math.pow(10, cifras);
    let todosLosNumeros = [];
    for (let i = 0; i < totalNumeros; i++) {
      todosLosNumeros.push(i.toString().padStart(cifras, '0'));
    }

    for (let i = todosLosNumeros.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [todosLosNumeros[i], todosLosNumeros[j]] = [todosLosNumeros[j], todosLosNumeros[i]];
    }

    // 5. DISTRIBUCIÓN EQUITATIVA
    const cantidadEncargados = encargadosCreados.length;
    const basePorEncargado = Math.floor(totalNumeros / cantidadEncargados);
    const cantidadSobrantes = totalNumeros % cantidadEncargados;

    let encargadosParaExtra = [...encargadosCreados].sort(() => Math.random() - 0.5);
    const idsConExtra = encargadosParaExtra.slice(0, cantidadSobrantes).map(e => e.id);

    // Guardaremos la relación exacta de qué número le quedó a quién para mandársela al Front
    const matrizBoletosFinal = [];

    // 6. Asignar los boletos
    for (const encargado of encargadosCreados) {
      const cuantosLeTocan = idsConExtra.includes(encargado.id) ? basePorEncargado + 1 : basePorEncargado;
      
      // Guardamos la estadística de asignados directamente en el objeto del encargado
      encargado.asignados = cuantosLeTocan;

      const boletosDelEncargado = todosLosNumeros.splice(0, cuantosLeTocan);

      for (const numeroBoleto of boletosDelEncargado) {
        const boletoQuery = `
          INSERT INTO boletos (rifa_id, encargado_id, numero) 
          VALUES ($1, $2, $3)
        `;
        await db.query(boletoQuery, [rifaId, encargado.id, numeroBoleto]);

        // Guardamos en la respuesta inmediata para pintar en el Frontend sin desfases de distribución al azar
        matrizBoletosFinal.push({
          numero: numeroBoleto,
          estado_pago: 'disponible',
          valor_abonado: 0.00,
          cliente: null,
          vendedor: {
            id: encargado.id,
            nombre: encargado.nombre,
            color: encargado.color
          }
        });
      }
    }

    await db.query('COMMIT');

    // 7. RESPUESTA MAPEADA EXACTAMENTE COMO LA BUSCA EL DASHBOARD
    res.status(201).json({
      mensaje: '¡Rifa creada con éxito!',
      id: rifaId,
      nombre_rifa,
      cifras,
      precio_boleto,
      loteria,
      fecha_sorteo,
      url_imagen,
      lista_encargados: encargadosCreados, // Array con IDs, nombres calculados y colores reales
      boletos_pregenerados: matrizBoletosFinal.sort((a, b) => parseInt(a.numero) - parseInt(b.numero)) // Ordenado de 00 a 99
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error crítico durante la transacción de la rifa:', error);
    res.status(500).json({ error: 'Ocurrió un error interno en el servidor.' });
  }
};

export const obtenerRifaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Traer datos básicos de la rifa
    const rifaRes = await db.query('SELECT * FROM rifas WHERE id = $1', [id]);
    if (rifaRes.rows.length === 0) return res.status(404).json({ error: "Rifa no encontrada" });

    // 2. Traer los encargados (vendedores)
    const encargadosRes = await db.query('SELECT * FROM encargados WHERE rifa_id = $1', [id]);

    // 3. Traer TODOS los boletos asociados con datos del cliente
    const boletosRes = await db.query(`
      SELECT b.*, e.nombre as vendedor_nombre, e.codigo_color_hex as vendedor_color,
        c.nombre as cliente_nombre, c.celular as cliente_celular
      FROM boletos b
      LEFT JOIN encargados e ON b.encargado_id = e.id
      LEFT JOIN clientes c ON b.cliente_id = c.id
      WHERE b.rifa_id = $1
    `, [id]);

    // 4. Armar el objeto tal como lo espera el Dashboard
    res.json({
      ...rifaRes.rows[0],
      lista_encargados: encargadosRes.rows.map(e => ({
        id: e.id,
        nombre: e.nombre,
        color: e.codigo_color_hex
      })),
      boletos_pregenerados: boletosRes.rows.map(b => ({
        numero: b.numero,
        estado_pago: b.estado_pago,
        vendedor: { id: b.encargado_id, nombre: b.vendedor_nombre, color: b.vendedor_color },
        cliente: b.cliente_nombre ? { nombre: b.cliente_nombre, celular: b.cliente_celular } : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Error al traer la rifa de la base de datos" });
  }
};

export const obtenerUltimaRifa = async (req, res) => {
    try {
        // Buscamos la rifa activa
        const rifaRes = await db.query("SELECT * FROM rifas WHERE estado = 'activa' ORDER BY id DESC LIMIT 1");
        
        if (rifaRes.rows.length === 0) {
            return res.status(404).json({ error: "No hay rifa activa" });
        }

        const rifa = rifaRes.rows[0];

        // AHORA: Traemos los vendedores (encargados) asociados a esa rifa
        const encargadosRes = await db.query("SELECT * FROM encargados WHERE rifa_id = $1", [rifa.id]);

        // Unimos ambos resultados
        const respuestaCompleta = {
            ...rifa,
            lista_encargados: encargadosRes.rows // Aquí enviamos los vendedores
        };

        res.json(respuestaCompleta);
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};

export const actualizarFechaRifa = async (req, res) => {
  const { id } = req.params;
  const { fecha_sorteo } = req.body;

  if (!id || !fecha_sorteo) {
    return res.status(400).json({ error: 'Faltan datos: id de la rifa y nueva fecha.' });
  }

  try {
    const result = await db.query(
      `UPDATE rifas SET fecha_sorteo = $1 WHERE id = $2 AND estado = 'activa' RETURNING id, nombre_rifa, fecha_sorteo`,
      [fecha_sorteo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rifa no encontrada o ya está finalizada.' });
    }

    res.json({ mensaje: 'Fecha actualizada con éxito', rifa: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar fecha:', error);
    res.status(500).json({ error: 'Error al actualizar la fecha' });
  }
};

export const obtenerHistorial = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.*,
        e.nombre as encargado_ganador_nombre,
        (SELECT COUNT(*) FROM boletos WHERE rifa_id = r.id AND estado_pago != 'disponible')::int as boletos_vendidos,
        (SELECT COUNT(*) FROM boletos WHERE rifa_id = r.id)::int as total_boletos
      FROM rifas r
      LEFT JOIN encargados e ON r.encargado_ganador_id = e.id
      WHERE r.estado = 'finalizada'
      ORDER BY r.fecha_finalizacion DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al cargar el historial' });
  }
};