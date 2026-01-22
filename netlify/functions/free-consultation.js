// netlify/functions/free-consultation.js
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { URL } from "url";

// Connect to MongoDB (only once per function instance)
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URL);
  isConnected = true;
};

// CORS helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event, context) => {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" })
    };
  }

  try {
    // Parse body
    const body = JSON.parse(event.body);
    const { name, company, email, phone, date, time } = body;

    if (!name || !company || !email || !phone || !date || !time) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "All fields are required" })
      };
    }

    // Connect DB
    await connectDB();

    // Define schema & model
    const bookingSchema = new mongoose.Schema({
      name: String,
      company: String,
      email: String,
      phone: String,
      date: String,
      time: String
    }, { timestamps: true });

    bookingSchema.index({ email: 1, date: 1 }, { unique: true });
    const Booking = mongoose.model("Booking", bookingSchema, "bookings");

    // Save to DB
    await Booking.create({ name, company, email, phone, date, time });

    // Send emails
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await Promise.all([
      transporter.sendMail({
        from: `"CloudMaSa Booking" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: "📅 New Free Consultation Booking",
        html: `<h2>New Consultation</h2><p><b>Name:</b> ${name}</p><p><b>Company:</b> ${company}</p><p><b>Email:</b> ${email}</p><p><b>Phone:</b> ${phone}</p><p><b>Date:</b> ${date}</p><p><b>Time:</b> ${time}</p>`
      }),
      transporter.sendMail({
        from: `"CloudMaSa Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "✅ Free Consultation Confirmed",
        html: `<p>Hi ${name},</p><p>Your free consultation is confirmed.</p><p><b>Date:</b> ${date}</p><p><b>Time:</b> ${time}</p><p>— CloudMaSa Team</p>`
      })
    ]);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Consultation booked successfully" })
    };

  } catch (err) {
    console.error("Free Consultation Error:", err);

    if (err.code === 11000) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ message: "You already booked a consultation for this date" })
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Server error" })
    };
  }
};
