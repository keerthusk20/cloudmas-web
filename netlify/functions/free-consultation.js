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

// Booking schema
const bookingSchema = new mongoose.Schema(
  { name: String, company: String, email: String, phone: String, date: String, time: String },
  { timestamps: true }
);
bookingSchema.index({ email: 1, date: 1 }, { unique: true });
const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

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

  const { name, company, email, phone, date, time } = JSON.parse(event.body);

  if (!name || !company || !email || !phone || !date || !time) {
    return { statusCode: 400, body: JSON.stringify({ message: "All fields are required" }) };
  }

  try {
    await Booking.create({ name, company, email, phone, date, time });

    // Email to Admin
    await transporter.sendMail({
      from: `"CloudMaSa Booking" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: " New Free Consultation Booking",
      html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0a1a44;">New Consultation Booking</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold;">Name:</td>
            <td style="padding: 8px;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Company:</td>
            <td style="padding: 8px;">${company}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Email:</td>
            <td style="padding: 8px;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Phone:</td>
            <td style="padding: 8px;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Date:</td>
            <td style="padding: 8px;">${date}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Time:</td>
            <td style="padding: 8px;">${time}</td>
          </tr>
        </table>
        <p style="margin-top: 20px;">— CloudMaSa Team</p>
      </div>
      `,
    });

    // Email to User
    await transporter.sendMail({
      from: `"CloudMaSa Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: " Your Free Consultation is Confirmed",
      html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #0a1a44;">Hello ${name},</h2>
        <p>Thank you for booking a free consultation with <strong>CloudMaSa</strong>.</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li><strong>Company:</strong> ${company}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time:</strong> ${time}</li>
          <li><strong>Phone:</strong> ${phone}</li>
        </ul>
        <p>We look forward to speaking with you and helping your business grow.</p>
        <p style="margin-top: 20px;">Best regards,<br>CloudMaSa Team</p>
      </div>
      `,
    });

    return { statusCode: 200, body: JSON.stringify({ message: "Consultation booked successfully" }) };
  } catch (err) {
    if (err.code === 11000) {
      return { statusCode: 409, body: JSON.stringify({ message: "You already booked a consultation for this date" }) };
    }
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: "Server error" }) };
  }
}
