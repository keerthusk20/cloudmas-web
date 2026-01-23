import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// MongoDB connection (cached)
let conn = null;
const connectDB = async () => {
  if (conn) return conn;
  conn = await mongoose.connect(process.env.MONGO_URL);
  return conn;
};

// Contact schema
const contactSchema = new mongoose.Schema(
  { name: String, company: String, email: String, source: String, message: String },
  { timestamps: true }
);
const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Netlify function
export async function handler(event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  await connectDB();

  const { name, company, email, source, message } = JSON.parse(event.body);

  try {
    await Contact.create({ name, company, email, source, message });

    // Email to Admin
    await transporter.sendMail({
      from: `"CloudMaSa Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: " New Contact Request",
      html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0a1a44;">New Contact Request</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td>${name}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Company:</td><td>${company}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td>${email}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Source:</td><td>${source}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Message:</td><td>${message}</td></tr>
        </table>
        <p style="margin-top: 20px;">— CloudMaSa Team</p>
      </div>
      `,
    });

    // Email to User
    await transporter.sendMail({
      from: `"CloudMaSa Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: " We Received Your Message",
      html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0a1a44;">Hello ${name},</h2>
        <p>Thank you for contacting <strong>CloudMaSa</strong>. We have received your message and will get back to you shortly.</p>
        <p><strong>Your Message:</strong></p>
        <p>${message}</p>
        <p style="margin-top: 20px;">Best regards,<br>CloudMaSa Team</p>
      </div>
      `,
    });

    return { statusCode: 200, body: JSON.stringify({ message: "Message sent successfully" }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: "Server error" }) };
  }
}
