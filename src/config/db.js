import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Creamos un pool de conexiones usando la URL del .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Hacemos una consulta de prueba inmediata para verificar la base de datos
pool.query('SELECT NOW()')
  .then(() => console.log('🚀 ¡Conexión exitosa a PostgreSQL Local!'))
  .catch((err) => console.error('❌ Error al conectar a PostgreSQL:', err));

// Exportamos la función query para usarla en los controladores
export const query = (text, params) => pool.query(text, params);