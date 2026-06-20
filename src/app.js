import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './config/db.js'; // Importamos la configuración de la base de datos para verificar la conexión al iniciar el servidor  
import rifaRoutes from './routes/rifaRoutes.js'; // 1. Importamos las rutas de las rifas

// Configuración de variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares obligatorios
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Permite que el servidor entienda JSON en el cuerpo de las peticiones

// 2. Vinculamos las rutas de la rifa al prefijo '/api/rifas'
app.use('/api/rifas', rifaRoutes);

// Manejo de rutas globales no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Arrancar el servidor
app.listen(PORT, () => {
  console.log(`💻 Servidor corriendo en local: http://localhost:${PORT}`);
});