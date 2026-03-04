/**
 * POST /api/upload-foto  { imageData: "data:image/jpeg;base64,..." }
 * Sube la imagen a Cloudinary desde el servidor (evita CORS y problemas de preset).
 * Retorna { url: "https://res.cloudinary.com/..." }
 */
const { verifyToken } = require('./_lib/auth');

const CLOUD_NAME    = 'debpk4syz';
const UPLOAD_PRESET = 'al-paso-fotos';
const FOLDER        = 'al-paso-perfiles';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { imageData } = req.body || {};
  if (!imageData) {
    return res.status(400).json({ error: 'imageData requerido' });
  }

  try {
    const params = new URLSearchParams();
    params.append('file', imageData);
    params.append('upload_preset', UPLOAD_PRESET);
    params.append('folder', FOLDER);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: params }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err.error && err.error.message) || `Error Cloudinary ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json({ url: data.secure_url });
  } catch (error) {
    console.error('Error en upload-foto:', error);
    return res.status(500).json({ error: error.message || 'Error al subir foto' });
  }
};
