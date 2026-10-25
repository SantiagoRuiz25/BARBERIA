const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'erickbarber444@gmail.com',
    pass: 'TU_CONTRASENA_DE_APP',
  },
});

app.post('/api/send-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Faltan email o code' });
  }

  const mailOptions = {
    from: '"Estudio 4-4-4 Barber" <erickbarber444@gmail.com>',
    to: email,
    subject: `Tu código de verificación — Estudio 4-4-4 Barber`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #0b0b0b; color: #fff; padding: 40px; text-align: center;">
        <div style="max-width: 400px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 40px 30px; border: 1px solid #333;">
          <div style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #FFB800; display: inline-grid; place-items: center; margin-bottom: 20px;">
            <span style="color: #FFB800; font-weight: bold; font-size: 14px;">4-4-4</span>
          </div>
          <h1 style="font-size: 22px; margin-bottom: 10px; color: #fff;">Tu código de verificación</h1>
          <p style="color: #999; font-size: 14px; margin-bottom: 30px;">Estudio 4-4-4 Barber</p>
          <div style="background: #0b0b0b; border: 2px solid #FFB800; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <span style="font-size: 36px; font-weight: bold; color: #FFB800; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #666; font-size: 12px;">No compartas este código con nadie.</p>
          <p style="color: #666; font-size: 12px;">Si no solicitaste este código, ignora este mensaje.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Correo enviado' });
  } catch (error) {
    console.error('Error enviando correo:', error);
    res.status(500).json({ error: 'Error al enviar correo' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de correo corriendo en http://localhost:${PORT}`);
});
